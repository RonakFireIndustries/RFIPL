// Shared helpers for the finished-goods and production routes.

import {
    generateDocumentNumber,
    httpError,
    sendError,
    toNullable,
    today,
} from "./purchasing.js";

export { generateDocumentNumber, httpError, sendError, toNullable, today };

export function round4(value) {
    return Math.round((Number(value) + Number.EPSILON) * 10000) / 10000;
}

// FG-0001, FG-0002, ... Uses the highest existing numeric SKU.
export async function generateProductSku(db) {
    const [rows] = await db.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(sku, 4) AS UNSIGNED)), 0) + 1 AS nextNumber
         FROM finished_products
         WHERE sku REGEXP '^FG-[0-9]+$'`
    );
    return `FG-${String(rows[0].nextNumber).padStart(4, "0")}`;
}

// Returns the factor that converts one unit of fromUnitId into toUnitId.
export async function conversionFactor(db, fromUnitId, toUnitId) {
    if (String(fromUnitId) === String(toUnitId)) return 1;

    const [forward] = await db.query(
        "SELECT conversionFactor FROM unit_conversions WHERE fromUnitId = ? AND toUnitId = ?",
        [fromUnitId, toUnitId]
    );
    if (forward.length > 0) {
        const factor = Number(forward[0].conversionFactor);
        if (factor > 0) return factor;
    }

    const [reverse] = await db.query(
        "SELECT conversionFactor FROM unit_conversions WHERE fromUnitId = ? AND toUnitId = ?",
        [toUnitId, fromUnitId]
    );
    if (reverse.length > 0) {
        const factor = Number(reverse[0].conversionFactor);
        if (factor > 0) return 1 / factor;
    }

    throw httpError(
        400,
        `No unit conversion is defined for this material (units ${fromUnitId} and ${toUnitId})`
    );
}

// Consumes a required quantity from raw-material batch stock using FIFO.
// Returns allocations in the requested unit plus the amount deducted from
// each stock row in that row's own unit.
export async function consumeFifo(db, { rawMaterialId, requiredQuantity, unitId }) {
    const required = round4(requiredQuantity);
    if (required <= 0) return [];

    const [stockRows] = await db.query(
        `SELECT s.id AS stockId, s.batchId, s.quantity, s.unitId AS stockUnitId,
                b.batchNumber
         FROM raw_material_stock s
         JOIN raw_material_batches b ON s.batchId = b.id
         WHERE s.rawMaterialId = ? AND s.quantity > 0
           AND b.qcStatus <> 'rejected'
         ORDER BY b.receivedDate ASC, b.id ASC`,
        [rawMaterialId]
    );

    let remaining = required;
    const allocations = [];

    for (const stock of stockRows) {
        if (remaining <= 0) break;
        const factor = await conversionFactor(db, stock.stockUnitId, unitId);
        const available = round4(Number(stock.quantity) * factor);
        if (available <= 0) continue;

        const taken = round4(Math.min(remaining, available));
        const stockDeduction = round4(taken / factor);

        await db.query(
            "UPDATE raw_material_stock SET quantity = quantity - ? WHERE id = ?",
            [stockDeduction, stock.stockId]
        );
        await db.query(
            "UPDATE raw_material_batches SET currentQuantity = currentQuantity - ? WHERE id = ?",
            [stockDeduction, stock.batchId]
        );

        allocations.push({
            batchId: stock.batchId,
            batchNumber: stock.batchNumber,
            quantity: taken,
            stockDeduction,
            stockUnitId: stock.stockUnitId,
            unitCost: null,
        });
        remaining = round4(remaining - taken);
    }

    if (remaining > 0) {
        throw httpError(
            400,
            `Insufficient raw-material stock: short by ${remaining} (base unit ${unitId})`
        );
    }

    // Batch-level purchase price is useful for cost reporting.
    for (const allocation of allocations) {
        const [[batch]] = await db.query(
            "SELECT purchasePrice FROM raw_material_batches WHERE id = ?",
            [allocation.batchId]
        );
        allocation.unitCost = batch ? batch.purchasePrice : null;
    }

    return allocations;
}

export async function consumeFromBatch(db, { rawMaterialId, batchId, requiredQuantity, unitId }) {
    const required = round4(requiredQuantity);
    if (required <= 0) throw httpError(400, "consumedQuantity must be greater than zero");

    const [rows] = await db.query(
        `SELECT s.id AS stockId, s.quantity, s.unitId AS stockUnitId, b.batchNumber
         FROM raw_material_stock s
         JOIN raw_material_batches b ON s.batchId = b.id
         WHERE s.rawMaterialId = ? AND s.batchId = ?`,
        [rawMaterialId, batchId]
    );
    if (rows.length === 0) {
        throw httpError(404, "No stock row exists for that material and batch");
    }

    const stock = rows[0];
    const factor = await conversionFactor(db, stock.stockUnitId, unitId);
    const available = round4(Number(stock.quantity) * factor);
    if (available < required) {
        throw httpError(400, `Only ${available} is available in batch ${stock.batchNumber}`);
    }

    const stockDeduction = round4(required / factor);
    await db.query("UPDATE raw_material_stock SET quantity = quantity - ? WHERE id = ?", [
        stockDeduction,
        stock.stockId,
    ]);
    await db.query(
        "UPDATE raw_material_batches SET currentQuantity = currentQuantity - ? WHERE id = ?",
        [stockDeduction, batchId]
    );

    const [[batch]] = await db.query(
        "SELECT purchasePrice FROM raw_material_batches WHERE id = ?",
        [batchId]
    );

    return [{
        batchId,
        batchNumber: stock.batchNumber,
        quantity: required,
        stockDeduction,
        stockUnitId: stock.stockUnitId,
        unitCost: batch ? batch.purchasePrice : null,
    }];
}

export async function addRawLedger(db, entry) {
    await db.query(
        `INSERT INTO raw_material_stock_ledger
            (rawMaterialId, batchId, transactionType, referenceType, referenceId,
             quantityIn, quantityOut, unitCost, remarks, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            entry.rawMaterialId,
            entry.batchId,
            entry.transactionType,
            toNullable(entry.referenceType),
            toNullable(entry.referenceId),
            entry.quantityIn || 0,
            entry.quantityOut || 0,
            toNullable(entry.unitCost),
            toNullable(entry.remarks),
            toNullable(entry.createdBy),
        ]
    );
}

