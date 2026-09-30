import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/batches", async (req, res) => {
    try {
        const { rawMaterialId, supplierId, qcStatus } = req.query;
        let query = `SELECT rb.*, rm.name AS rawMaterialName, rm.sku,
                            s.companyName AS supplierName, u.symbol AS unitSymbol
                     FROM raw_material_batches rb
                     LEFT JOIN raw_materials rm ON rb.rawMaterialId = rm.id
                     LEFT JOIN suppliers s ON rb.supplierId = s.id
                     LEFT JOIN inventory_units u ON rb.unitId = u.id
                     WHERE 1 = 1`;
        const params = [];
        if (rawMaterialId) { query += " AND rb.rawMaterialId = ?"; params.push(rawMaterialId); }
        if (supplierId) { query += " AND rb.supplierId = ?"; params.push(supplierId); }
        if (qcStatus) { query += " AND rb.qcStatus = ?"; params.push(qcStatus); }
        query += " ORDER BY rb.receivedDate DESC";
        const [batches] = await pool.query(query, params);
        res.json(batches);
    } catch (error) {
        console.error("Error fetching raw material batches:", error);
        res.status(500).json({ message: "Error fetching raw material batches", error: error.message });
    }
});

router.get("/batches/:id", async (req, res) => {
    try {
        const [batches] = await pool.query(
            `SELECT rb.*, rm.name AS rawMaterialName, rm.sku, s.companyName AS supplierName, u.symbol AS unitSymbol
             FROM raw_material_batches rb
             LEFT JOIN raw_materials rm ON rb.rawMaterialId = rm.id
             LEFT JOIN suppliers s ON rb.supplierId = s.id
             LEFT JOIN inventory_units u ON rb.unitId = u.id
             WHERE rb.id = ?`,
            [req.params.id]
        );
        if (batches.length === 0) {
            return res.status(404).json({ message: "Raw material batch not found" });
        }
        res.json(batches[0]);
    } catch (error) {
        console.error("Error fetching raw material batch:", error);
        res.status(500).json({ message: "Error fetching raw material batch", error: error.message });
    }
});

