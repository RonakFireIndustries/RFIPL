import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

const addRawLedger = async (db, entry) => {
    await db.query(
        `INSERT INTO raw_material_stock_ledger (rawMaterialId, batchId, locationId, transactionType, referenceType, referenceId, quantityIn, quantityOut, remarks, createdBy)
         VALUES (?, ?, ?, 'adjustment', 'stock_adjustment', ?, ?, ?, ?, ?)`,
        [entry.rawMaterialId, entry.batchId || null, entry.locationId || null, entry.referenceId,
         entry.quantityIn || 0, entry.quantityOut || 0, entry.remarks || null, entry.createdBy]
    );
};

const addFinishedLedger = async (db, entry) => {
    await db.query(
        `INSERT INTO finished_product_stock_ledger (finishedProductId, batchId, locationId, transactionType, referenceType, referenceId, quantityIn, quantityOut, remarks, createdBy)
         VALUES (?, ?, ?, 'adjustment', 'stock_adjustment', ?, ?, ?, ?, ?)`,
        [entry.finishedProductId, entry.batchId || null, entry.locationId || null, entry.referenceId,
         entry.quantityIn || 0, entry.quantityOut || 0, entry.remarks || null, entry.createdBy]
    );
};

router.get("/", async (req, res) => {
    try {
        const { status, inventoryType } = req.query;
        let query = `SELECT sa.*, req.firstName AS requestedByName, app.lastName AS approvedByName
                     FROM stock_adjustments sa
                     LEFT JOIN employees req ON sa.requestedBy = req.id
                     LEFT JOIN employees app ON sa.approvedBy = app.id
                     WHERE 1 = 1`;
        const params = [];
        if (status) { query += " AND sa.status = ?"; params.push(status); }
        if (inventoryType) { query += " AND sa.inventoryType = ?"; params.push(inventoryType); }
        query += " ORDER BY sa.createdAt DESC";
        const [adjustments] = await pool.query(query, params);
        res.json(adjustments);
    } catch (error) {
        console.error("Error fetching stock adjustments:", error);
        res.status(500).json({ message: "Error fetching stock adjustments", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [adjustments] = await pool.query(
            `SELECT sa.*, req.firstName AS requestedByName, app.lastName AS approvedByName
             FROM stock_adjustments sa
             LEFT JOIN employees req ON sa.requestedBy = req.id
             LEFT JOIN employees app ON sa.approvedBy = app.id
             WHERE sa.id = ?`,
            [req.params.id]
        );
        if (adjustments.length === 0) {
            return res.status(404).json({ message: "Stock adjustment not found" });
        }
        const [items] = await pool.query(
            `SELECT sai.*, sl.name AS locationName
             FROM stock_adjustment_items sai
             LEFT JOIN stock_locations sl ON sai.locationId = sl.id
             WHERE sai.stockAdjustmentId = ?`,
            [req.params.id]
        );
        adjustments[0].items = items;
        res.json(adjustments[0]);
    } catch (error) {
        console.error("Error fetching stock adjustment:", error);
        res.status(500).json({ message: "Error fetching stock adjustment", error: error.message });
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { adjustmentNumber, inventoryType, requestedBy, reason, description, items } = req.body;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO stock_adjustments (adjustmentNumber, inventoryType, requestedBy, reason, description)
             VALUES (?, ?, ?, ?, ?)`,
            [adjustmentNumber, inventoryType, requestedBy, reason, description || null]
        );
        if (Array.isArray(items)) {
            for (const item of items) {
                const adjustmentQuantity = Number(item.physicalQuantity) - Number(item.systemQuantity);
                await connection.query(
                    `INSERT INTO stock_adjustment_items (stockAdjustmentId, itemType, itemId, batchNumber, locationId, systemQuantity, physicalQuantity, adjustmentQuantity, unitId)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [result.insertId, item.itemType || inventoryType, item.itemId, item.batchNumber || null,
                     item.locationId, item.systemQuantity, item.physicalQuantity, adjustmentQuantity, item.unitId]
                );
            }
        }
        await connection.commit();
        const [newAdjustment] = await pool.query("SELECT * FROM stock_adjustments WHERE id = ?", [result.insertId]);
        res.status(201).json(newAdjustment[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating stock adjustment:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Adjustment number already exists" });
        }
        res.status(500).json({ message: "Error creating stock adjustment", error: error.message });
    } finally {
        connection.release();
    }
});

