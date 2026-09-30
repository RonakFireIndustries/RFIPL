import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { unitType, isActive, search } = req.query;
        let query = "SELECT * FROM inventory_units WHERE deletedAt IS NULL";
        const params = [];
        if (unitType) { query += " AND unitType = ?"; params.push(unitType); }
        if (isActive !== undefined) { query += " AND isActive = ?"; params.push(Number(isActive)); }
        if (search) {
            query += " AND (name LIKE ? OR symbol LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }
        query += " ORDER BY name";
        const [units] = await pool.query(query, params);
        res.json(units);
    } catch (error) {
        console.error("Error fetching inventory units:", error);
        res.status(500).json({ message: "Error fetching inventory units", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [units] = await pool.query(
            "SELECT * FROM inventory_units WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (units.length === 0) {
            return res.status(404).json({ message: "Inventory unit not found" });
        }
        const [conversions] = await pool.query(
            `SELECT uc.*, u1.name AS fromUnitName, u1.symbol AS fromUnitSymbol, u2.name AS toUnitName, u2.symbol AS toUnitSymbol
             FROM unit_conversions uc
             JOIN inventory_units u1 ON uc.fromUnitId = u1.id
             JOIN inventory_units u2 ON uc.toUnitId = u2.id
             WHERE uc.fromUnitId = ?`,
            [req.params.id]
        );
        units[0].conversions = conversions;
        res.json(units[0]);
    } catch (error) {
        console.error("Error fetching inventory unit:", error);
        res.status(500).json({ message: "Error fetching inventory unit", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, symbol, unitType, isBaseUnit, isActive } = req.body;
        const [result] = await pool.query(
            "INSERT INTO inventory_units (name, symbol, unitType, isBaseUnit, isActive) VALUES (?, ?, ?, ?, ?)",
            [name, symbol, unitType, isBaseUnit !== undefined ? Number(isBaseUnit) : 0, isActive !== undefined ? Number(isActive) : 1]
        );
        const [newUnit] = await pool.query("SELECT * FROM inventory_units WHERE id = ?", [result.insertId]);
        res.status(201).json(newUnit[0]);
    } catch (error) {
        console.error("Error creating inventory unit:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Inventory unit name or symbol already exists" });
        }
        res.status(500).json({ message: "Error creating inventory unit", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, symbol, unitType, isBaseUnit, isActive } = req.body;
        const [result] = await pool.query(
            "UPDATE inventory_units SET name = ?, symbol = ?, unitType = ?, isBaseUnit = ?, isActive = ? WHERE id = ? AND deletedAt IS NULL",
            [name, symbol, unitType,
             isBaseUnit !== undefined ? Number(isBaseUnit) : 0,
             isActive !== undefined ? Number(isActive) : 1,
             req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Inventory unit not found" });
        }
        const [updatedUnit] = await pool.query("SELECT * FROM inventory_units WHERE id = ?", [req.params.id]);
        res.json(updatedUnit[0]);
    } catch (error) {
        console.error("Error updating inventory unit:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Inventory unit name or symbol already exists" });
        }
        res.status(500).json({ message: "Error updating inventory unit", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE inventory_units SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Inventory unit not found" });
        }
        res.json({ message: "Inventory unit deleted successfully" });
    } catch (error) {
        console.error("Error deleting inventory unit:", error);
        res.status(500).json({ message: "Error deleting inventory unit", error: error.message });
    }
});

router.get("/:id/conversions", async (req, res) => {
    try {
        const [conversions] = await pool.query(
            `SELECT uc.*, u1.name AS fromUnitName, u1.symbol AS fromUnitSymbol, u2.name AS toUnitName, u2.symbol AS toUnitSymbol
             FROM unit_conversions uc
             JOIN inventory_units u1 ON uc.fromUnitId = u1.id
             JOIN inventory_units u2 ON uc.toUnitId = u2.id
             WHERE uc.fromUnitId = ?`,
            [req.params.id]
        );
        res.json(conversions);
    } catch (error) {
        console.error("Error fetching conversions:", error);
        res.status(500).json({ message: "Error fetching conversions", error: error.message });
    }
});

router.post("/:id/conversions", async (req, res) => {
    try {
        const { toUnitId, conversionFactor } = req.body;
        const [result] = await pool.query(
            "INSERT INTO unit_conversions (fromUnitId, toUnitId, conversionFactor) VALUES (?, ?, ?)",
            [req.params.id, toUnitId, conversionFactor]
        );
        const [newConversion] = await pool.query("SELECT * FROM unit_conversions WHERE id = ?", [result.insertId]);
        res.status(201).json(newConversion[0]);
    } catch (error) {
        console.error("Error creating conversion:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Conversion between these units already exists" });
        }
        res.status(500).json({ message: "Error creating conversion", error: error.message });
    }
});

router.delete("/:id/conversions/:conversionId", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM unit_conversions WHERE id = ? AND fromUnitId = ?",
            [req.params.conversionId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Conversion not found" });
        }
        res.json({ message: "Conversion deleted successfully" });
    } catch (error) {
        console.error("Error deleting conversion:", error);
        res.status(500).json({ message: "Error deleting conversion", error: error.message });
    }
});

export default router;