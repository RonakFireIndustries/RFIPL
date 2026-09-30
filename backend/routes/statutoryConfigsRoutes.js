import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { componentCode } = req.query;
        let query = "SELECT * FROM statutory_configurations WHERE 1=1";
        const params = [];
        if (componentCode) {
            query += " AND componentCode = ?";
            params.push(componentCode);
        }
        query += " ORDER BY name";
        const [configs] = await pool.query(query, params);
        res.json(configs);
    } catch (error) {
        console.error("Error fetching statutory configurations:", error);
        res.status(500).json({ message: "Error fetching statutory configurations", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [configs] = await pool.query(
            "SELECT * FROM statutory_configurations WHERE id = ?",
            [req.params.id]
        );
        if (configs.length === 0) {
            return res.status(404).json({ message: "Statutory configuration not found" });
        }
        res.json(configs[0]);
    } catch (error) {
        console.error("Error fetching statutory configuration:", error);
        res.status(500).json({ message: "Error fetching statutory configuration", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, componentCode, calculationType, rate, formulaExpression, effectiveFrom, effectiveTo, isActive } = req.body;
        const [result] = await pool.query(
            `INSERT INTO statutory_configurations (name, componentCode, calculationType, rate, formulaExpression, effectiveFrom, effectiveTo, isActive)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [name, componentCode, calculationType, rate || null, formulaExpression || null, effectiveFrom, effectiveTo || null, isActive !== undefined ? isActive : true]
        );
        const [newConfig] = await pool.query("SELECT * FROM statutory_configurations WHERE id = ?", [result.insertId]);
        res.status(201).json(newConfig[0]);
    } catch (error) {
        console.error("Error creating statutory configuration:", error);
        res.status(500).json({ message: "Error creating statutory configuration", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, componentCode, calculationType, rate, formulaExpression, effectiveFrom, effectiveTo, isActive } = req.body;
        const [result] = await pool.query(
            `UPDATE statutory_configurations SET name = ?, componentCode = ?, calculationType = ?,
             rate = ?, formulaExpression = ?, effectiveFrom = ?, effectiveTo = ?, isActive = ? WHERE id = ?`,
            [name, componentCode, calculationType, rate || null, formulaExpression || null, effectiveFrom, effectiveTo || null, isActive !== undefined ? isActive : true, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Statutory configuration not found" });
        }
        const [updatedConfig] = await pool.query("SELECT * FROM statutory_configurations WHERE id = ?", [req.params.id]);
        res.json(updatedConfig[0]);
    } catch (error) {
        console.error("Error updating statutory configuration:", error);
        res.status(500).json({ message: "Error updating statutory configuration", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM statutory_configurations WHERE id = ?",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Statutory configuration not found" });
        }
        res.json({ message: "Statutory configuration deleted successfully" });
    } catch (error) {
        console.error("Error deleting statutory configuration:", error);
        res.status(500).json({ message: "Error deleting statutory configuration", error: error.message });
    }
});

export default router;
