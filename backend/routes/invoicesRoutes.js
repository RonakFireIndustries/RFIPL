import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { customerId, status, salesOrderId } = req.query;
        let query = `SELECT i.*, so.salesOrderNumber, d.dispatchNumber, c.companyName AS customerName
                     FROM invoices i
                     LEFT JOIN sales_orders so ON i.salesOrderId = so.id
                     LEFT JOIN dispatches d ON i.dispatchId = d.id
                     LEFT JOIN customers c ON i.customerId = c.id
                     WHERE 1 = 1`;
        const params = [];
        if (customerId) { query += " AND i.customerId = ?"; params.push(customerId); }
        if (status) { query += " AND i.status = ?"; params.push(status); }
        if (salesOrderId) { query += " AND i.salesOrderId = ?"; params.push(salesOrderId); }
        query += " ORDER BY i.invoiceDate DESC";
        const [invoices] = await pool.query(query, params);
        res.json(invoices);
    } catch (error) {
        console.error("Error fetching invoices:", error);
        res.status(500).json({ message: "Error fetching invoices", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [invoices] = await pool.query(
            `SELECT i.*, so.salesOrderNumber, d.dispatchNumber, c.companyName AS customerName
             FROM invoices i
             LEFT JOIN sales_orders so ON i.salesOrderId = so.id
             LEFT JOIN dispatches d ON i.dispatchId = d.id
             LEFT JOIN customers c ON i.customerId = c.id
             WHERE i.id = ?`,
            [req.params.id]
        );
        if (invoices.length === 0) {
            return res.status(404).json({ message: "Invoice not found" });
        }
        const [items] = await pool.query(
            `SELECT ii.*, fp.name AS finishedProductName, fp.sku, u.symbol AS unitSymbol
             FROM invoice_items ii
             LEFT JOIN finished_products fp ON ii.finishedProductId = fp.id
             LEFT JOIN inventory_units u ON ii.unitId = u.id
             WHERE ii.invoiceId = ?`,
            [req.params.id]
        );
        const [payments] = await pool.query(
            "SELECT * FROM customer_payments WHERE invoiceId = ? ORDER BY paymentDate DESC",
            [req.params.id]
        );
        invoices[0].items = items;
        invoices[0].payments = payments;
        res.json(invoices[0]);
    } catch (error) {
        console.error("Error fetching invoice:", error);
        res.status(500).json({ message: "Error fetching invoice", error: error.message });
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { invoiceNumber, salesOrderId, dispatchId, customerId, invoiceDate, createdBy, items } = req.body;
        const totalAmount = Array.isArray(items)
            ? items.reduce((sum, it) => sum + (Number(it.unitPrice) * Number(it.quantity)), 0)
            : 0;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO invoices (invoiceNumber, salesOrderId, dispatchId, customerId, invoiceDate, totalAmount, paidAmount, balanceAmount, status, createdBy)
             VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'unpaid', ?)`,
            [invoiceNumber, salesOrderId, dispatchId || null, customerId, invoiceDate, totalAmount, totalAmount, createdBy]
        );
        if (Array.isArray(items)) {
            for (const item of items) {
                const itemTotal = Number(item.unitPrice) * Number(item.quantity);
                await connection.query(
                    `INSERT INTO invoice_items (invoiceId, finishedProductId, quantity, unitId, unitPrice, totalAmount)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [result.insertId, item.finishedProductId, item.quantity, item.unitId, item.unitPrice, itemTotal]
                );
            }
        }
        await connection.commit();
        const [newInvoice] = await pool.query("SELECT * FROM invoices WHERE id = ?", [result.insertId]);
        res.status(201).json(newInvoice[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating invoice:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Invoice number already exists" });
        }
        res.status(500).json({ message: "Error creating invoice", error: error.message });
    } finally {
        connection.release();
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT ii.*, fp.name AS finishedProductName, fp.sku, u.symbol AS unitSymbol
             FROM invoice_items ii
             LEFT JOIN finished_products fp ON ii.finishedProductId = fp.id
             LEFT JOIN inventory_units u ON ii.unitId = u.id
             WHERE ii.invoiceId = ?`,
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        console.error("Error fetching invoice items:", error);
        res.status(500).json({ message: "Error fetching invoice items", error: error.message });
    }
});

router.post("/:id/items", async (req, res) => {
    try {
        const { finishedProductId, quantity, unitId, unitPrice } = req.body;
        const totalAmount = Number(unitPrice) * Number(quantity);
        const [result] = await pool.query(
            "INSERT INTO invoice_items (invoiceId, finishedProductId, quantity, unitId, unitPrice, totalAmount) VALUES (?, ?, ?, ?, ?, ?)",
            [req.params.id, finishedProductId, quantity, unitId, unitPrice, totalAmount]
        );
        await pool.query(
            "UPDATE invoices SET totalAmount = totalAmount + ?, balanceAmount = balanceAmount + ? WHERE id = ?",
            [totalAmount, totalAmount, req.params.id]
        );
        const [newItem] = await pool.query("SELECT * FROM invoice_items WHERE id = ?", [result.insertId]);
        res.status(201).json(newItem[0]);
    } catch (error) {
        console.error("Error adding invoice item:", error);
        res.status(500).json({ message: "Error adding invoice item", error: error.message });
    }
});

router.get("/:id/payments", async (req, res) => {
    try {
        const [payments] = await pool.query(
            "SELECT * FROM customer_payments WHERE invoiceId = ? ORDER BY paymentDate DESC",
            [req.params.id]
        );
        res.json(payments);
    } catch (error) {
        console.error("Error fetching customer payments:", error);
        res.status(500).json({ message: "Error fetching customer payments", error: error.message });
    }
});

router.post("/:id/payments", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { paymentNumber, customerId, paymentDate, amount, paymentMethod, referenceNumber, remarks, receivedBy } = req.body;
        await connection.beginTransaction();
        const [invoiceRows] = await connection.query("SELECT * FROM invoices WHERE id = ?", [req.params.id]);
        if (invoiceRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Invoice not found" });
        }
        const invoice = invoiceRows[0];
        if (Number(amount) > Number(invoice.balanceAmount)) {
            await connection.rollback();
            return res.status(400).json({ message: "Payment amount exceeds invoice balance" });
        }
        const [result] = await connection.query(
            `INSERT INTO customer_payments (paymentNumber, invoiceId, customerId, paymentDate, amount, paymentMethod, referenceNumber, remarks, receivedBy)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [paymentNumber, req.params.id, customerId, paymentDate, amount, paymentMethod, referenceNumber || null, remarks || null, receivedBy || null]
        );
        const newPaid = Number(invoice.paidAmount) + Number(amount);
        const newBalance = Number(invoice.balanceAmount) - Number(amount);
        let newStatus = 'partially_paid';
        if (newBalance <= 0) newStatus = 'paid';
        await connection.query(
            "UPDATE invoices SET paidAmount = ?, balanceAmount = ?, status = ? WHERE id = ?",
            [newPaid, newBalance, newStatus, req.params.id]
        );
        await connection.commit();
        const [newPayment] = await pool.query("SELECT * FROM customer_payments WHERE id = ?", [result.insertId]);
        res.status(201).json(newPayment[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error recording customer payment:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Payment number already exists" });
        }
        res.status(500).json({ message: "Error recording customer payment", error: error.message });
    } finally {
        connection.release();
    }
});

router.patch("/:id/cancel", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE invoices SET status = 'cancelled' WHERE id = ? AND status IN ('unpaid', 'partially_paid')",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Invoice cannot be cancelled" });
        }
        const [updatedInvoice] = await pool.query("SELECT * FROM invoices WHERE id = ?", [req.params.id]);
        res.json(updatedInvoice[0]);
    } catch (error) {
        console.error("Error cancelling invoice:", error);
        res.status(500).json({ message: "Error cancelling invoice", error: error.message });
    }
});

export default router;