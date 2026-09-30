import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const [structures] = await pool.query(
            "SELECT * FROM salary_structures WHERE deletedAt IS NULL ORDER BY name"
        );
        res.json(structures);
    } catch (error) {
        console.error("Error fetching salary structures:", error);
        res.status(500).json({ message: "Error fetching salary structures", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [structures] = await pool.query(
            "SELECT * FROM salary_structures WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (structures.length === 0) {
            return res.status(404).json({ message: "Salary structure not found" });
        }
        const [components] = await pool.query(
            `SELECT ssc.*, sc.name AS componentName, sc.code AS componentCode, sc.componentType
             FROM salary_structure_components ssc
             JOIN salary_components sc ON ssc.salaryComponentId = sc.id
             WHERE ssc.salaryStructureId = ?
             ORDER BY ssc.sortOrder`,
            [req.params.id]
        );
        structures[0].components = components;
        res.json(structures[0]);
    } catch (error) {
        console.error("Error fetching salary structure:", error);
        res.status(500).json({ message: "Error fetching salary structure", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, description, isActive } = req.body;
        const [result] = await pool.query(
            "INSERT INTO salary_structures (name, description, isActive) VALUES (?, ?, ?)",
            [name, description || null, isActive !== undefined ? isActive : true]
        );
        const [newStructure] = await pool.query("SELECT * FROM salary_structures WHERE id = ?", [result.insertId]);
        res.status(201).json(newStructure[0]);
    } catch (error) {
        console.error("Error creating salary structure:", error);
        res.status(500).json({ message: "Error creating salary structure", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, description, isActive } = req.body;
        const [result] = await pool.query(
            "UPDATE salary_structures SET name = ?, description = ?, isActive = ? WHERE id = ? AND deletedAt IS NULL",
            [name, description || null, isActive !== undefined ? isActive : true, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Salary structure not found" });
        }
        const [updatedStructure] = await pool.query("SELECT * FROM salary_structures WHERE id = ?", [req.params.id]);
        res.json(updatedStructure[0]);
    } catch (error) {
        console.error("Error updating salary structure:", error);
        res.status(500).json({ message: "Error updating salary structure", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE salary_structures SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Salary structure not found" });
        }
        res.json({ message: "Salary structure deleted successfully" });
    } catch (error) {
        console.error("Error deleting salary structure:", error);
        res.status(500).json({ message: "Error deleting salary structure", error: error.message });
    }
});

router.post("/:id/components", async (req, res) => {
    try {
        const { salaryComponentId, calculationType, amount, percentage, formulaExpression, sortOrder } = req.body;
        const [result] = await pool.query(
            `INSERT INTO salary_structure_components (salaryStructureId, salaryComponentId, calculationType, amount, percentage, formulaExpression, sortOrder)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, salaryComponentId, calculationType, amount || null, percentage || null, formulaExpression || null, sortOrder || 0]
        );
        const [newComponent] = await pool.query(
            `SELECT ssc.*, sc.name AS componentName, sc.code AS componentCode
             FROM salary_structure_components ssc
             JOIN salary_components sc ON ssc.salaryComponentId = sc.id
             WHERE ssc.id = ?`,
            [result.insertId]
        );
        res.status(201).json(newComponent[0]);
    } catch (error) {
        console.error("Error adding component to salary structure:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Component already exists in this structure" });
        }
        res.status(500).json({ message: "Error adding component to salary structure", error: error.message });
    }
});

router.delete("/:id/components/:componentId", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM salary_structure_components WHERE salaryStructureId = ? AND id = ?",
            [req.params.id, req.params.componentId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Component not found in this structure" });
        }
        res.json({ message: "Component removed from salary structure" });
    } catch (error) {
        console.error("Error removing component from salary structure:", error);
        res.status(500).json({ message: "Error removing component from salary structure", error: error.message });
    }
});

export default router;
