import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/batches", async (req, res) => {
    try {
        const { finishedProductId, productionOrderId } = req.query;
        let query = `SELECT fb.*, fp.name AS finishedProductName, fp.sku, po.productionNumber, u.symbol AS unitSymbol
                     FROM finished_product_batches fb
                     LEFT JOIN finished_products fp ON fb.finishedProductId = fp.id
                     LEFT JOIN production_orders po ON fb.productionOrderId = po.id
                     LEFT JOIN inventory_units u ON fb.unitId = u.id
                     WHERE 1 = 1`;
        const params = [];
        if (finishedProductId) { query += " AND fb.finishedProductId = ?"; params.push(finishedProductId); }
        if (productionOrderId) { query += " AND fb.productionOrderId = ?"; params.push(productionOrderId); }
        query += " ORDER BY fb.manufacturingDate DESC";
        const [batches] = await pool.query(query, params);
        res.json(batches);
    } catch (error) {
        console.error("Error fetching finished product batches:", error);
        res.status(500).json({ message: "Error fetching finished product batches", error: error.message });
    }
});

router.get("/batches/:id", async (req, res) => {
    try {
        const [batches] = await pool.query(
            `SELECT fb.*, fp.name AS finishedProductName, fp.sku, po.productionNumber, u.symbol AS unitSymbol
             FROM finished_product_batches fb
             LEFT JOIN finished_products fp ON fb.finishedProductId = fp.id
             LEFT JOIN production_orders po ON fb.productionOrderId = po.id
             LEFT JOIN inventory_units u ON fb.unitId = u.id
             WHERE fb.id = ?`,
            [req.params.id]
        );
        if (batches.length === 0) {
            return res.status(404).json({ message: "Finished product batch not found" });
        }
        res.json(batches[0]);
    } catch (error) {
        console.error("Error fetching finished product batch:", error);
        res.status(500).json({ message: "Error fetching finished product batch", error: error.message });
    }
});

