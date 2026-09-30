import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { finishedProductId, isActive } = req.query;
        let query = `SELECT bom.*, fp.name AS finishedProductName, fp.sku, u.symbol AS outputUnitSymbol
                     FROM bills_of_materials bom
                     LEFT JOIN finished_products fp ON bom.finishedProductId = fp.id
                     LEFT JOIN inventory_units u ON bom.outputUnitId = u.id
                     WHERE bom.deletedAt IS NULL`;
        const params = [];
        if (finishedProductId) { query += " AND bom.finishedProductId = ?"; params.push(finishedProductId); }
        if (isActive !== undefined) { query += " AND bom.isActive = ?"; params.push(Number(isActive)); }
        query += " ORDER BY bom.name";
        const [boms] = await pool.query(query, params);
        res.json(boms);
    } catch (error) {
        console.error("Error fetching bills of materials:", error);
        res.status(500).json({ message: "Error fetching bills of materials", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [boms] = await pool.query(
            `SELECT bom.*, fp.name AS finishedProductName, fp.sku, u.symbol AS outputUnitSymbol
             FROM bills_of_materials bom
             LEFT JOIN finished_products fp ON bom.finishedProductId = fp.id
             LEFT JOIN inventory_units u ON bom.outputUnitId = u.id
             WHERE bom.id = ? AND bom.deletedAt IS NULL`,
            [req.params.id]
        );
        if (boms.length === 0) {
            return res.status(404).json({ message: "Bill of materials not found" });
        }
        const [items] = await pool.query(
            `SELECT bi.*, rm.name AS rawMaterialName, rm.sku, u.symbol AS unitSymbol
             FROM bom_items bi
             LEFT JOIN raw_materials rm ON bi.rawMaterialId = rm.id
             LEFT JOIN inventory_units u ON bi.unitId = u.id
             WHERE bi.bomId = ?`,
            [req.params.id]
        );
        boms[0].items = items;
        res.json(boms[0]);
    } catch (error) {
        console.error("Error fetching bill of materials:", error);
        res.status(500).json({ message: "Error fetching bill of materials", error: error.message });
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { bomNumber, finishedProductId, name, outputQuantity, outputUnitId, versionNumber, items } = req.body;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO bills_of_materials (bomNumber, finishedProductId, name, outputQuantity, outputUnitId, versionNumber)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [bomNumber, finishedProductId, name, outputQuantity !== undefined ? outputQuantity : 1, outputUnitId, versionNumber || 1]
        );
        if (Array.isArray(items)) {
            for (const item of items) {
                await connection.query(
                    "INSERT INTO bom_items (bomId, rawMaterialId, requiredQuantity, unitId, wastagePercentage) VALUES (?, ?, ?, ?, ?)",
                    [result.insertId, item.rawMaterialId, item.requiredQuantity, item.unitId, item.wastagePercentage || 0]
                );
            }
        }
        await connection.commit();
        const [newBom] = await pool.query("SELECT * FROM bills_of_materials WHERE id = ?", [result.insertId]);
        res.status(201).json(newBom[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating bill of materials:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "BOM number already exists" });
        }
        res.status(500).json({ message: "Error creating bill of materials", error: error.message });
    } finally {
        connection.release();
    }
});

router.put("/:id", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { finishedProductId, name, outputQuantity, outputUnitId, versionNumber, isActive, items } = req.body;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `UPDATE bills_of_materials SET finishedProductId = ?, name = ?, outputQuantity = ?, outputUnitId = ?, versionNumber = ?, isActive = ?
             WHERE id = ? AND deletedAt IS NULL`,
            [finishedProductId, name, outputQuantity !== undefined ? outputQuantity : 1, outputUnitId, versionNumber || 1,
             isActive !== undefined ? Number(isActive) : 1, req.params.id]
        );
        if (result.affectedRows === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Bill of materials not found" });
        }
        if (Array.isArray(items)) {
            await connection.query("DELETE FROM bom_items WHERE bomId = ?", [req.params.id]);
            for (const item of items) {
                await connection.query(
                    "INSERT INTO bom_items (bomId, rawMaterialId, requiredQuantity, unitId, wastagePercentage) VALUES (?, ?, ?, ?, ?)",
                    [req.params.id, item.rawMaterialId, item.requiredQuantity, item.unitId, item.wastagePercentage || 0]
                );
            }
        }
        await connection.commit();
        const [updatedBom] = await pool.query("SELECT * FROM bills_of_materials WHERE id = ?", [req.params.id]);
        res.json(updatedBom[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error updating bill of materials:", error);
        res.status(500).json({ message: "Error updating bill of materials", error: error.message });
    } finally {
        connection.release();
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE bills_of_materials SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Bill of materials not found" });
        }
        res.json({ message: "Bill of materials deleted successfully" });
    } catch (error) {
        console.error("Error deleting bill of materials:", error);
        res.status(500).json({ message: "Error deleting bill of materials", error: error.message });
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT bi.*, rm.name AS rawMaterialName, rm.sku, u.symbol AS unitSymbol
             FROM bom_items bi
             LEFT JOIN raw_materials rm ON bi.rawMaterialId = rm.id
             LEFT JOIN inventory_units u ON bi.unitId = u.id
             WHERE bi.bomId = ?`,
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        console.error("Error fetching BOM items:", error);
        res.status(500).json({ message: "Error fetching BOM items", error: error.message });
    }
});

router.post("/:id/items", async (req, res) => {
    try {
        const { rawMaterialId, requiredQuantity, unitId, wastagePercentage } = req.body;
        const [result] = await pool.query(
            "INSERT INTO bom_items (bomId, rawMaterialId, requiredQuantity, unitId, wastagePercentage) VALUES (?, ?, ?, ?, ?)",
            [req.params.id, rawMaterialId, requiredQuantity, unitId, wastagePercentage || 0]
        );
        const [newItem] = await pool.query("SELECT * FROM bom_items WHERE id = ?", [result.insertId]);
        res.status(201).json(newItem[0]);
    } catch (error) {
        console.error("Error adding BOM item:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Raw material already exists in this BOM" });
        }
        res.status(500).json({ message: "Error adding BOM item", error: error.message });
    }
});

router.put("/:id/items/:itemId", async (req, res) => {
    try {
        const { rawMaterialId, requiredQuantity, unitId, wastagePercentage } = req.body;
        const [result] = await pool.query(
            "UPDATE bom_items SET rawMaterialId = ?, requiredQuantity = ?, unitId = ?, wastagePercentage = ? WHERE id = ? AND bomId = ?",
            [rawMaterialId, requiredQuantity, unitId, wastagePercentage || 0, req.params.itemId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "BOM item not found" });
        }
        const [updatedItem] = await pool.query("SELECT * FROM bom_items WHERE id = ?", [req.params.itemId]);
        res.json(updatedItem[0]);
    } catch (error) {
        console.error("Error updating BOM item:", error);
        res.status(500).json({ message: "Error updating BOM item", error: error.message });
    }
});

router.delete("/:id/items/:itemId", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM bom_items WHERE id = ? AND bomId = ?",
            [req.params.itemId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "BOM item not found" });
        }
        res.json({ message: "BOM item deleted successfully" });
    } catch (error) {
        console.error("Error deleting BOM item:", error);
        res.status(500).json({ message: "Error deleting BOM item", error: error.message });
    }
});

export default router;