router.post("/batches", async (req, res) => {
    try {
        const { rawMaterialId, supplierId, batchNumber, receivedDate, purchasePrice, originalQuantity, currentQuantity, unitId, qcStatus } = req.body;
        const [result] = await pool.query(
            `INSERT INTO raw_material_batches (rawMaterialId, supplierId, batchNumber, receivedDate, purchasePrice, originalQuantity, currentQuantity, unitId, qcStatus)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [rawMaterialId, supplierId || null, batchNumber, receivedDate, purchasePrice,
             originalQuantity, currentQuantity !== undefined ? currentQuantity : originalQuantity, unitId, qcStatus || 'approved']
        );
        const [newBatch] = await pool.query("SELECT * FROM raw_material_batches WHERE id = ?", [result.insertId]);
        res.status(201).json(newBatch[0]);
    } catch (error) {
        console.error("Error creating raw material batch:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Batch already exists for this raw material" });
        }
        res.status(500).json({ message: "Error creating raw material batch", error: error.message });
    }
});

router.put("/batches/:id", async (req, res) => {
    try {
        const { supplierId, batchNumber, receivedDate, purchasePrice, originalQuantity, currentQuantity, qcStatus } = req.body;
        const [result] = await pool.query(
            `UPDATE raw_material_batches SET supplierId = ?, batchNumber = ?, receivedDate = ?, purchasePrice = ?, originalQuantity = ?, currentQuantity = ?, qcStatus = ?
             WHERE id = ?`,
            [supplierId || null, batchNumber, receivedDate, purchasePrice, originalQuantity,
             currentQuantity !== undefined ? currentQuantity : originalQuantity, qcStatus || 'approved', req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Raw material batch not found" });
        }
        const [updatedBatch] = await pool.query("SELECT * FROM raw_material_batches WHERE id = ?", [req.params.id]);
        res.json(updatedBatch[0]);
    } catch (error) {
        console.error("Error updating raw material batch:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Batch already exists for this raw material" });
        }
        res.status(500).json({ message: "Error updating raw material batch", error: error.message });
    }
});

router.get("/", async (req, res) => {
    try {
        const { rawMaterialId, locationId } = req.query;
        let query = `SELECT rs.*, rm.name AS rawMaterialName, rm.sku, rb.batchNumber, u.symbol AS unitSymbol, sl.name AS locationName
                     FROM raw_material_stock rs
                     JOIN raw_materials rm ON rs.rawMaterialId = rm.id
                     LEFT JOIN raw_material_batches rb ON rs.batchId = rb.id
                     JOIN inventory_units u ON rs.unitId = u.id
                     JOIN stock_locations sl ON rs.locationId = sl.id
                     WHERE 1 = 1`;
        const params = [];
        if (rawMaterialId) { query += " AND rs.rawMaterialId = ?"; params.push(rawMaterialId); }
        if (locationId) { query += " AND rs.locationId = ?"; params.push(locationId); }
        query += " ORDER BY rm.name, rb.batchNumber";
        const [stock] = await pool.query(query, params);
        res.json(stock);
    } catch (error) {
        console.error("Error fetching raw material stock:", error);
        res.status(500).json({ message: "Error fetching raw material stock", error: error.message });
    }
});

router.post("/stock", async (req, res) => {
    try {
        const { rawMaterialId, batchId, locationId, quantity, unitId } = req.body;
        const [existing] = await pool.query(
            "SELECT * FROM raw_material_stock WHERE rawMaterialId = ? AND batchId <=> ? AND locationId = ?",
            [rawMaterialId, batchId || null, locationId]
        );
        if (existing.length > 0) {
            await pool.query(
                "UPDATE raw_material_stock SET quantity = quantity + ?, unitId = ? WHERE id = ?",
                [quantity, unitId, existing[0].id]
            );
            const [updated] = await pool.query("SELECT * FROM raw_material_stock WHERE id = ?", [existing[0].id]);
            return res.json(updated[0]);
        }
        const [result] = await pool.query(
            "INSERT INTO raw_material_stock (rawMaterialId, batchId, locationId, quantity, unitId) VALUES (?, ?, ?, ?, ?)",
            [rawMaterialId, batchId || null, locationId, quantity, unitId]
        );
        const [newStock] = await pool.query("SELECT * FROM raw_material_stock WHERE id = ?", [result.insertId]);
        res.status(201).json(newStock[0]);
    } catch (error) {
        console.error("Error updating raw material stock:", error);
        res.status(500).json({ message: "Error updating raw material stock", error: error.message });
    }
});

router.put("/stock/:id", async (req, res) => {
    try {
        const { quantity, unitId } = req.body;
        const [result] = await pool.query(
            "UPDATE raw_material_stock SET quantity = ?, unitId = ? WHERE id = ?",
            [quantity, unitId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Stock row not found" });
        }
        const [updatedStock] = await pool.query("SELECT * FROM raw_material_stock WHERE id = ?", [req.params.id]);
        res.json(updatedStock[0]);
    } catch (error) {
        console.error("Error updating stock row:", error);
        res.status(500).json({ message: "Error updating stock row", error: error.message });
    }
});

router.get("/ledger", async (req, res) => {
    try {
        const { rawMaterialId, batchId, transactionType, fromDate, toDate } = req.query;
        let query = `SELECT rl.*, rm.name AS rawMaterialName, rm.sku, rb.batchNumber, sl.name AS locationName, u.email AS createdByEmail
                     FROM raw_material_stock_ledger rl
                     LEFT JOIN raw_materials rm ON rl.rawMaterialId = rm.id
                     LEFT JOIN raw_material_batches rb ON rl.batchId = rb.id
                     LEFT JOIN stock_locations sl ON rl.locationId = sl.id
                     LEFT JOIN users u ON rl.createdBy = u.id
                     WHERE 1 = 1`;
        const params = [];
        if (rawMaterialId) { query += " AND rl.rawMaterialId = ?"; params.push(rawMaterialId); }
        if (batchId) { query += " AND rl.batchId = ?"; params.push(batchId); }
        if (transactionType) { query += " AND rl.transactionType = ?"; params.push(transactionType); }
        if (fromDate) { query += " AND DATE(rl.transactionAt) >= ?"; params.push(fromDate); }
        if (toDate) { query += " AND DATE(rl.transactionAt) <= ?"; params.push(toDate); }
        query += " ORDER BY rl.transactionAt DESC";
        const [ledger] = await pool.query(query, params);
        res.json(ledger);
    } catch (error) {
        console.error("Error fetching raw material ledger:", error);
        res.status(500).json({ message: "Error fetching raw material ledger", error: error.message });
    }
});

router.post("/ledger", async (req, res) => {
    try {
        const { rawMaterialId, batchId, locationId, transactionType, referenceType, referenceId, quantityIn, quantityOut, unitCost, remarks, transactionAt } = req.body;
        const [result] = await pool.query(
            `INSERT INTO raw_material_stock_ledger (rawMaterialId, batchId, locationId, transactionType, referenceType, referenceId, quantityIn, quantityOut, unitCost, remarks, createdBy, transactionAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [rawMaterialId, batchId || null, locationId || null, transactionType,
             referenceType || null, referenceId || null,
             quantityIn !== undefined ? quantityIn : 0,
             quantityOut !== undefined ? quantityOut : 0,
             unitCost || null, remarks || null, req.user.id, transactionAt || new Date()]
        );
        const [newEntry] = await pool.query("SELECT * FROM raw_material_stock_ledger WHERE id = ?", [result.insertId]);
        res.status(201).json(newEntry[0]);
    } catch (error) {
        console.error("Error creating ledger entry:", error);
        res.status(500).json({ message: "Error creating ledger entry", error: error.message });
    }
});

router.get("/summary", async (req, res) => {
    try {
        const [summary] = await pool.query(
            `SELECT rm.id, rm.name, rm.sku, rm.minimumStockLevel, rm.reorderLevel, u.symbol AS unitSymbol,
                    COALESCE(SUM(rs.quantity), 0) AS totalStock
             FROM raw_materials rm
             JOIN inventory_units u ON rm.unitId = u.id
             LEFT JOIN raw_material_stock rs ON rs.rawMaterialId = rm.id
             WHERE rm.deletedAt IS NULL
             GROUP BY rm.id, rm.name, rm.sku, rm.minimumStockLevel, rm.reorderLevel, u.symbol
             ORDER BY rm.name`
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
            `SELECT rm.id, rm.name, rm.sku, rm.minimumStockLevel, rm.reorderLevel, u.symbol AS unitSymbol,
                    COALESCE(SUM(rs.quantity), 0) AS totalStock
             FROM raw_materials rm
             JOIN inventory_units u ON rm.unitId = u.id
             LEFT JOIN raw_material_stock rs ON rs.rawMaterialId = rm.id
             WHERE rm.deletedAt IS NULL
             GROUP BY rm.id, rm.name, rm.sku, rm.minimumStockLevel, rm.reorderLevel, u.symbol
             HAVING totalStock < rm.minimumStockLevel
             ORDER BY totalStock`
        );
        res.json(lowStock);
    } catch (error) {
        console.error("Error fetching low stock items:", error);
        res.status(500).json({ message: "Error fetching low stock items", error: error.message });
    }
});

export default router;