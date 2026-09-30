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
        const { salesOrderId, customerId, status } = req.query;
        let query = `SELECT d.*, so.salesOrderNumber, c.companyName AS customerName, sl.name AS fromLocationName
                     FROM dispatches d
                     LEFT JOIN sales_orders so ON d.salesOrderId = so.id
                     LEFT JOIN customers c ON d.customerId = c.id
                     LEFT JOIN stock_locations sl ON d.fromLocationId = sl.id
                     WHERE 1 = 1`;
        const params = [];
        if (salesOrderId) { query += " AND d.salesOrderId = ?"; params.push(salesOrderId); }
        if (customerId) { query += " AND d.customerId = ?"; params.push(customerId); }
        if (status) { query += " AND d.status = ?"; params.push(status); }
        query += " ORDER BY d.dispatchDate DESC";
        const [dispatches] = await pool.query(query, params);
        res.json(dispatches);
    } catch (error) {
        console.error("Error fetching dispatches:", error);
        res.status(500).json({ message: "Error fetching dispatches", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [dispatches] = await pool.query(
            `SELECT d.*, so.salesOrderNumber, c.companyName AS customerName, sl.name AS fromLocationName
             FROM dispatches d
             LEFT JOIN sales_orders so ON d.salesOrderId = so.id
             LEFT JOIN customers c ON d.customerId = c.id
             LEFT JOIN stock_locations sl ON d.fromLocationId = sl.id
             WHERE d.id = ?`,
            [req.params.id]
        );
        if (dispatches.length === 0) {
            return res.status(404).json({ message: "Dispatch not found" });
        }
        const [items] = await pool.query(
            `SELECT di.*, fp.name AS finishedProductName, fp.sku, fb.batchNumber, u.symbol AS unitSymbol
             FROM dispatch_items di
             LEFT JOIN finished_products fp ON di.finishedProductId = fp.id
             LEFT JOIN finished_product_batches fb ON di.batchId = fb.id
             LEFT JOIN inventory_units u ON di.unitId = u.id
             WHERE di.dispatchId = ?`,
            [req.params.id]
        );
        dispatches[0].items = items;
        res.json(dispatches[0]);
    } catch (error) {
        console.error("Error fetching dispatch:", error);
        res.status(500).json({ message: "Error fetching dispatch", error: error.message });
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { dispatchNumber, salesOrderId, customerId, dispatchDate, fromLocationId, dispatchedBy, remarks, items } = req.body;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO dispatches (dispatchNumber, salesOrderId, customerId, dispatchDate, fromLocationId, dispatchedBy, status, remarks)
             VALUES (?, ?, ?, ?, ?, ?, 'dispatched', ?)`,
            [dispatchNumber, salesOrderId, customerId, dispatchDate, fromLocationId, dispatchedBy, remarks || null]
        );
        if (Array.isArray(items)) {
            for (const item of items) {
                await connection.query(
                    `INSERT INTO dispatch_items (dispatchId, salesOrderItemId, finishedProductId, batchId, dispatchedQuantity, unitId)
                     VALUES (?, ?, ?, ?, ?, ?)`,
                    [result.insertId, item.salesOrderItemId, item.finishedProductId, item.batchId || null, item.dispatchedQuantity, item.unitId]
                );
                await connection.query(
                    "UPDATE sales_order_items SET dispatchedQuantity = dispatchedQuantity + ? WHERE id = ?",
                    [item.dispatchedQuantity, item.salesOrderItemId]
                );
                const [stockRows] = await connection.query(
                    "SELECT * FROM finished_product_stock WHERE finishedProductId = ? AND batchId <=> ? AND locationId = ?",
                    [item.finishedProductId, item.batchId || null, fromLocationId]
                );
                if (stockRows.length > 0) {
                    await connection.query(
                        "UPDATE finished_product_stock SET quantity = GREATEST(quantity - ?, 0) WHERE id = ?",
                        [item.dispatchedQuantity, stockRows[0].id]
                    );
                }
                const [unitPriceRows] = await connection.query(
                    "SELECT unitPrice FROM sales_order_items WHERE id = ?", [item.salesOrderItemId]
                );
                await addFinishedLedger(connection, {
                    finishedProductId: item.finishedProductId,
                    batchId: item.batchId || null,
                    locationId: fromLocationId,
                    transactionType: 'dispatch',
                    referenceType: 'dispatch',
                    referenceId: result.insertId,
                    quantityOut: item.dispatchedQuantity,
                    unitCost: unitPriceRows.length > 0 ? unitPriceRows[0].unitPrice : null,
                    remarks: `Dispatch ${dispatchNumber}`,
                    createdBy: req.user.id
                });
            }
        }
        const [orderTotals] = await connection.query(
            "SELECT SUM(orderedQuantity) AS ordered, SUM(dispatchedQuantity) AS dispatched FROM sales_order_items WHERE salesOrderId = ?",
            [salesOrderId]
        );
        const so = orderTotals[0];
        if (Number(so.ordered) > 0 && Number(so.dispatched) >= Number(so.ordered)) {
            await connection.query("UPDATE sales_orders SET status = 'completed' WHERE id = ?", [salesOrderId]);
        } else if (Number(so.dispatched) > 0) {
            await connection.query("UPDATE sales_orders SET status = 'partially_dispatched' WHERE id = ?", [salesOrderId]);
        }
        await connection.commit();
        const [newDispatch] = await pool.query("SELECT * FROM dispatches WHERE id = ?", [result.insertId]);
        res.status(201).json(newDispatch[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating dispatch:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Dispatch number already exists" });
        }
        res.status(500).json({ message: "Error creating dispatch", error: error.message });
    } finally {
        connection.release();
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT di.*, fp.name AS finishedProductName, fp.sku, fb.batchNumber, u.symbol AS unitSymbol
             FROM dispatch_items di
             LEFT JOIN finished_products fp ON di.finishedProductId = fp.id
             LEFT JOIN finished_product_batches fb ON di.batchId = fb.id
             LEFT JOIN inventory_units u ON di.unitId = u.id
             WHERE di.dispatchId = ?`,
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        console.error("Error fetching dispatch items:", error);
        res.status(500).json({ message: "Error fetching dispatch items", error: error.message });
    }
});

