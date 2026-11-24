import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

const LEDGER_TYPES = [
    "opening_stock",
    "purchase_receipt",
    "qc_approved",
    "qc_rejected",
    "production_consumption",
    "transfer_out",
    "transfer_in",
    "adjustment",
    "damage",
    "loss",
    "return_supplier",
];

const QC_STATUSES = ["approved", "rejected", "partial"];

function toNullable(value) {
    return value === undefined || value === "" ? null : value;
}

function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

function sendError(res, label, error) {
    console.error(`Error ${label}:`, error);
    res.status(error.statusCode || 500).json({
        message: `Error ${label}`,
        error: error.message,
    });
}

async function getBatchUnit(connection, batchId, rawMaterialId) {
    const [batches] = await connection.query(
        "SELECT id, rawMaterialId, unitId FROM raw_material_batches WHERE id = ?",
        [batchId]
    );
    if (batches.length === 0) {
        throw httpError(404, "Raw material batch not found");
    }
    if (rawMaterialId && Number(batches[0].rawMaterialId) !== Number(rawMaterialId)) {
        throw httpError(400, "Batch does not belong to the given raw material");
    }
    return batches[0];
}

async function addLedger(connection, entry) {
    await connection.query(
        `INSERT INTO raw_material_stock_ledger
            (rawMaterialId, batchId, transactionType, referenceType, referenceId,
             quantityIn, quantityOut, unitCost, remarks, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            entry.rawMaterialId,
            toNullable(entry.batchId),
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

async function applyStockDelta(connection, { rawMaterialId, batchId, unitId, delta }) {
    const [rows] = await connection.query(
        "SELECT id, quantity FROM raw_material_stock WHERE rawMaterialId = ? AND batchId = ?",
        [rawMaterialId, batchId]
    );

    if (rows.length === 0) {
        if (delta < 0) {
            throw httpError(400, "No stock row exists for this material and batch");
        }
        await connection.query(
            "INSERT INTO raw_material_stock (rawMaterialId, batchId, quantity, unitId) VALUES (?, ?, ?, ?)",
            [rawMaterialId, batchId, delta, unitId]
        );
        return delta;
    }

    const newQuantity = Number(rows[0].quantity) + Number(delta);
    if (newQuantity < 0) {
        throw httpError(400, "Stock quantity cannot go below zero");
    }
    await connection.query(
        "UPDATE raw_material_stock SET quantity = ?, unitId = ? WHERE id = ?",
        [newQuantity, unitId, rows[0].id]
    );
    return newQuantity;
}

// ------------------------------------------------------------
// BATCHES
// ------------------------------------------------------------

router.get("/batches", async (req, res) => {
    try {
        const { rawMaterialId, supplierId, qcStatus } = req.query;
        let query = `SELECT rb.*, rm.name AS rawMaterialName, rm.sku,
                            s.companyName AS supplierName, u.symbol AS unitSymbol
                     FROM raw_material_batches rb
                     LEFT JOIN raw_materials rm ON rb.rawMaterialId = rm.id
                     LEFT JOIN suppliers s ON rb.supplierId = s.id
                     LEFT JOIN inventory_units u ON rb.unitId = u.id
                     WHERE 1 = 1`;
        const params = [];
        if (rawMaterialId) { query += " AND rb.rawMaterialId = ?"; params.push(rawMaterialId); }
        if (supplierId) { query += " AND rb.supplierId = ?"; params.push(supplierId); }
        if (qcStatus) { query += " AND rb.qcStatus = ?"; params.push(qcStatus); }
        query += " ORDER BY rb.receivedDate DESC, rb.id DESC";
        const [batches] = await pool.query(query, params);
        res.json(batches);
    } catch (error) {
        sendError(res, "fetching raw material batches", error);
    }
});

router.get("/batches/:id", async (req, res) => {
    try {
        const [batches] = await pool.query(
            `SELECT rb.*, rm.name AS rawMaterialName, rm.sku,
                    s.companyName AS supplierName, u.symbol AS unitSymbol
             FROM raw_material_batches rb
             LEFT JOIN raw_materials rm ON rb.rawMaterialId = rm.id
             LEFT JOIN suppliers s ON rb.supplierId = s.id
             LEFT JOIN inventory_units u ON rb.unitId = u.id
             WHERE rb.id = ?`,
            [req.params.id]
        );
        if (batches.length === 0) {
            return res.status(404).json({ message: "Raw material batch not found" });
        }
        res.json(batches[0]);
    } catch (error) {
        sendError(res, "fetching raw material batch", error);
    }
});

router.post("/batches", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            rawMaterialId, supplierId, batchNumber, receivedDate,
            purchasePrice, originalQuantity, currentQuantity, unitId, qcStatus,
        } = req.body;

        if (!rawMaterialId || !batchNumber || !receivedDate || !unitId || originalQuantity === undefined) {
            return res.status(400).json({
                message: "rawMaterialId, batchNumber, receivedDate, unitId and originalQuantity are required",
            });
        }
        if (purchasePrice === undefined || purchasePrice === null || purchasePrice === "") {
            return res.status(400).json({ message: "purchasePrice is required" });
        }
        if (qcStatus && !QC_STATUSES.includes(qcStatus)) {
            return res.status(400).json({ message: `qcStatus must be one of: ${QC_STATUSES.join(", ")}` });
        }

        const initialQuantity = currentQuantity !== undefined ? Number(currentQuantity) : Number(originalQuantity);
        if (Number.isNaN(initialQuantity) || initialQuantity < 0) {
            return res.status(400).json({ message: "currentQuantity cannot be negative" });
        }

        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO raw_material_batches
                (rawMaterialId, supplierId, batchNumber, receivedDate, purchasePrice,
                 originalQuantity, currentQuantity, unitId, qcStatus)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                rawMaterialId,
                toNullable(supplierId),
                batchNumber,
                receivedDate,
                purchasePrice,
                originalQuantity,
                initialQuantity,
                unitId,
                qcStatus || "approved",
            ]
        );
        const batchId = result.insertId;

        if (initialQuantity > 0) {
            await applyStockDelta(connection, {
                rawMaterialId,
                batchId,
                unitId,
                delta: initialQuantity,
            });
            await addLedger(connection, {
                rawMaterialId,
                batchId,
                transactionType: supplierId ? "purchase_receipt" : "opening_stock",
                referenceType: "raw_material_batch",
                referenceId: batchId,
                quantityIn: initialQuantity,
                unitCost: purchasePrice,
                remarks: `Batch ${batchNumber} created`,
                createdBy: req.user.id,
            });
        }

        await connection.commit();

        const [newBatch] = await pool.query("SELECT * FROM raw_material_batches WHERE id = ?", [batchId]);
        res.status(201).json(newBatch[0]);
    } catch (error) {
        await connection.rollback();
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Batch already exists for this raw material" });
        }
        sendError(res, "creating raw material batch", error);
    } finally {
        connection.release();
    }
});

router.put("/batches/:id", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            supplierId, batchNumber, receivedDate, purchasePrice,
            originalQuantity, currentQuantity, qcStatus,
        } = req.body;

        if (!batchNumber || !receivedDate || originalQuantity === undefined) {
            return res.status(400).json({
                message: "batchNumber, receivedDate and originalQuantity are required",
            });
        }
        if (purchasePrice === undefined || purchasePrice === null || purchasePrice === "") {
            return res.status(400).json({ message: "purchasePrice is required" });
        }
        if (qcStatus && !QC_STATUSES.includes(qcStatus)) {
            return res.status(400).json({ message: `qcStatus must be one of: ${QC_STATUSES.join(", ")}` });
        }

        await connection.beginTransaction();

        const batch = await getBatchUnit(connection, req.params.id);
        const [rows] = await connection.query(
            "SELECT currentQuantity, unitId FROM raw_material_batches WHERE id = ?",
            [req.params.id]
        );
        const previousQuantity = Number(rows[0].currentQuantity);
        const newQuantity = currentQuantity !== undefined ? Number(currentQuantity) : Number(originalQuantity);
        if (Number.isNaN(newQuantity) || newQuantity < 0) {
            throw httpError(400, "currentQuantity cannot be negative");
        }

        await connection.query(
            `UPDATE raw_material_batches SET
                supplierId = ?, batchNumber = ?, receivedDate = ?, purchasePrice = ?,
                originalQuantity = ?, currentQuantity = ?, qcStatus = ?
             WHERE id = ?`,
            [
                toNullable(supplierId),
                batchNumber,
                receivedDate,
                purchasePrice,
                originalQuantity,
                newQuantity,
                qcStatus || "approved",
                req.params.id,
            ]
        );

        const delta = newQuantity - previousQuantity;
        if (delta !== 0) {
            await applyStockDelta(connection, {
                rawMaterialId: batch.rawMaterialId,
                batchId: Number(req.params.id),
                unitId: rows[0].unitId,
                delta,
            });
            await addLedger(connection, {
                rawMaterialId: batch.rawMaterialId,
                batchId: Number(req.params.id),
                transactionType: "adjustment",
                referenceType: "raw_material_batch",
                referenceId: req.params.id,
                quantityIn: delta > 0 ? delta : 0,
                quantityOut: delta < 0 ? Math.abs(delta) : 0,
                unitCost: purchasePrice,
                remarks: `Batch ${batchNumber} quantity adjusted`,
                createdBy: req.user.id,
            });
        }

        await connection.commit();

        const [updatedBatch] = await pool.query("SELECT * FROM raw_material_batches WHERE id = ?", [req.params.id]);
        res.json(updatedBatch[0]);
    } catch (error) {
        await connection.rollback();
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Batch already exists for this raw material" });
        }
        sendError(res, "updating raw material batch", error);
    } finally {
        connection.release();
    }
});

// ------------------------------------------------------------
// CURRENT STOCK (single store, one row per material + batch)
// ------------------------------------------------------------

router.get("/", async (req, res) => {
    try {
        const { rawMaterialId, batchId } = req.query;
        let query = `SELECT rs.*, rm.name AS rawMaterialName, rm.sku,
                            rb.batchNumber, u.symbol AS unitSymbol
                     FROM raw_material_stock rs
                     JOIN raw_materials rm ON rs.rawMaterialId = rm.id
                     LEFT JOIN raw_material_batches rb ON rs.batchId = rb.id
                     JOIN inventory_units u ON rs.unitId = u.id
                     WHERE rm.deletedAt IS NULL`;
        const params = [];
        if (rawMaterialId) { query += " AND rs.rawMaterialId = ?"; params.push(rawMaterialId); }
        if (batchId) { query += " AND rs.batchId = ?"; params.push(batchId); }
        query += " ORDER BY rm.name, rb.batchNumber";
        const [stock] = await pool.query(query, params);
        res.json(stock);
    } catch (error) {
        sendError(res, "fetching raw material stock", error);
    }
});

router.post("/stock", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { rawMaterialId, batchId, quantity, unitId, transactionType, remarks } = req.body;

        if (!rawMaterialId || !batchId || quantity === undefined) {
            return res.status(400).json({ message: "rawMaterialId, batchId and quantity are required" });
        }
        const delta = Number(quantity);
        if (Number.isNaN(delta) || delta === 0) {
            return res.status(400).json({ message: "quantity must be a non-zero number (difference to apply)" });
        }
        if (transactionType && !LEDGER_TYPES.includes(transactionType)) {
            return res.status(400).json({ message: `transactionType must be one of: ${LEDGER_TYPES.join(", ")}` });
        }

        await connection.beginTransaction();

        const batch = await getBatchUnit(connection, batchId, rawMaterialId);
        const finalUnitId = unitId || batch.unitId;

        const newQuantity = await applyStockDelta(connection, {
            rawMaterialId,
            batchId,
            unitId: finalUnitId,
            delta,
        });

        await addLedger(connection, {
            rawMaterialId,
            batchId,
            transactionType: transactionType || "adjustment",
            referenceType: "manual",
            quantityIn: delta > 0 ? delta : 0,
            quantityOut: delta < 0 ? Math.abs(delta) : 0,
            remarks: remarks || "Manual stock update",
            createdBy: req.user.id,
        });

        await connection.commit();

        const [rows] = await connection.query(
            "SELECT * FROM raw_material_stock WHERE rawMaterialId = ? AND batchId = ?",
            [rawMaterialId, batchId]
        );
        res.status(201).json({ ...rows[0], quantity: newQuantity });
    } catch (error) {
        await connection.rollback();
        sendError(res, "updating raw material stock", error);
    } finally {
        connection.release();
    }
});

router.put("/stock/:id", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { quantity, unitId, remarks } = req.body;
        if (quantity === undefined) {
            return res.status(400).json({ message: "quantity is required" });
        }
        const newQuantity = Number(quantity);
        if (Number.isNaN(newQuantity) || newQuantity < 0) {
            return res.status(400).json({ message: "quantity cannot be negative" });
        }

        await connection.beginTransaction();

        const [rows] = await connection.query(
            "SELECT * FROM raw_material_stock WHERE id = ?",
            [req.params.id]
        );
        if (rows.length === 0) {
            throw httpError(404, "Stock row not found");
        }

        const previousQuantity = Number(rows[0].quantity);
        const delta = newQuantity - previousQuantity;

        await connection.query(
            "UPDATE raw_material_stock SET quantity = ?, unitId = ? WHERE id = ?",
            [newQuantity, unitId || rows[0].unitId, req.params.id]
        );

        if (delta !== 0) {
            await addLedger(connection, {
                rawMaterialId: rows[0].rawMaterialId,
                batchId: rows[0].batchId,
                transactionType: "adjustment",
                referenceType: "manual",
                referenceId: req.params.id,
                quantityIn: delta > 0 ? delta : 0,
                quantityOut: delta < 0 ? Math.abs(delta) : 0,
                remarks: remarks || "Stock quantity set manually",
                createdBy: req.user.id,
            });
        }

        await connection.commit();

        const [updatedStock] = await pool.query("SELECT * FROM raw_material_stock WHERE id = ?", [req.params.id]);
        res.json(updatedStock[0]);
    } catch (error) {
        await connection.rollback();
        sendError(res, "updating stock row", error);
    } finally {
        connection.release();
    }
});

// ------------------------------------------------------------
// STOCK LEDGER
// ------------------------------------------------------------

router.get("/ledger", async (req, res) => {
    try {
        const { rawMaterialId, batchId, transactionType, fromDate, toDate } = req.query;
        let query = `SELECT rl.*, rm.name AS rawMaterialName, rm.sku, rb.batchNumber,
                            u.email AS createdByEmail
                     FROM raw_material_stock_ledger rl
                     LEFT JOIN raw_materials rm ON rl.rawMaterialId = rm.id
                     LEFT JOIN raw_material_batches rb ON rl.batchId = rb.id
                     LEFT JOIN users u ON rl.createdBy = u.id
                     WHERE 1 = 1`;
        const params = [];
        if (rawMaterialId) { query += " AND rl.rawMaterialId = ?"; params.push(rawMaterialId); }
        if (batchId) { query += " AND rl.batchId = ?"; params.push(batchId); }
        if (transactionType) { query += " AND rl.transactionType = ?"; params.push(transactionType); }
        if (fromDate) { query += " AND DATE(rl.transactionAt) >= ?"; params.push(fromDate); }
        if (toDate) { query += " AND DATE(rl.transactionAt) <= ?"; params.push(toDate); }
        query += " ORDER BY rl.transactionAt DESC, rl.id DESC";
        const [ledger] = await pool.query(query, params);
        res.json(ledger);
    } catch (error) {
        sendError(res, "fetching raw material ledger", error);
    }
});

// History-only entry: records a movement without changing current stock.
router.post("/ledger", async (req, res) => {
    try {
        const {
            rawMaterialId, batchId, transactionType, referenceType, referenceId,
            quantityIn, quantityOut, unitCost, remarks,
        } = req.body;

        if (!rawMaterialId || !transactionType) {
            return res.status(400).json({ message: "rawMaterialId and transactionType are required" });
        }
        if (!LEDGER_TYPES.includes(transactionType)) {
            return res.status(400).json({ message: `transactionType must be one of: ${LEDGER_TYPES.join(", ")}` });
        }

        const [result] = await pool.query(
            `INSERT INTO raw_material_stock_ledger
                (rawMaterialId, batchId, transactionType, referenceType, referenceId,
                 quantityIn, quantityOut, unitCost, remarks, createdBy)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                rawMaterialId,
                toNullable(batchId),
                transactionType,
                toNullable(referenceType),
                toNullable(referenceId),
                quantityIn !== undefined ? quantityIn : 0,
                quantityOut !== undefined ? quantityOut : 0,
                toNullable(unitCost),
                toNullable(remarks),
                req.user.id,
            ]
        );
        const [newEntry] = await pool.query("SELECT * FROM raw_material_stock_ledger WHERE id = ?", [result.insertId]);
        res.status(201).json(newEntry[0]);
    } catch (error) {
        sendError(res, "creating ledger entry", error);
    }
});

