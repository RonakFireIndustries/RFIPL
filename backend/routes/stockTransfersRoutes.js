import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

const resolveRawBatchId = async (db, rawMaterialId, batchNumber) => {
    if (!batchNumber) return null;
    const [batches] = await db.query(
        "SELECT id FROM raw_material_batches WHERE rawMaterialId = ? AND batchNumber = ?",
        [rawMaterialId, batchNumber]
    );
    return batches.length > 0 ? batches[0].id : null;
};

const resolveFinishedBatchId = async (db, finishedProductId, batchNumber) => {
    if (!batchNumber) return null;
    const [batches] = await db.query(
        "SELECT id FROM finished_product_batches WHERE finishedProductId = ? AND batchNumber = ?",
        [finishedProductId, batchNumber]
    );
    return batches.length > 0 ? batches[0].id : null;
};

router.get("/", async (req, res) => {
    try {
        const { status, inventoryType, fromLocationId } = req.query;
        let query = `SELECT st.*, fl.name AS fromLocationName, tl.name AS toLocationName, emp.firstName, emp.lastName
                     FROM stock_transfers st
                     LEFT JOIN stock_locations fl ON st.fromLocationId = fl.id
                     LEFT JOIN stock_locations tl ON st.toLocationId = tl.id
                     LEFT JOIN employees emp ON st.transferredBy = emp.id
                     WHERE 1 = 1`;
        const params = [];
        if (status) { query += " AND st.status = ?"; params.push(status); }
        if (inventoryType) { query += " AND st.inventoryType = ?"; params.push(inventoryType); }
        if (fromLocationId) { query += " AND st.fromLocationId = ?"; params.push(fromLocationId); }
        query += " ORDER BY st.transferDate DESC";
        const [transfers] = await pool.query(query, params);
        res.json(transfers);
    } catch (error) {
        console.error("Error fetching stock transfers:", error);
        res.status(500).json({ message: "Error fetching stock transfers", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [transfers] = await pool.query(
            `SELECT st.*, fl.name AS fromLocationName, tl.name AS toLocationName, emp.firstName, emp.lastName
             FROM stock_transfers st
             LEFT JOIN stock_locations fl ON st.fromLocationId = fl.id
             LEFT JOIN stock_locations tl ON st.toLocationId = tl.id
             LEFT JOIN employees emp ON st.transferredBy = emp.id
             WHERE st.id = ?`,
            [req.params.id]
        );
        if (transfers.length === 0) {
            return res.status(404).json({ message: "Stock transfer not found" });
        }
        const [items] = await pool.query(
            "SELECT * FROM stock_transfer_items WHERE stockTransferId = ?",
            [req.params.id]
        );
        transfers[0].items = items;
        res.json(transfers[0]);
    } catch (error) {
        console.error("Error fetching stock transfer:", error);
        res.status(500).json({ message: "Error fetching stock transfer", error: error.message });
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { transferNumber, inventoryType, fromLocationId, toLocationId, transferDate, transferredBy, remarks, items } = req.body;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO stock_transfers (transferNumber, inventoryType, fromLocationId, toLocationId, transferDate, transferredBy, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [transferNumber, inventoryType, fromLocationId, toLocationId, transferDate || new Date(), transferredBy, remarks || null]
        );
        if (Array.isArray(items)) {
            for (const item of items) {
                await connection.query(
                    `INSERT INTO stock_transfer_items (stockTransferId, itemType, itemId, batchNumber, quantity, unitId)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [result.insertId, item.itemType || inventoryType, item.itemId, item.batchNumber || null, item.quantity, item.unitId]
                );
                if ((item.itemType || inventoryType) === 'raw_material') {
                    const batchId = await resolveRawBatchId(connection, item.itemId, item.batchNumber);
                    const [fromStock] = await connection.query(
                        "SELECT * FROM raw_material_stock WHERE rawMaterialId = ? AND batchId <=> ? AND locationId = ?",
                        [item.itemId, batchId, fromLocationId]
                    );
                    if (fromStock.length > 0) {
                        await connection.query(
                            "UPDATE raw_material_stock SET quantity = GREATEST(quantity - ?, 0) WHERE id = ?",
                            [item.quantity, fromStock[0].id]
                        );
                    }
                    const [toStock] = await connection.query(
                        "SELECT * FROM raw_material_stock WHERE rawMaterialId = ? AND batchId <=> ? AND locationId = ?",
                        [item.itemId, batchId, toLocationId]
                    );
                    if (toStock.length > 0) {
                        await connection.query(
                            "UPDATE raw_material_stock SET quantity = quantity + ? WHERE id = ?",
                            [item.quantity, toStock[0].id]
                        );
                    } else {
                        await connection.query(
                            "INSERT INTO raw_material_stock (rawMaterialId, batchId, locationId, quantity, unitId) VALUES (?, ?, ?, ?, ?)",
                            [item.itemId, batchId, toLocationId, item.quantity, item.unitId]
                        );
                    }
                    await connection.query(
                        `INSERT INTO raw_material_stock_ledger (rawMaterialId, batchId, locationId, transactionType, referenceType, referenceId, quantityOut, createdBy)
                         VALUES (?, ?, ?, 'transfer_out', 'stock_transfer', ?, ?, ?)`,
                        [item.itemId, batchId, fromLocationId, result.insertId, item.quantity, req.user.id]
                    );
                    await connection.query(
                        `INSERT INTO raw_material_stock_ledger (rawMaterialId, batchId, locationId, transactionType, referenceType, referenceId, quantityIn, createdBy)
                         VALUES (?, ?, ?, 'transfer_in', 'stock_transfer', ?, ?, ?)`,
                        [item.itemId, batchId, toLocationId, result.insertId, item.quantity, req.user.id]
                    );
                } else if ((item.itemType || inventoryType) === 'finished_product') {
                    const batchId = await resolveFinishedBatchId(connection, item.itemId, item.batchNumber);
                    const [fromStock] = await connection.query(
                        "SELECT * FROM finished_product_stock WHERE finishedProductId = ? AND batchId <=> ? AND locationId = ?",
                        [item.itemId, batchId, fromLocationId]
                    );
                    if (fromStock.length > 0) {
                        await connection.query(
                            "UPDATE finished_product_stock SET quantity = GREATEST(quantity - ?, 0) WHERE id = ?",
                            [item.quantity, fromStock[0].id]
                        );
                    }
                    const [toStock] = await connection.query(
                        "SELECT * FROM finished_product_stock WHERE finishedProductId = ? AND batchId <=> ? AND locationId = ?",
                        [item.itemId, batchId, toLocationId]
                    );
                    if (toStock.length > 0) {
                        await connection.query(
                            "UPDATE finished_product_stock SET quantity = quantity + ? WHERE id = ?",
                            [item.quantity, toStock[0].id]
                        );
                    } else {
                        await connection.query(
                            "INSERT INTO finished_product_stock (finishedProductId, batchId, locationId, quantity, unitId) VALUES (?, ?, ?, ?, ?)",
                            [item.itemId, batchId, toLocationId, item.quantity, item.unitId]
                        );
                    }
                    await connection.query(
                        `INSERT INTO finished_product_stock_ledger (finishedProductId, batchId, locationId, transactionType, referenceType, referenceId, quantityOut, createdBy)
                         VALUES (?, ?, ?, 'transfer_out', 'stock_transfer', ?, ?, ?)`,
                        [item.itemId, batchId, fromLocationId, result.insertId, item.quantity, req.user.id]
                    );
                    await connection.query(
                        `INSERT INTO finished_product_stock_ledger (finishedProductId, batchId, locationId, transactionType, referenceType, referenceId, quantityIn, createdBy)
                         VALUES (?, ?, ?, 'transfer_in', 'stock_transfer', ?, ?, ?)`,
                        [item.itemId, batchId, toLocationId, result.insertId, item.quantity, req.user.id]
                    );
                } else if ((item.itemType || inventoryType) === 'tool') {
                    const [fromStock] = await connection.query(
                        "SELECT * FROM tool_stock WHERE toolId = ? AND locationId = ?",
                        [item.itemId, fromLocationId]
                    );
                    if (fromStock.length > 0) {
                        await connection.query(
                            "UPDATE tool_stock SET availableQuantity = GREATEST(availableQuantity - ?, 0) WHERE id = ?",
                            [item.quantity, fromStock[0].id]
                        );
                    }
                    const [toStock] = await connection.query(
                        "SELECT * FROM tool_stock WHERE toolId = ? AND locationId = ?",
                        [item.itemId, toLocationId]
                    );
                    if (toStock.length > 0) {
                        await connection.query(
                            "UPDATE tool_stock SET availableQuantity = availableQuantity + ? WHERE id = ?",
                            [item.quantity, toStock[0].id]
                        );
                    } else {
                        await connection.query(
                            "INSERT INTO tool_stock (toolId, locationId, availableQuantity, unitId) VALUES (?, ?, ?, ?)",
                            [item.itemId, toLocationId, item.quantity, item.unitId]
                        );
                    }
                }
            }
        }
        await connection.commit();
        const [newTransfer] = await pool.query("SELECT * FROM stock_transfers WHERE id = ?", [result.insertId]);
        res.status(201).json(newTransfer[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating stock transfer:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Transfer number already exists" });
        }
        res.status(500).json({ message: "Error creating stock transfer", error: error.message });
    } finally {
        connection.release();
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            "SELECT * FROM stock_transfer_items WHERE stockTransferId = ?",
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        console.error("Error fetching transfer items:", error);
        res.status(500).json({ message: "Error fetching transfer items", error: error.message });
    }
});

router.patch("/:id/cancel", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE stock_transfers SET status = 'cancelled' WHERE id = ? AND status = 'completed'",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Stock transfer cannot be cancelled" });
        }
        const [updatedTransfer] = await pool.query("SELECT * FROM stock_transfers WHERE id = ?", [req.params.id]);
        res.json(updatedTransfer[0]);
    } catch (error) {
        console.error("Error cancelling stock transfer:", error);
        res.status(500).json({ message: "Error cancelling stock transfer", error: error.message });
    }
});

export default router;