router.patch("/:id/approve", async (req, res) => {
    try {
        const { approvedBy, approvalRemarks } = req.body;
        const [result] = await pool.query(
            "UPDATE stock_adjustments SET status = 'approved', approvedBy = ?, approvedAt = NOW(), approvalRemarks = ? WHERE id = ? AND status = 'pending'",
            [approvedBy || null, approvalRemarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Stock adjustment cannot be approved" });
        }
        const [updatedAdjustment] = await pool.query("SELECT * FROM stock_adjustments WHERE id = ?", [req.params.id]);
        res.json(updatedAdjustment[0]);
    } catch (error) {
        console.error("Error approving stock adjustment:", error);
        res.status(500).json({ message: "Error approving stock adjustment", error: error.message });
    }
});

router.patch("/:id/reject", async (req, res) => {
    try {
        const { approvedBy, approvalRemarks } = req.body;
        const [result] = await pool.query(
            "UPDATE stock_adjustments SET status = 'rejected', approvedBy = ?, approvedAt = NOW(), approvalRemarks = ? WHERE id = ? AND status = 'pending'",
            [approvedBy || null, approvalRemarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Stock adjustment cannot be rejected" });
        }
        const [updatedAdjustment] = await pool.query("SELECT * FROM stock_adjustments WHERE id = ?", [req.params.id]);
        res.json(updatedAdjustment[0]);
    } catch (error) {
        console.error("Error rejecting stock adjustment:", error);
        res.status(500).json({ message: "Error rejecting stock adjustment", error: error.message });
    }
});

router.patch("/:id/apply", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [adjustments] = await connection.query(
            "SELECT * FROM stock_adjustments WHERE id = ? AND status = 'approved'",
            [req.params.id]
        );
        if (adjustments.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: "Stock adjustment must be approved before applying" });
        }
        const adjustment = adjustments[0];
        const [items] = await connection.query(
            "SELECT * FROM stock_adjustment_items WHERE stockAdjustmentId = ?",
            [req.params.id]
        );
        let rawBatchIdCache = {};
        let finishedBatchIdCache = {};
        for (const item of items) {
            const qty = Number(item.adjustmentQuantity);
            if (item.itemType === 'raw_material') {
                let batchId = null;
                if (item.batchNumber) {
                    const key = `${item.itemId}::${item.batchNumber}`;
                    if (rawBatchIdCache[key] === undefined) {
                        const [b] = await connection.query(
                            "SELECT id FROM raw_material_batches WHERE rawMaterialId = ? AND batchNumber = ?",
                            [item.itemId, item.batchNumber]
                        );
                        rawBatchIdCache[key] = b.length > 0 ? b[0].id : null;
                    }
                    batchId = rawBatchIdCache[key];
                }
                const [stockRows] = await connection.query(
                    "SELECT * FROM raw_material_stock WHERE rawMaterialId = ? AND batchId <=> ? AND locationId = ?",
                    [item.itemId, batchId, item.locationId]
                );
                if (stockRows.length > 0) {
                    await connection.query(
                        "UPDATE raw_material_stock SET quantity = GREATEST(quantity + ?, 0) WHERE id = ?",
                        [qty, stockRows[0].id]
                    );
                } else if (qty > 0) {
                    await connection.query(
                        "INSERT INTO raw_material_stock (rawMaterialId, batchId, locationId, quantity, unitId) VALUES (?, ?, ?, ?, ?)",
                        [item.itemId, batchId, item.locationId, qty, item.unitId]
                    );
                }
                await addRawLedger(connection, {
                    rawMaterialId: item.itemId,
                    batchId,
                    locationId: item.locationId,
                    referenceId: req.params.id,
                    quantityIn: qty > 0 ? qty : 0,
                    quantityOut: qty < 0 ? Math.abs(qty) : 0,
                    remarks: `Stock adjustment (${adjustment.reason})`,
                    createdBy: req.user.id
                });
            } else if (item.itemType === 'finished_product') {
                let batchId = null;
                if (item.batchNumber) {
                    const key = `${item.itemId}::${item.batchNumber}`;
                    if (finishedBatchIdCache[key] === undefined) {
                        const [b] = await connection.query(
                            "SELECT id FROM finished_product_batches WHERE finishedProductId = ? AND batchNumber = ?",
                            [item.itemId, item.batchNumber]
                        );
                        finishedBatchIdCache[key] = b.length > 0 ? b[0].id : null;
                    }
                    batchId = finishedBatchIdCache[key];
                }
                const [stockRows] = await connection.query(
                    "SELECT * FROM finished_product_stock WHERE finishedProductId = ? AND batchId <=> ? AND locationId = ?",
                    [item.itemId, batchId, item.locationId]
                );
                if (stockRows.length > 0) {
                    await connection.query(
                        "UPDATE finished_product_stock SET quantity = GREATEST(quantity + ?, 0) WHERE id = ?",
                        [qty, stockRows[0].id]
                    );
                } else if (qty > 0) {
                    await connection.query(
                        "INSERT INTO finished_product_stock (finishedProductId, batchId, locationId, quantity, unitId) VALUES (?, ?, ?, ?, ?)",
                        [item.itemId, batchId, item.locationId, qty, item.unitId]
                    );
                }
                await addFinishedLedger(connection, {
                    finishedProductId: item.itemId,
                    batchId,
                    locationId: item.locationId,
                    referenceId: req.params.id,
                    quantityIn: qty > 0 ? qty : 0,
                    quantityOut: qty < 0 ? Math.abs(qty) : 0,
                    remarks: `Stock adjustment (${adjustment.reason})`,
                    createdBy: req.user.id
                });
            } else if (item.itemType === 'tool') {
                const [stockRows] = await connection.query(
                    "SELECT * FROM tool_stock WHERE toolId = ? AND locationId = ?",
                    [item.itemId, item.locationId]
                );
                if (stockRows.length > 0) {
                    const newAvailable = Math.max(Number(stockRows[0].availableQuantity) + qty, 0);
                    await connection.query(
                        "UPDATE tool_stock SET availableQuantity = ? WHERE id = ?",
                        [newAvailable, stockRows[0].id]
                    );
                } else if (qty > 0) {
                    await connection.query(
                        "INSERT INTO tool_stock (toolId, locationId, availableQuantity, unitId) VALUES (?, ?, ?, ?)",
                        [item.itemId, item.locationId, qty, item.unitId]
                    );
                }
            }
        }
        await connection.query(
            "UPDATE stock_adjustments SET status = 'applied' WHERE id = ?",
            [req.params.id]
        );
        await connection.commit();
        const [updatedAdjustment] = await pool.query("SELECT * FROM stock_adjustments WHERE id = ?", [req.params.id]);
        res.json(updatedAdjustment[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error applying stock adjustment:", error);
        res.status(500).json({ message: "Error applying stock adjustment", error: error.message });
    } finally {
        connection.release();
    }
});

export default router;