export async function upsertFinishedStock(db, { finishedProductId, batchId, quantity, unitId }) {
    const [existing] = await db.query(
        "SELECT id FROM finished_product_stock WHERE finishedProductId = ? AND batchId = ?",
        [finishedProductId, batchId]
    );
    if (existing.length > 0) {
        await db.query(
            "UPDATE finished_product_stock SET quantity = quantity + ?, unitId = ? WHERE id = ?",
            [quantity, unitId, existing[0].id]
        );
        return existing[0].id;
    }
    const [result] = await db.query(
        `INSERT INTO finished_product_stock (finishedProductId, batchId, quantity, unitId)
         VALUES (?, ?, ?, ?)`,
        [finishedProductId, batchId, quantity, unitId]
    );
    return result.insertId;
}

export async function addFinishedLedger(db, entry) {
    await db.query(
        `INSERT INTO finished_product_stock_ledger
            (finishedProductId, batchId, transactionType, referenceType, referenceId,
             quantityIn, quantityOut, unitCost, remarks, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            entry.finishedProductId,
            entry.batchId,
            entry.transactionType,
            toNullable(entry.referenceType),
            toNullable(entry.referenceId),
            entry.quantityIn || 0,
            entry.quantityOut || 0,
            toNullable(entry.unitCost),
            toNullable(entry.remarks),
            toNullable(entry.createdBy),
        ]
    );
}

export function duplicateError(res, error, message) {
    if (error.code === "ER_DUP_ENTRY") {
        return res.status(409).json({ message });
    }
    return sendError(res, "saving record", error);
}