router.post("/batches", async (req, res) => {
    try {
        const { finishedProductId, batchNumber, productionOrderId, manufacturingDate, originalQuantity, currentQuantity, unitId, manualCost } = req.body;
        const [result] = await pool.query(
            `INSERT INTO finished_product_batches (finishedProductId, batchNumber, productionOrderId, manufacturingDate, originalQuantity, currentQuantity, unitId, manualCost)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [finishedProductId, batchNumber, productionOrderId || null, manufacturingDate, originalQuantity,
             currentQuantity !== undefined ? currentQuantity : originalQuantity, unitId, manualCost || null]
        );
        const [newBatch] = await pool.query("SELECT * FROM finished_product_batches WHERE id = ?", [result.insertId]);
        res.status(201).json(newBatch[0]);
    } catch (error) {
        console.error("Error creating finished product batch:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Batch number already exists" });
        }
        res.status(500).json({ message: "Error creating finished product batch", error: error.message });
    }
});

router.put("/batches/:id", async (req, res) => {
    try {
        const { batchNumber, manufacturingDate, originalQuantity, currentQuantity, manualCost } = req.body;
        const [result] = await pool.query(
            "UPDATE finished_product_batches SET batchNumber = ?, manufacturingDate = ?, originalQuantity = ?, currentQuantity = ?, manualCost = ? WHERE id = ?",
            [batchNumber, manufacturingDate, originalQuantity, currentQuantity, manualCost || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Finished product batch not found" });
        }
        const [updatedBatch] = await pool.query("SELECT * FROM finished_product_batches WHERE id = ?", [req.params.id]);
        res.json(updatedBatch[0]);
    } catch (error) {
        console.error("Error updating finished product batch:", error);
        res.status(500).json({ message: "Error updating finished product batch", error: error.message });
    }
});

router.get("/", async (req, res) => {
    try {
        const { finishedProductId, locationId } = req.query;
        let query = `SELECT fs.*, fp.name AS finishedProductName, fp.sku, fb.batchNumber, u.symbol AS unitSymbol, sl.name AS locationName
                     FROM finished_product_stock fs
                     JOIN finished_products fp ON fs.finishedProductId = fp.id
                     LEFT JOIN finished_product_batches fb ON fs.batchId = fb.id
                     JOIN inventory_units u ON fs.unitId = u.id
                     JOIN stock_locations sl ON fs.locationId = sl.id
                     WHERE 1 = 1`;
        const params = [];
        if (finishedProductId) { query += " AND fs.finishedProductId = ?"; params.push(finishedProductId); }
        if (locationId) { query += " AND fs.locationId = ?"; params.push(locationId); }
        query += " ORDER BY fp.name, fb.batchNumber";
        const [stock] = await pool.query(query, params);
        res.json(stock);
    } catch (error) {
        console.error("Error fetching finished product stock:", error);
        res.status(500).json({ message: "Error fetching finished product stock", error: error.message });
    }
});

router.post("/stock", async (req, res) => {
    try {
        const { finishedProductId, batchId, locationId, quantity, unitId } = req.body;
        const [existing] = await pool.query(
            "SELECT * FROM finished_product_stock WHERE finishedProductId = ? AND batchId <=> ? AND locationId = ?",
            [finishedProductId, batchId || null, locationId]
        );
        if (existing.length > 0) {
            await pool.query(
                "UPDATE finished_product_stock SET quantity = quantity + ?, unitId = ? WHERE id = ?",
                [quantity, unitId, existing[0].id]
            );
            const [updated] = await pool.query("SELECT * FROM finished_product_stock WHERE id = ?", [existing[0].id]);
            return res.json(updated[0]);
        }
        const [result] = await pool.query(
            "INSERT INTO finished_product_stock (finishedProductId, batchId, locationId, quantity, unitId) VALUES (?, ?, ?, ?, ?)",
            [finishedProductId, batchId || null, locationId, quantity, unitId]
        );
        const [newStock] = await pool.query("SELECT * FROM finished_product_stock WHERE id = ?", [result.insertId]);
        res.status(201).json(newStock[0]);
    } catch (error) {
        console.error("Error updating finished product stock:", error);
        res.status(500).json({ message: "Error updating finished product stock", error: error.message });
    }
});

router.put("/stock/:id", async (req, res) => {
    try {
        const { quantity, unitId } = req.body;
        const [result] = await pool.query(
            "UPDATE finished_product_stock SET quantity = ?, unitId = ? WHERE id = ?",
            [quantity, unitId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Stock row not found" });
        }
        const [updatedStock] = await pool.query("SELECT * FROM finished_product_stock WHERE id = ?", [req.params.id]);
        res.json(updatedStock[0]);
    } catch (error) {
        console.error("Error updating stock row:", error);
        res.status(500).json({ message: "Error updating stock row", error: error.message });
    }
});

router.get("/ledger", async (req, res) => {
    try {
        const { finishedProductId, batchId, transactionType, fromDate, toDate } = req.query;
        let query = `SELECT fl.*, fp.name AS finishedProductName, fp.sku, fb.batchNumber, sl.name AS locationName, u.email AS createdByEmail
                     FROM finished_product_stock_ledger fl
                     LEFT JOIN finished_products fp ON fl.finishedProductId = fp.id
                     LEFT JOIN finished_product_batches fb ON fl.batchId = fb.id
                     LEFT JOIN stock_locations sl ON fl.locationId = sl.id
                     LEFT JOIN users u ON fl.createdBy = u.id
                     WHERE 1 = 1`;
        const params = [];
        if (finishedProductId) { query += " AND fl.finishedProductId = ?"; params.push(finishedProductId); }
        if (batchId) { query += " AND fl.batchId = ?"; params.push(batchId); }
        if (transactionType) { query += " AND fl.transactionType = ?"; params.push(transactionType); }
        if (fromDate) { query += " AND DATE(fl.transactionAt) >= ?"; params.push(fromDate); }
        if (toDate) { query += " AND DATE(fl.transactionAt) <= ?"; params.push(toDate); }
        query += " ORDER BY fl.transactionAt DESC";
        const [ledger] = await pool.query(query, params);
        res.json(ledger);
    } catch (error) {
        console.error("Error fetching finished product ledger:", error);
        res.status(500).json({ message: "Error fetching finished product ledger", error: error.message });
    }
});

router.post("/ledger", async (req, res) => {
    try {
        const { finishedProductId, batchId, locationId, transactionType, referenceType, referenceId, quantityIn, quantityOut, unitCost, remarks, transactionAt } = req.body;
        const [result] = await pool.query(
            `INSERT INTO finished_product_stock_ledger (finishedProductId, batchId, locationId, transactionType, referenceType, referenceId, quantityIn, quantityOut, unitCost, remarks, createdBy, transactionAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [finishedProductId, batchId || null, locationId || null, transactionType,
             referenceType || null, referenceId || null,
             quantityIn !== undefined ? quantityIn : 0,
             quantityOut !== undefined ? quantityOut : 0,
             unitCost || null, remarks || null, req.user.id, transactionAt || new Date()]
        );
        const [newEntry] = await pool.query("SELECT * FROM finished_product_stock_ledger WHERE id = ?", [result.insertId]);
        res.status(201).json(newEntry[0]);
    } catch (error) {
        console.error("Error creating ledger entry:", error);
        res.status(500).json({ message: "Error creating ledger entry", error: error.message });
    }
});

router.get("/summary", async (req, res) => {
    try {
        const [summary] = await pool.query(
            `SELECT fp.id, fp.name, fp.sku, fp.minimumStockLevel, u.symbol AS unitSymbol,
                    COALESCE(SUM(fs.quantity), 0) AS totalStock
             FROM finished_products fp
             JOIN inventory_units u ON fp.unitId = u.id
             LEFT JOIN finished_product_stock fs ON fs.finishedProductId = fp.id
             WHERE fp.deletedAt IS NULL
             GROUP BY fp.id, fp.name, fp.sku, fp.minimumStockLevel, u.symbol
             ORDER BY fp.name`
        );
        res.json(summary);
    } catch (error) {
        console.error("Error fetching stock summary:", error);
        res.status(500).json({ message: "Error fetching stock summary", error: error.message });
    }
});

router.get("/low-stock", async (req, res) => {
    try {
        const [lowStock] = await pool.query(
            `SELECT fp.id, fp.name, fp.sku, fp.minimumStockLevel, u.symbol AS unitSymbol,
                    COALESCE(SUM(fs.quantity), 0) AS totalStock
             FROM finished_products fp
             JOIN inventory_units u ON fp.unitId = u.id
             LEFT JOIN finished_product_stock fs ON fs.finishedProductId = fp.id
             WHERE fp.deletedAt IS NULL
             GROUP BY fp.id, fp.name, fp.sku, fp.minimumStockLevel, u.symbol
             HAVING totalStock < fp.minimumStockLevel
             ORDER BY totalStock`
        );
        res.json(lowStock);
    } catch (error) {
        console.error("Error fetching low stock items:", error);
        res.status(500).json({ message: "Error fetching low stock items", error: error.message });
    }
});

export default router;