router.post("/:id/items", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { salesOrderItemId, finishedProductId, batchId, dispatchedQuantity, unitId } = req.body;
        await connection.beginTransaction();
        const [dispatchRows] = await connection.query("SELECT * FROM dispatches WHERE id = ?", [req.params.id]);
        if (dispatchRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Dispatch not found" });
        }
        const dispatch = dispatchRows[0];
        const [result] = await connection.query(
            `INSERT INTO dispatch_items (dispatchId, salesOrderItemId, finishedProductId, batchId, dispatchedQuantity, unitId)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.params.id, salesOrderItemId, finishedProductId, batchId || null, dispatchedQuantity, unitId]
        );
        await connection.query("UPDATE sales_order_items SET dispatchedQuantity = dispatchedQuantity + ? WHERE id = ?", [dispatchedQuantity, salesOrderItemId]);
        const [stockRows] = await connection.query(
            "SELECT * FROM finished_product_stock WHERE finishedProductId = ? AND batchId <=> ? AND locationId = ?",
            [finishedProductId, batchId || null, dispatch.fromLocationId]
        );
        if (stockRows.length > 0) {
            await connection.query("UPDATE finished_product_stock SET quantity = GREATEST(quantity - ?, 0) WHERE id = ?", [dispatchedQuantity, stockRows[0].id]);
        }
        await addFinishedLedger(connection, {
            finishedProductId,
            batchId: batchId || null,
            locationId: dispatch.fromLocationId,
            transactionType: 'dispatch',
            referenceType: 'dispatch',
            referenceId: req.params.id,
            quantityOut: dispatchedQuantity,
            remarks: `Dispatch ${dispatch.dispatchNumber}`,
            createdBy: req.user.id
        });
        await connection.commit();
        const [newItem] = await pool.query("SELECT * FROM dispatch_items WHERE id = ?", [result.insertId]);
        res.status(201).json(newItem[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error adding dispatch item:", error);
        res.status(500).json({ message: "Error adding dispatch item", error: error.message });
    } finally {
        connection.release();
    }
});

router.patch("/:id/cancel", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE dispatches SET status = 'cancelled' WHERE id = ? AND status = 'dispatched'",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Dispatch cannot be cancelled" });
        }
        const [updatedDispatch] = await pool.query("SELECT * FROM dispatches WHERE id = ?", [req.params.id]);
        res.json(updatedDispatch[0]);
    } catch (error) {
        console.error("Error cancelling dispatch:", error);
        res.status(500).json({ message: "Error cancelling dispatch", error: error.message });
    }
});

export default router;