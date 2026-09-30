import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { status, supplierId, purchaseRequestId } = req.query;
        let query = `SELECT po.*, s.companyName AS supplierName, pr.requestNumber
                     FROM purchase_orders po
                     LEFT JOIN suppliers s ON po.supplierId = s.id
                     LEFT JOIN purchase_requests pr ON po.purchaseRequestId = pr.id
                     WHERE po.deletedAt IS NULL`;
        const params = [];
        if (status) { query += " AND po.status = ?"; params.push(status); }
        if (supplierId) { query += " AND po.supplierId = ?"; params.push(supplierId); }
        if (purchaseRequestId) { query += " AND po.purchaseRequestId = ?"; params.push(purchaseRequestId); }
        query += " ORDER BY po.orderDate DESC";
        const [orders] = await pool.query(query, params);
        res.json(orders);
    } catch (error) {
        console.error("Error fetching purchase orders:", error);
        res.status(500).json({ message: "Error fetching purchase orders", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [orders] = await pool.query(
            `SELECT po.*, s.companyName AS supplierName, pr.requestNumber
             FROM purchase_orders po
             LEFT JOIN suppliers s ON po.supplierId = s.id
             LEFT JOIN purchase_requests pr ON po.purchaseRequestId = pr.id
             WHERE po.id = ? AND po.deletedAt IS NULL`,
            [req.params.id]
        );
        if (orders.length === 0) {
            return res.status(404).json({ message: "Purchase order not found" });
        }
        const [items] = await pool.query(
            `SELECT poi.*, rm.name AS rawMaterialName, rm.sku, u.symbol AS unitSymbol
             FROM purchase_order_items poi
             LEFT JOIN raw_materials rm ON poi.rawMaterialId = rm.id
             LEFT JOIN inventory_units u ON poi.unitId = u.id
             WHERE poi.purchaseOrderId = ?`,
            [req.params.id]
        );
        orders[0].items = items;
        res.json(orders[0]);
    } catch (error) {
        console.error("Error fetching purchase order:", error);
        res.status(500).json({ message: "Error fetching purchase order", error: error.message });
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { poNumber, purchaseRequestId, supplierId, orderDate, expectedDeliveryDate, items, createdBy } = req.body;
        const totalAmount = Array.isArray(items)
            ? items.reduce((sum, it) => sum + (Number(it.unitPrice) * Number(it.orderedQuantity)), 0)
            : 0;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO purchase_orders (poNumber, purchaseRequestId, supplierId, orderDate, expectedDeliveryDate, totalAmount, createdBy)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [poNumber, purchaseRequestId || null, supplierId, orderDate, expectedDeliveryDate || null, totalAmount, createdBy]
        );
        if (Array.isArray(items)) {
            for (const item of items) {
                const itemTotal = Number(item.unitPrice) * Number(item.orderedQuantity);
                await connection.query(
                    `INSERT INTO purchase_order_items (purchaseOrderId, rawMaterialId, orderedQuantity, unitId, unitPrice, totalAmount)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [result.insertId, item.rawMaterialId, item.orderedQuantity, item.unitId, item.unitPrice, itemTotal]
                );
            }
        }
        await connection.commit();
        const [newOrder] = await pool.query("SELECT * FROM purchase_orders WHERE id = ?", [result.insertId]);
        res.status(201).json(newOrder[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating purchase order:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Purchase order number already exists" });
        }
        res.status(500).json({ message: "Error creating purchase order", error: error.message });
    } finally {
        connection.release();
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { purchaseRequestId, supplierId, orderDate, expectedDeliveryDate } = req.body;
        const [result] = await pool.query(
            "UPDATE purchase_orders SET purchaseRequestId = ?, supplierId = ?, orderDate = ?, expectedDeliveryDate = ? WHERE id = ? AND deletedAt IS NULL",
            [purchaseRequestId || null, supplierId, orderDate, expectedDeliveryDate || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Purchase order not found" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM purchase_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error updating purchase order:", error);
        res.status(500).json({ message: "Error updating purchase order", error: error.message });
    }
});

router.patch("/:id/submit", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE purchase_orders SET status = 'pending_admin' WHERE id = ? AND status = 'draft' AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Purchase order cannot be submitted" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM purchase_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error submitting purchase order:", error);
        res.status(500).json({ message: "Error submitting purchase order", error: error.message });
    }
});

router.patch("/:id/approve", async (req, res) => {
    try {
        const { adminApprovedBy, adminRemarks } = req.body;
        const [result] = await pool.query(
            "UPDATE purchase_orders SET status = 'approved', adminApprovedBy = ?, adminApprovedAt = NOW(), adminRemarks = ? WHERE id = ? AND status = 'pending_admin' AND deletedAt IS NULL",
            [adminApprovedBy || null, adminRemarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Purchase order cannot be approved" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM purchase_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error approving purchase order:", error);
        res.status(500).json({ message: "Error approving purchase order", error: error.message });
    }
});

router.patch("/:id/reject", async (req, res) => {
    try {
        const { adminRemarks } = req.body;
        const [result] = await pool.query(
            "UPDATE purchase_orders SET status = 'rejected', adminRemarks = ? WHERE id = ? AND status = 'pending_admin' AND deletedAt IS NULL",
            [adminRemarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Purchase order cannot be rejected" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM purchase_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error rejecting purchase order:", error);
        res.status(500).json({ message: "Error rejecting purchase order", error: error.message });
    }
});

router.patch("/:id/cancel", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE purchase_orders SET status = 'cancelled' WHERE id = ? AND deletedAt IS NULL AND status NOT IN ('received', 'cancelled')",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Purchase order cannot be cancelled" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM purchase_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error cancelling purchase order:", error);
        res.status(500).json({ message: "Error cancelling purchase order", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE purchase_orders SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL AND status = 'draft'",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Purchase order not found or cannot be deleted" });
        }
        res.json({ message: "Purchase order deleted successfully" });
    } catch (error) {
        console.error("Error deleting purchase order:", error);
        res.status(500).json({ message: "Error deleting purchase order", error: error.message });
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT poi.*, rm.name AS rawMaterialName, rm.sku, u.symbol AS unitSymbol
             FROM purchase_order_items poi
             LEFT JOIN raw_materials rm ON poi.rawMaterialId = rm.id
             LEFT JOIN inventory_units u ON poi.unitId = u.id
             WHERE poi.purchaseOrderId = ?`,
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        console.error("Error fetching purchase order items:", error);
        res.status(500).json({ message: "Error fetching purchase order items", error: error.message });
    }
});

router.post("/:id/items", async (req, res) => {
    try {
        const { rawMaterialId, orderedQuantity, unitId, unitPrice } = req.body;
        const totalAmount = Number(unitPrice) * Number(orderedQuantity);
        const [result] = await pool.query(
            "INSERT INTO purchase_order_items (purchaseOrderId, rawMaterialId, orderedQuantity, unitId, unitPrice, totalAmount) VALUES (?, ?, ?, ?, ?, ?)",
            [req.params.id, rawMaterialId, orderedQuantity, unitId, unitPrice, totalAmount]
        );
        await pool.query(
            "UPDATE purchase_orders SET totalAmount = totalAmount + ? WHERE id = ?",
            [totalAmount, req.params.id]
        );
        const [newItem] = await pool.query("SELECT * FROM purchase_order_items WHERE id = ?", [result.insertId]);
        res.status(201).json(newItem[0]);
    } catch (error) {
        console.error("Error adding purchase order item:", error);
        res.status(500).json({ message: "Error adding purchase order item", error: error.message });
    }
});

router.put("/:id/items/:itemId", async (req, res) => {
    try {
        const { rawMaterialId, orderedQuantity, unitId, unitPrice } = req.body;
        const totalAmount = Number(unitPrice) * Number(orderedQuantity);
        const [result] = await pool.query(
            "UPDATE purchase_order_items SET rawMaterialId = ?, orderedQuantity = ?, unitId = ?, unitPrice = ?, totalAmount = ? WHERE id = ? AND purchaseOrderId = ?",
            [rawMaterialId, orderedQuantity, unitId, unitPrice, totalAmount, req.params.itemId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Purchase order item not found" });
        }
        const [updatedItem] = await pool.query("SELECT * FROM purchase_order_items WHERE id = ?", [req.params.itemId]);
        res.json(updatedItem[0]);
    } catch (error) {
        console.error("Error updating purchase order item:", error);
        res.status(500).json({ message: "Error updating purchase order item", error: error.message });
    }
});

router.delete("/:id/items/:itemId", async (req, res) => {
    try {
        const [existing] = await pool.query("SELECT * FROM purchase_order_items WHERE id = ?", [req.params.itemId]);
        if (existing.length === 0) {
            return res.status(404).json({ message: "Purchase order item not found" });
        }
        await pool.query(
            "UPDATE purchase_orders SET totalAmount = GREATEST(totalAmount - ?, 0) WHERE id = ?",
            [existing[0].totalAmount, req.params.id]
        );
        await pool.query("DELETE FROM purchase_order_items WHERE id = ? AND purchaseOrderId = ?", [req.params.itemId, req.params.id]);
        res.json({ message: "Purchase order item deleted successfully" });
    } catch (error) {
        console.error("Error deleting purchase order item:", error);
        res.status(500).json({ message: "Error deleting purchase order item", error: error.message });
    }
});

export default router;