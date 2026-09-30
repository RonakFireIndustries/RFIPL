import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { status, customerId } = req.query;
        let query = `SELECT so.*, c.companyName AS customerName, c.customerCode, emp.firstName, emp.lastName
                     FROM sales_orders so
                     LEFT JOIN customers c ON so.customerId = c.id
                     LEFT JOIN employees emp ON so.createdBy = emp.id
                     WHERE so.deletedAt IS NULL`;
        const params = [];
        if (status) { query += " AND so.status = ?"; params.push(status); }
        if (customerId) { query += " AND so.customerId = ?"; params.push(customerId); }
        query += " ORDER BY so.orderDate DESC";
        const [orders] = await pool.query(query, params);
        res.json(orders);
    } catch (error) {
        console.error("Error fetching sales orders:", error);
        res.status(500).json({ message: "Error fetching sales orders", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [orders] = await pool.query(
            `SELECT so.*, c.companyName AS customerName, c.customerCode, emp.firstName, emp.lastName
             FROM sales_orders so
             LEFT JOIN customers c ON so.customerId = c.id
             LEFT JOIN employees emp ON so.createdBy = emp.id
             WHERE so.id = ? AND so.deletedAt IS NULL`,
            [req.params.id]
        );
        if (orders.length === 0) {
            return res.status(404).json({ message: "Sales order not found" });
        }
        const [items] = await pool.query(
            `SELECT soi.*, fp.name AS finishedProductName, fp.sku, u.symbol AS unitSymbol
             FROM sales_order_items soi
             LEFT JOIN finished_products fp ON soi.finishedProductId = fp.id
             LEFT JOIN inventory_units u ON soi.unitId = u.id
             WHERE soi.salesOrderId = ?`,
            [req.params.id]
        );
        orders[0].items = items;
        res.json(orders[0]);
    } catch (error) {
        console.error("Error fetching sales order:", error);
        res.status(500).json({ message: "Error fetching sales order", error: error.message });
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { salesOrderNumber, customerId, orderDate, expectedDispatchDate, status, createdBy, items } = req.body;
        const totalAmount = Array.isArray(items)
            ? items.reduce((sum, it) => sum + (Number(it.unitPrice) * Number(it.orderedQuantity)), 0)
            : 0;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO sales_orders (salesOrderNumber, customerId, orderDate, expectedDispatchDate, totalAmount, status, createdBy)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [salesOrderNumber, customerId, orderDate, expectedDispatchDate || null, totalAmount, status || 'draft', createdBy]
        );
        if (Array.isArray(items)) {
            for (const item of items) {
                const itemTotal = Number(item.unitPrice) * Number(item.orderedQuantity);
                await connection.query(
                    `INSERT INTO sales_order_items (salesOrderId, finishedProductId, orderedQuantity, unitId, unitPrice, totalAmount)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [result.insertId, item.finishedProductId, item.orderedQuantity, item.unitId, item.unitPrice, itemTotal]
                );
            }
        }
        await connection.commit();
        const [newOrder] = await pool.query("SELECT * FROM sales_orders WHERE id = ?", [result.insertId]);
        res.status(201).json(newOrder[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating sales order:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Sales order number already exists" });
        }
        res.status(500).json({ message: "Error creating sales order", error: error.message });
    } finally {
        connection.release();
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { customerId, orderDate, expectedDispatchDate } = req.body;
        const [result] = await pool.query(
            "UPDATE sales_orders SET customerId = ?, orderDate = ?, expectedDispatchDate = ? WHERE id = ? AND deletedAt IS NULL",
            [customerId, orderDate, expectedDispatchDate || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Sales order not found" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM sales_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error updating sales order:", error);
        res.status(500).json({ message: "Error updating sales order", error: error.message });
    }
});

router.patch("/:id/submit", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE sales_orders SET status = 'pending_manager' WHERE id = ? AND status = 'draft' AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Sales order cannot be submitted" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM sales_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error submitting sales order:", error);
        res.status(500).json({ message: "Error submitting sales order", error: error.message });
    }
});

router.patch("/:id/approve", async (req, res) => {
    try {
        const { managerApprovedBy, managerRemarks } = req.body;
        const [result] = await pool.query(
            "UPDATE sales_orders SET status = 'approved', managerApprovedBy = ?, managerApprovedAt = NOW(), managerRemarks = ? WHERE id = ? AND status = 'pending_manager' AND deletedAt IS NULL",
            [managerApprovedBy || null, managerRemarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Sales order cannot be approved" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM sales_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error approving sales order:", error);
        res.status(500).json({ message: "Error approving sales order", error: error.message });
    }
});

router.patch("/:id/reject", async (req, res) => {
    try {
        const { managerRemarks } = req.body;
        const [result] = await pool.query(
            "UPDATE sales_orders SET status = 'rejected', managerRemarks = ? WHERE id = ? AND status = 'pending_manager' AND deletedAt IS NULL",
            [managerRemarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Sales order cannot be rejected" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM sales_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error rejecting sales order:", error);
        res.status(500).json({ message: "Error rejecting sales order", error: error.message });
    }
});

router.patch("/:id/cancel", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE sales_orders SET status = 'cancelled' WHERE id = ? AND deletedAt IS NULL AND status NOT IN ('completed', 'cancelled')",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Sales order cannot be cancelled" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM sales_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error cancelling sales order:", error);
        res.status(500).json({ message: "Error cancelling sales order", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE sales_orders SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL AND status = 'draft'",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Sales order not found or cannot be deleted" });
        }
        res.json({ message: "Sales order deleted successfully" });
    } catch (error) {
        console.error("Error deleting sales order:", error);
        res.status(500).json({ message: "Error deleting sales order", error: error.message });
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT soi.*, fp.name AS finishedProductName, fp.sku, u.symbol AS unitSymbol
             FROM sales_order_items soi
             LEFT JOIN finished_products fp ON soi.finishedProductId = fp.id
             LEFT JOIN inventory_units u ON soi.unitId = u.id
             WHERE soi.salesOrderId = ?`,
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        console.error("Error fetching sales order items:", error);
        res.status(500).json({ message: "Error fetching sales order items", error: error.message });
    }
});

router.post("/:id/items", async (req, res) => {
    try {
        const { finishedProductId, orderedQuantity, unitId, unitPrice } = req.body;
        const totalAmount = Number(unitPrice) * Number(orderedQuantity);
        const [result] = await pool.query(
            "INSERT INTO sales_order_items (salesOrderId, finishedProductId, orderedQuantity, unitId, unitPrice, totalAmount) VALUES (?, ?, ?, ?, ?, ?)",
            [req.params.id, finishedProductId, orderedQuantity, unitId, unitPrice, totalAmount]
        );
        await pool.query("UPDATE sales_orders SET totalAmount = totalAmount + ? WHERE id = ?", [totalAmount, req.params.id]);
        const [newItem] = await pool.query("SELECT * FROM sales_order_items WHERE id = ?", [result.insertId]);
        res.status(201).json(newItem[0]);
    } catch (error) {
        console.error("Error adding sales order item:", error);
        res.status(500).json({ message: "Error adding sales order item", error: error.message });
    }
});

router.put("/:id/items/:itemId", async (req, res) => {
    try {
        const { finishedProductId, orderedQuantity, unitId, unitPrice } = req.body;
        const totalAmount = Number(unitPrice) * Number(orderedQuantity);
        const [result] = await pool.query(
            "UPDATE sales_order_items SET finishedProductId = ?, orderedQuantity = ?, unitId = ?, unitPrice = ?, totalAmount = ? WHERE id = ? AND salesOrderId = ?",
            [finishedProductId, orderedQuantity, unitId, unitPrice, totalAmount, req.params.itemId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Sales order item not found" });
        }
        const [updatedItem] = await pool.query("SELECT * FROM sales_order_items WHERE id = ?", [req.params.itemId]);
        res.json(updatedItem[0]);
    } catch (error) {
        console.error("Error updating sales order item:", error);
        res.status(500).json({ message: "Error updating sales order item", error: error.message });
    }
});

router.delete("/:id/items/:itemId", async (req, res) => {
    try {
        const [existing] = await pool.query("SELECT * FROM sales_order_items WHERE id = ?", [req.params.itemId]);
        if (existing.length === 0) {
            return res.status(404).json({ message: "Sales order item not found" });
        }
        await pool.query("UPDATE sales_orders SET totalAmount = GREATEST(totalAmount - ?, 0) WHERE id = ?", [existing[0].totalAmount, req.params.id]);
        await pool.query("DELETE FROM sales_order_items WHERE id = ? AND salesOrderId = ?", [req.params.itemId, req.params.id]);
        res.json({ message: "Sales order item deleted successfully" });
    } catch (error) {
        console.error("Error deleting sales order item:", error);
        res.status(500).json({ message: "Error deleting sales order item", error: error.message });
    }
});

export default router;