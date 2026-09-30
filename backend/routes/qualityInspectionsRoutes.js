import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

const upsertRawStock = async (db, rawMaterialId, batchId, locationId, quantity, unitId) => {
    const [existing] = await db.query(
        "SELECT * FROM raw_material_stock WHERE rawMaterialId = ? AND batchId <=> ? AND locationId = ?",
        [rawMaterialId, batchId, locationId]
    );
    if (existing.length > 0) {
        await db.query(
            "UPDATE raw_material_stock SET quantity = quantity + ?, unitId = ? WHERE id = ?",
            [quantity, unitId, existing[0].id]
        );
        return existing[0].id;
    }
    const [result] = await db.query(
        "INSERT INTO raw_material_stock (rawMaterialId, batchId, locationId, quantity, unitId) VALUES (?, ?, ?, ?, ?)",
        [rawMaterialId, batchId, locationId, quantity, unitId]
    );
    return result.insertId;
};

const addRawLedger = async (db, entry) => {
    await db.query(
        `INSERT INTO raw_material_stock_ledger (rawMaterialId, batchId, locationId, transactionType, referenceType, referenceId, quantityIn, quantityOut, unitCost, remarks, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [entry.rawMaterialId, entry.batchId || null, entry.locationId || null, entry.transactionType,
         entry.referenceType || null, entry.referenceId || null,
         entry.quantityIn || 0, entry.quantityOut || 0, entry.unitCost || null, entry.remarks || null, entry.createdBy]
    );
};

router.get("/", async (req, res) => {
    try {
        const { goodsReceiptItemId, status, inspectedBy } = req.query;
        let query = `SELECT qi.*, emp.firstName, emp.lastName, gri.batchNumber, rm.name AS rawMaterialName
                     FROM quality_inspections qi
                     LEFT JOIN employees emp ON qi.inspectedBy = emp.id
                     LEFT JOIN goods_receipt_items gri ON qi.goodsReceiptItemId = gri.id
                     LEFT JOIN raw_materials rm ON gri.rawMaterialId = rm.id
                     WHERE 1 = 1`;
        const params = [];
        if (goodsReceiptItemId) { query += " AND qi.goodsReceiptItemId = ?"; params.push(goodsReceiptItemId); }
        if (status) { query += " AND qi.status = ?"; params.push(status); }
        if (inspectedBy) { query += " AND qi.inspectedBy = ?"; params.push(inspectedBy); }
        query += " ORDER BY qi.inspectedAt DESC";
        const [inspections] = await pool.query(query, params);
        res.json(inspections);
    } catch (error) {
        console.error("Error fetching quality inspections:", error);
        res.status(500).json({ message: "Error fetching quality inspections", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [inspections] = await pool.query(
            `SELECT qi.*, emp.firstName, emp.lastName, gri.batchNumber, rm.name AS rawMaterialName
             FROM quality_inspections qi
             LEFT JOIN employees emp ON qi.inspectedBy = emp.id
             LEFT JOIN goods_receipt_items gri ON qi.goodsReceiptItemId = gri.id
             LEFT JOIN raw_materials rm ON gri.rawMaterialId = rm.id
             WHERE qi.id = ?`,
            [req.params.id]
        );
        if (inspections.length === 0) {
            return res.status(404).json({ message: "Quality inspection not found" });
        }
        res.json(inspections[0]);
    } catch (error) {
        console.error("Error fetching quality inspection:", error);
        res.status(500).json({ message: "Error fetching quality inspection", error: error.message });
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { goodsReceiptItemId, inspectedBy, approvedQuantity, rejectedQuantity, status, remarks, rejectionAction } = req.body;
        await connection.beginTransaction();
        const [grnItemRows] = await connection.query(
            `SELECT gri.*, gr.receivedDate, gr.id AS goodsReceiptId
             FROM goods_receipt_items gri
             JOIN goods_receipts gr ON gri.goodsReceiptId = gr.id
             WHERE gri.id = ?`,
            [goodsReceiptItemId]
        );
        if (grnItemRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Goods receipt item not found" });
        }
        const grnItem = grnItemRows[0];
        const [result] = await connection.query(
            `INSERT INTO quality_inspections (goodsReceiptItemId, inspectedBy, approvedQuantity, rejectedQuantity, status, remarks, rejectionAction)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [goodsReceiptItemId, inspectedBy, approvedQuantity, rejectedQuantity, status, remarks || null, rejectionAction || null]
        );
        await connection.query(
            "UPDATE goods_receipt_items SET approvedQuantity = ?, rejectedQuantity = ?, qcStatus = ? WHERE id = ?",
            [approvedQuantity, rejectedQuantity, status, goodsReceiptItemId]
        );
        let batchId = null;
        if (Number(approvedQuantity) > 0) {
            const [batches] = await connection.query(
                "SELECT * FROM raw_material_batches WHERE rawMaterialId = ? AND batchNumber = ?",
                [grnItem.rawMaterialId, grnItem.batchNumber]
            );
            if (batches.length > 0) {
                batchId = batches[0].id;
                await connection.query(
                    "UPDATE raw_material_batches SET currentQuantity = currentQuantity + ?, qcStatus = ? WHERE id = ?",
                    [approvedQuantity, status === 'rejected' ? 'rejected' : 'approved', batchId]
                );
            } else {
                const [batchResult] = await connection.query(
                    `INSERT INTO raw_material_batches (rawMaterialId, supplierId, batchNumber, receivedDate, purchasePrice, originalQuantity, currentQuantity, unitId, qcStatus)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [grnItem.rawMaterialId, grnItem.supplierId || null, grnItem.batchNumber, grnItem.receivedDate,
                     grnItem.purchasePrice, approvedQuantity, approvedQuantity, grnItem.unitId,
                     status === 'rejected' ? 'rejected' : 'approved']
                );
                batchId = batchResult.insertId;
            }
        }
        if (Number(approvedQuantity) > 0) {
            await upsertRawStock(connection, grnItem.rawMaterialId, batchId, grnItem.locationId, approvedQuantity, grnItem.unitId);
            await addRawLedger(connection, {
                rawMaterialId: grnItem.rawMaterialId,
                batchId,
                locationId: grnItem.locationId,
                transactionType: 'qc_approved',
                referenceType: 'goods_receipt_item',
                referenceId: goodsReceiptItemId,
                quantityIn: approvedQuantity,
                unitCost: grnItem.purchasePrice,
                remarks: `QC approved for batch ${grnItem.batchNumber}`,
                createdBy: req.user.id
            });
        }
        if (Number(rejectedQuantity) > 0) {
            await addRawLedger(connection, {
                rawMaterialId: grnItem.rawMaterialId,
                batchId: null,
                locationId: grnItem.locationId,
                transactionType: 'qc_rejected',
                referenceType: 'goods_receipt_item',
                referenceId: goodsReceiptItemId,
                quantityOut: rejectedQuantity,
                unitCost: grnItem.purchasePrice,
                remarks: `QC rejected for batch ${grnItem.batchNumber} (${rejectionAction || 'rejected_stock'})`,
                createdBy: req.user.id
            });
        }
        const [pendingItems] = await connection.query(
            "SELECT COUNT(*) AS cnt FROM goods_receipt_items WHERE goodsReceiptId = ? AND qcStatus = 'pending'",
            [grnItem.goodsReceiptId]
        );
        await connection.query(
            "UPDATE goods_receipts SET status = ? WHERE id = ?",
            [pendingItems[0].cnt === 0 ? 'qc_completed' : 'partially_qc', grnItem.goodsReceiptId]
        );
        await connection.commit();
        const [newInspection] = await pool.query("SELECT * FROM quality_inspections WHERE id = ?", [result.insertId]);
        res.status(201).json(newInspection[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating quality inspection:", error);
        res.status(500).json({ message: "Error creating quality inspection", error: error.message });
    } finally {
        connection.release();
    }
});

export default router;