// ------------------------------------------------------------
// REPORTS
// ------------------------------------------------------------

router.get("/summary", async (req, res) => {
    try {
        const [summary] = await pool.query(
            `SELECT rm.id, rm.name, rm.sku, rm.minimumStockLevel, rm.reorderLevel,
                    u.symbol AS unitSymbol,
                    COALESCE(SUM(rs.quantity), 0) AS totalStock
             FROM raw_materials rm
             JOIN inventory_units u ON rm.unitId = u.id
             LEFT JOIN raw_material_stock rs ON rs.rawMaterialId = rm.id
             WHERE rm.deletedAt IS NULL AND rm.isActive = 1
             GROUP BY rm.id, rm.name, rm.sku, rm.minimumStockLevel, rm.reorderLevel, u.symbol
             ORDER BY rm.name`
        );
        res.json(summary);
    } catch (error) {
        sendError(res, "fetching stock summary", error);
    }
});

router.get("/low-stock", async (req, res) => {
    try {
        const [lowStock] = await pool.query(
            `SELECT rm.id, rm.name, rm.sku, rm.minimumStockLevel, rm.reorderLevel,
                    u.symbol AS unitSymbol,
                    COALESCE(SUM(rs.quantity), 0) AS totalStock
             FROM raw_materials rm
             JOIN inventory_units u ON rm.unitId = u.id
             LEFT JOIN raw_material_stock rs ON rs.rawMaterialId = rm.id
             WHERE rm.deletedAt IS NULL AND rm.isActive = 1
             GROUP BY rm.id, rm.name, rm.sku, rm.minimumStockLevel, rm.reorderLevel, u.symbol
             HAVING totalStock < rm.minimumStockLevel
             ORDER BY totalStock`
        );
        res.json(lowStock);
    } catch (error) {
        sendError(res, "fetching low stock items", error);
    }
});

export default router;
