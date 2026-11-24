import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";
import { httpError, sendError, toNullable } from "../utils/purchasing.js";

const router = express.Router();

router.use(authMiddleware);

const VALID_STATUS = ["approved", "partially_approved", "rejected"];

const DETAIL_QUERY = `
    SELECT qi.*,
           inspector.email AS inspectedByEmail,
           gri.batchNumber,
           gri.receivedQuantity,
           gri.purchasePrice,
           gri.qcStatus AS itemQcStatus,
           gri.rawMaterialId,
           gri.unitId,
           rm.name AS rawMaterialName,
           rm.sku,
           gr.grnNumber,
           u.symbol AS unitSymbol
    FROM quality_inspections qi
    JOIN goods_receipt_items gri ON qi.goodsReceiptItemId = gri.id
    JOIN goods_receipts gr ON gri.goodsReceiptId = gr.id
    LEFT JOIN users inspector ON qi.inspectedBy = inspector.id
    LEFT JOIN raw_materials rm ON gri.rawMaterialId = rm.id
    LEFT JOIN inventory_units u ON gri.unitId = u.id
`;

function batchQcStatus(inspectionStatus) {
    if (inspectionStatus === "partially_approved") return "partial";
    return inspectionStatus;
}

async function upsertBatchAndStock(db, { grnItem, approvedQuantity, qcStatus }) {
    const [batches] = await db.query(
        "SELECT id FROM raw_material_batches WHERE rawMaterialId = ? AND batchNumber = ?",
        [grnItem.rawMaterialId, grnItem.batchNumber]
    );

    let batchId;
    if (batches.length > 0) {
        batchId = batches[0].id;
        await db.query(
            `UPDATE raw_material_batches
             SET originalQuantity = originalQuantity + ?,
                 currentQuantity = currentQuantity + ?,
                 qcStatus = ?
             WHERE id = ?`,
            [approvedQuantity, approvedQuantity, qcStatus, batchId]
        );
    } else {
        const [result] = await db.query(
            `INSERT INTO raw_material_batches
                (rawMaterialId, supplierId, batchNumber, receivedDate, purchasePrice,
                 originalQuantity, currentQuantity, unitId, qcStatus)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                grnItem.rawMaterialId,
                toNullable(grnItem.supplierId),
                grnItem.batchNumber,
                grnItem.receivedDate,
                grnItem.purchasePrice,
                approvedQuantity,
                approvedQuantity,
                grnItem.unitId,
                qcStatus,
            ]
        );
        batchId = result.insertId;
    }

    const [stockRows] = await db.query(
        "SELECT id FROM raw_material_stock WHERE rawMaterialId = ? AND batchId = ?",
        [grnItem.rawMaterialId, batchId]
    );
    if (stockRows.length > 0) {
        await db.query(
            "UPDATE raw_material_stock SET quantity = quantity + ?, unitId = ? WHERE id = ?",
            [approvedQuantity, grnItem.unitId, stockRows[0].id]
        );
    } else {
        await db.query(
            `INSERT INTO raw_material_stock (rawMaterialId, batchId, quantity, unitId)
             VALUES (?, ?, ?, ?)`,
            [grnItem.rawMaterialId, batchId, approvedQuantity, grnItem.unitId]
        );
    }

    return batchId;
}

async function addLedger(db, entry) {
    await db.query(
        `INSERT INTO raw_material_stock_ledger
            (rawMaterialId, batchId, transactionType, referenceType, referenceId,
             quantityIn, quantityOut, unitCost, remarks, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            entry.rawMaterialId,
            toNullable(entry.batchId),
            entry.transactionType,
            entry.referenceType,
            entry.referenceId,
            entry.quantityIn || 0,
            entry.quantityOut || 0,
            toNullable(entry.unitCost),
            toNullable(entry.remarks),
            toNullable(entry.createdBy),
        ]
    );
}

async function updateGoodsReceiptStatus(db, goodsReceiptId) {
    const [rows] = await db.query(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN qcStatus = 'pending' THEN 1 ELSE 0 END) AS pending
         FROM goods_receipt_items
         WHERE goodsReceiptId = ?`,
        [goodsReceiptId]
    );
    const status = Number(rows[0].pending) === 0 ? "qc_completed" : "partially_qc";
    await db.query("UPDATE goods_receipts SET status = ? WHERE id = ?", [
        status,
        goodsReceiptId,
    ]);
}

router.get("/", async (req, res) => {
    try {
        const { goodsReceiptItemId, status, inspectedBy } = req.query;
        let query = `${DETAIL_QUERY} WHERE 1 = 1`;
        const params = [];
        if (goodsReceiptItemId) { query += " AND qi.goodsReceiptItemId = ?"; params.push(goodsReceiptItemId); }
        if (status) { query += " AND qi.status = ?"; params.push(status); }
        if (inspectedBy) { query += " AND qi.inspectedBy = ?"; params.push(inspectedBy); }
        query += " ORDER BY qi.inspectedAt DESC, qi.id DESC";
        const [inspections] = await pool.query(query, params);
        res.json(inspections);
    } catch (error) {
        sendError(res, "fetching quality inspections", error);
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [inspections] = await pool.query(`${DETAIL_QUERY} WHERE qi.id = ?`, [req.params.id]);
        if (inspections.length === 0) {
            return res.status(404).json({ message: "Quality inspection not found" });
        }
        res.json(inspections[0]);
    } catch (error) {
        sendError(res, "fetching quality inspection", error);
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            goodsReceiptItemId, inspectedBy, approvedQuantity, rejectedQuantity,
            status, remarks, rejectionAction,
        } = req.body;

        if (!goodsReceiptItemId) {
            throw httpError(400, "goodsReceiptItemId is required");
        }
        if (!VALID_STATUS.includes(status)) {
            throw httpError(400, `status must be one of: ${VALID_STATUS.join(", ")}`);
        }

        const approved = Number(approvedQuantity || 0);
        const rejected = Number(rejectedQuantity || 0);
        if (approved < 0 || rejected < 0) {
            throw httpError(400, "Inspection quantities cannot be negative");
        }
        if (
            (status === "approved" && (approved <= 0 || rejected !== 0)) ||
            (status === "rejected" && (approved !== 0 || rejected <= 0)) ||
            (status === "partially_approved" && (approved <= 0 || rejected <= 0))
        ) {
            throw httpError(400, "Inspection quantities do not match the status");
        }

        await connection.beginTransaction();

        const [grnItems] = await connection.query(
            `SELECT gri.*, gr.supplierId, gr.receivedDate, gr.status AS grnStatus
             FROM goods_receipt_items gri
             JOIN goods_receipts gr ON gri.goodsReceiptId = gr.id
             WHERE gri.id = ?`,
            [goodsReceiptItemId]
        );
        if (grnItems.length === 0) {
            throw httpError(404, "Goods receipt item not found");
        }
        const grnItem = grnItems[0];
        if (grnItem.grnStatus === "cancelled" || grnItem.qcStatus !== "pending") {
            throw httpError(409, "This goods receipt item has already been inspected or cancelled");
        }
        if (approved + rejected > Number(grnItem.receivedQuantity)) {
            throw httpError(400, "Inspected quantity exceeds the received quantity");
        }

        const [existing] = await connection.query(
            "SELECT id FROM quality_inspections WHERE goodsReceiptItemId = ?",
            [goodsReceiptItemId]
        );
        if (existing.length > 0) {
            throw httpError(409, "A quality inspection already exists for this item");
        }

        const [result] = await connection.query(
            `INSERT INTO quality_inspections
                (goodsReceiptItemId, inspectedBy, approvedQuantity, rejectedQuantity,
                 status, remarks, rejectionAction)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                goodsReceiptItemId,
                inspectedBy || req.user.id,
                approved,
                rejected,
                status,
                toNullable(remarks),
                rejected > 0 ? rejectionAction || "rejected_stock" : null,
            ]
        );

        await connection.query(
            `UPDATE goods_receipt_items
             SET approvedQuantity = ?, rejectedQuantity = ?, qcStatus = ?
             WHERE id = ?`,
            [approved, rejected, status, goodsReceiptItemId]
        );

        let batchId = null;
        if (approved > 0) {
            batchId = await upsertBatchAndStock(connection, {
                grnItem,
                approvedQuantity: approved,
                qcStatus: batchQcStatus(status),
            });
            await addLedger(connection, {
                rawMaterialId: grnItem.rawMaterialId,
                batchId,
                transactionType: "qc_approved",
                referenceType: "goods_receipt_item",
                referenceId: goodsReceiptItemId,
                quantityIn: approved,
                unitCost: grnItem.purchasePrice,
                remarks: `QC approved for batch ${grnItem.batchNumber}`,
                createdBy: req.user.id,
            });
        }

        if (rejected > 0) {
            await addLedger(connection, {
                rawMaterialId: grnItem.rawMaterialId,
                batchId,
                transactionType: "qc_rejected",
                referenceType: "goods_receipt_item",
                referenceId: goodsReceiptItemId,
                quantityOut: rejected,
                unitCost: grnItem.purchasePrice,
                remarks: `QC rejected for batch ${grnItem.batchNumber} (${rejectionAction || "rejected_stock"})`,
                createdBy: req.user.id,
            });
        }

        await updateGoodsReceiptStatus(connection, grnItem.goodsReceiptId);
        await connection.commit();

        const [created] = await pool.query(`${DETAIL_QUERY} WHERE qi.id = ?`, [result.insertId]);
        res.status(201).json(created[0]);
    } catch (error) {
        await connection.rollback();
        sendError(res, "creating quality inspection", error);
    } finally {
        connection.release();
    }
});

export default router;
