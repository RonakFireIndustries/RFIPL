import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

const addFinishedLedger = async (db, entry) => {
    await db.query(
        `INSERT INTO finished_product_stock_ledger (finishedProductId, batchId, locationId, transactionType, referenceType, referenceId, quantityIn, quantityOut, unitCost, remarks, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [entry.finishedProductId, entry.batchId || null, entry.locationId || null, entry.transactionType,
         entry.referenceType || null, entry.referenceId || null,
         entry.quantityIn || 0, entry.quantityOut || 0, entry.unitCost || null, entry.remarks || null, entry.createdBy]
    );
};

router.get("/", async (req, res) => {
    try {
        const { customerId, status, salesOrderId } = req.query;
        let query = `SELECT cr.*, c.companyName AS customerName, so.salesOrderNumber, i.invoiceNumber, sl.name AS receivedLocationName
                     FROM customer_returns cr
                     LEFT JOIN customers c ON cr.customerId = c.id
                     LEFT JOIN sales_orders so ON cr.salesOrderId = so.id
                     LEFT JOIN invoices i ON cr.invoiceId = i.id
                     LEFT JOIN stock_locations sl ON cr.receivedLocationId = sl.id
                     WHERE 1 = 1`;
        const params = [];
        if (customerId) { query += " AND cr.customerId = ?"; params.push(customerId); }
        if (status) { query += " AND cr.status = ?"; params.push(status); }
        if (salesOrderId) { query += " AND cr.salesOrderId = ?"; params.push(salesOrderId); }
        query += " ORDER BY cr.returnDate DESC";
        const [returns] = await pool.query(query, params);
        res.json(returns);
    } catch (error) {
        console.error("Error fetching customer returns:", error);
        res.status(500).json({ message: "Error fetching customer returns", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [returns] = await pool.query(
            `SELECT cr.*, c.companyName AS customerName, so.salesOrderNumber, i.invoiceNumber, sl.name AS receivedLocationName
             FROM customer_returns cr
             LEFT JOIN customers c ON cr.customerId = c.id
             LEFT JOIN sales_orders so ON cr.salesOrderId = so.id
             LEFT JOIN invoices i ON cr.invoiceId = i.id
             LEFT JOIN stock_locations sl ON cr.receivedLocationId = sl.id
             WHERE cr.id = ?`,
            [req.params.id]
        );
        if (returns.length === 0) {
            return res.status(404).json({ message: "Customer return not found" });
        }
        const [items] = await pool.query(
            `SELECT cri.*, fp.name AS finishedProductName, fp.sku, fb.batchNumber, u.symbol AS unitSymbol
             FROM customer_return_items cri
             LEFT JOIN finished_products fp ON cri.finishedProductId = fp.id
             LEFT JOIN finished_product_batches fb ON cri.batchId = fb.id
             LEFT JOIN inventory_units u ON cri.unitId = u.id
             WHERE cri.customerReturnId = ?`,
            [req.params.id]
        );
        returns[0].items = items;
        res.json(returns[0]);
    } catch (error) {
        console.error("Error fetching customer return:", error);
        res.status(500).json({ message: "Error fetching customer return", error: error.message });
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { returnNumber, customerId, salesOrderId, invoiceId, returnDate, receivedLocationId, receivedBy, reason, items } = req.body;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO customer_returns (returnNumber, customerId, salesOrderId, invoiceId, returnDate, receivedLocationId, receivedBy, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [returnNumber, customerId, salesOrderId || null, invoiceId || null, returnDate, receivedLocationId, receivedBy, reason || null]
        );
        if (Array.isArray(items)) {
            for (const item of items) {
                await connection.query(
                    `INSERT INTO customer_return_items (customerReturnId, finishedProductId, batchId, quantity, unitId, remarks)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [result.insertId, item.finishedProductId, item.batchId || null, item.quantity, item.unitId, item.remarks || null]
                );
            }
        }
        await connection.commit();
        const [newReturn] = await pool.query("SELECT * FROM customer_returns WHERE id = ?", [result.insertId]);
        res.status(201).json(newReturn[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating customer return:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Return number already exists" });
        }
        res.status(500).json({ message: "Error creating customer return", error: error.message });
    } finally {
        connection.release();
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT cri.*, fp.name AS finishedProductName, fp.sku, fb.batchNumber, u.symbol AS unitSymbol
             FROM customer_return_items cri
             LEFT JOIN finished_products fp ON cri.finishedProductId = fp.id
             LEFT JOIN finished_product_batches fb ON cri.batchId = fb.id
             LEFT JOIN inventory_units u ON cri.unitId = u.id
             WHERE cri.customerReturnId = ?`,
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        console.error("Error fetching customer return items:", error);
        res.status(500).json({ message: "Error fetching customer return items", error: error.message });
    }
});

router.post("/:id/items", async (req, res) => {
    try {
        const { finishedProductId, batchId, quantity, unitId, remarks } = req.body;
        const [result] = await pool.query(
            "INSERT INTO customer_return_items (customerReturnId, finishedProductId, batchId, quantity, unitId, remarks) VALUES (?, ?, ?, ?, ?, ?)",
            [req.params.id, finishedProductId, batchId || null, quantity, unitId, remarks || null]
        );
        const [newItem] = await pool.query("SELECT * FROM customer_return_items WHERE id = ?", [result.insertId]);
        res.status(201).json(newItem[0]);
    } catch (error) {
        console.error("Error adding return item:", error);
        res.status(500).json({ message: "Error adding return item", error: error.message });
    }
});

router.patch("/:id/items/:itemId/qc", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { qcResult, remarks } = req.body;
        await connection.beginTransaction();
        const [itemRows] = await connection.query(
            `SELECT cri.*, cr.receivedLocationId, cr.receivedBy
             FROM customer_return_items cri
             JOIN customer_returns cr ON cri.customerReturnId = cr.id
             WHERE cri.id = ? AND cri.customerReturnId = ?`,
            [req.params.itemId, req.params.id]
        );
        if (itemRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Return item not found" });
        }
        const item = itemRows[0];
        await connection.query(
            "UPDATE customer_return_items SET qcResult = ?, remarks = ? WHERE id = ?",
            [qcResult, remarks || null, req.params.itemId]
        );
        if (qcResult === 'restock') {
            const [existingStock] = await connection.query(
                "SELECT * FROM finished_product_stock WHERE finishedProductId = ? AND batchId <=> ? AND locationId = ?",
                [item.finishedProductId, item.batchId || null, item.receivedLocationId]
            );
            if (existingStock.length > 0) {
                await connection.query(
                    "UPDATE finished_product_stock SET quantity = quantity + ? WHERE id = ?",
                    [item.quantity, existingStock[0].id]
                );
            } else {
                await connection.query(
                    "INSERT INTO finished_product_stock (finishedProductId, batchId, locationId, quantity, unitId) VALUES (?, ?, ?, ?, ?)",
                    [item.finishedProductId, item.batchId || null, item.receivedLocationId, item.quantity, item.unitId]
                );
            }
            await addFinishedLedger(connection, {
                finishedProductId: item.finishedProductId,
                batchId: item.batchId || null,
                locationId: item.receivedLocationId,
                transactionType: 'customer_return',
                referenceType: 'customer_return',
                referenceId: req.params.id,
                quantityIn: item.quantity,
                remarks: 'Customer return restocked',
                createdBy: req.user.id
            });
        }
        await connection.commit();
        const [updatedItem] = await pool.query(
            "SELECT * FROM customer_return_items WHERE id = ?", [req.params.itemId]
        );
        res.json(updatedItem[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error QCing return item:", error);
        res.status(500).json({ message: "Error QCing return item", error: error.message });
    } finally {
        connection.release();
    }
});

router.patch("/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        const [result] = await pool.query(
            "UPDATE customer_returns SET status = ? WHERE id = ?",
            [status, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Customer return not found" });
        }
        const [updatedReturn] = await pool.query("SELECT * FROM customer_returns WHERE id = ?", [req.params.id]);
        res.json(updatedReturn[0]);
    } catch (error) {
        console.error("Error updating customer return status:", error);
        res.status(500).json({ message: "Error updating customer return status", error: error.message });
    }
});

export default router;