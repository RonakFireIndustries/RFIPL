import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { status, purchaseOrderId, supplierId } = req.query;
        let query = `SELECT gr.*, po.poNumber, s.companyName AS supplierName, emp.firstName AS receivedByName
                     FROM goods_receipts gr
                     LEFT JOIN purchase_orders po ON gr.purchaseOrderId = po.id
                     LEFT JOIN suppliers s ON gr.supplierId = s.id
                     LEFT JOIN employees emp ON gr.receivedBy = emp.id
                     WHERE 1 = 1`;
        const params = [];
        if (status) { query += " AND gr.status = ?"; params.push(status); }
        if (purchaseOrderId) { query += " AND gr.purchaseOrderId = ?"; params.push(purchaseOrderId); }
        if (supplierId) { query += " AND gr.supplierId = ?"; params.push(supplierId); }
        query += " ORDER BY gr.receivedDate DESC";
        const [receipts] = await pool.query(query, params);
        res.json(receipts);
    } catch (error) {
        console.error("Error fetching goods receipts:", error);
        res.status(500).json({ message: "Error fetching goods receipts", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [receipts] = await pool.query(
            `SELECT gr.*, po.poNumber, s.companyName AS supplierName, emp.firstName AS receivedByName
             FROM goods_receipts gr
             LEFT JOIN purchase_orders po ON gr.purchaseOrderId = po.id
             LEFT JOIN suppliers s ON gr.supplierId = s.id
             LEFT JOIN employees emp ON gr.receivedBy = emp.id
             WHERE gr.id = ?`,
            [req.params.id]
        );
        if (receipts.length === 0) {
            return res.status(404).json({ message: "Goods receipt not found" });
        }
        const [items] = await pool.query(
            `SELECT gri.*, rm.name AS rawMaterialName, rm.sku, u.symbol AS unitSymbol, sl.name AS locationName
             FROM goods_receipt_items gri
             LEFT JOIN raw_materials rm ON gri.rawMaterialId = rm.id
             LEFT JOIN inventory_units u ON gri.unitId = u.id
             LEFT JOIN stock_locations sl ON gri.locationId = sl.id
             WHERE gri.goodsReceiptId = ?`,
            [req.params.id]
        );
        receipts[0].items = items;
        res.json(receipts[0]);
    } catch (error) {
        console.error("Error fetching goods receipt:", error);
        res.status(500).json({ message: "Error fetching goods receipt", error: error.message });
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { grnNumber, purchaseOrderId, supplierId, receivedDate, receivedBy, remarks, items } = req.body;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO goods_receipts (grnNumber, purchaseOrderId, supplierId, receivedDate, receivedBy, remarks)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [grnNumber, purchaseOrderId, supplierId, receivedDate, receivedBy, remarks || null]
        );
        if (Array.isArray(items)) {
            for (const item of items) {
                await connection.query(
                    `INSERT INTO goods_receipt_items (goodsReceiptId, purchaseOrderItemId, rawMaterialId, batchNumber, receivedQuantity, unitId, purchasePrice, locationId)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                    [result.insertId, item.purchaseOrderItemId, item.rawMaterialId, item.batchNumber,
                     item.receivedQuantity, item.unitId, item.purchasePrice, item.locationId || null]
                );
                await connection.query(
                    "UPDATE purchase_order_items SET receivedQuantity = receivedQuantity + ? WHERE id = ?",
                    [item.receivedQuantity, item.purchaseOrderItemId]
                );
            }
        }
        const [poItems] = await connection.query(
            "SELECT COUNT(*) AS total, SUM(CASE WHEN receivedQuantity >= orderedQuantity THEN 1 ELSE 0 END) AS fullyReceived FROM purchase_order_items WHERE purchaseOrderId = ?",
            [purchaseOrderId]
        );
        if (Number(poItems[0].total) > 0 && Number(poItems[0].fullyReceived) >= Number(poItems[0].total)) {
            await connection.query("UPDATE purchase_orders SET status = 'received' WHERE id = ?", [purchaseOrderId]);
        } else {
            await connection.query("UPDATE purchase_orders SET status = 'partially_received' WHERE id = ?", [purchaseOrderId]);
        }
        await connection.commit();
        const [newReceipt] = await pool.query("SELECT * FROM goods_receipts WHERE id = ?", [result.insertId]);
        res.status(201).json(newReceipt[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating goods receipt:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "GRN number already exists" });
        }
        res.status(500).json({ message: "Error creating goods receipt", error: error.message });
    } finally {
        connection.release();
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT gri.*, rm.name AS rawMaterialName, rm.sku, u.symbol AS unitSymbol, sl.name AS locationName
             FROM goods_receipt_items gri
             LEFT JOIN raw_materials rm ON gri.rawMaterialId = rm.id
             LEFT JOIN inventory_units u ON gri.unitId = u.id
             LEFT JOIN stock_locations sl ON gri.locationId = sl.id
             WHERE gri.goodsReceiptId = ?`,
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        console.error("Error fetching goods receipt items:", error);
        res.status(500).json({ message: "Error fetching goods receipt items", error: error.message });
    }
});

router.post("/:id/items", async (req, res) => {
    try {
        const { purchaseOrderItemId, rawMaterialId, batchNumber, receivedQuantity, unitId, purchasePrice, locationId } = req.body;
        const [result] = await pool.query(
            `INSERT INTO goods_receipt_items (goodsReceiptId, purchaseOrderItemId, rawMaterialId, batchNumber, receivedQuantity, unitId, purchasePrice, locationId)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, purchaseOrderItemId, rawMaterialId, batchNumber, receivedQuantity, unitId, purchasePrice, locationId || null]
        );
        await pool.query(
            "UPDATE purchase_order_items SET receivedQuantity = receivedQuantity + ? WHERE id = ?",
            [receivedQuantity, purchaseOrderItemId]
        );
        const [newItem] = await pool.query("SELECT * FROM goods_receipt_items WHERE id = ?", [result.insertId]);
        res.status(201).json(newItem[0]);
    } catch (error) {
        console.error("Error adding goods receipt item:", error);
        res.status(500).json({ message: "Error adding goods receipt item", error: error.message });
    }
});

router.patch("/:id/cancel", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE goods_receipts SET status = 'cancelled' WHERE id = ? AND status NOT IN ('qc_completed', 'cancelled')",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Goods receipt cannot be cancelled" });
        }
        const [updatedReceipt] = await pool.query("SELECT * FROM goods_receipts WHERE id = ?", [req.params.id]);
        res.json(updatedReceipt[0]);
    } catch (error) {
        console.error("Error cancelling goods receipt:", error);
        res.status(500).json({ message: "Error cancelling goods receipt", error: error.message });
    }
});

export default router;