import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { componentType } = req.query;
        let query = "SELECT * FROM salary_components WHERE deletedAt IS NULL";
        const params = [];
        if (componentType) {
            query += " AND componentType = ?";
            params.push(componentType);
        }
        query += " ORDER BY name";
        const [components] = await pool.query(query, params);
        res.json(components);
    } catch (error) {
        console.error("Error fetching salary components:", error);
        res.status(500).json({ message: "Error fetching salary components", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [components] = await pool.query(
            "SELECT * FROM salary_components WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (components.length === 0) {
            return res.status(404).json({ message: "Salary component not found" });
        }
        res.json(components[0]);
    } catch (error) {
        console.error("Error fetching salary component:", error);
        res.status(500).json({ message: "Error fetching salary component", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const {
            name, code, componentType, calculationType, formulaExpression,
            isTaxable, pfApplicable, esiApplicable, isStatutory, isActive
        } = req.body;
        const [result] = await pool.query(
            `INSERT INTO salary_components (name, code, componentType, calculationType, formulaExpression, isTaxable, pfApplicable, esiApplicable, isStatutory, isActive)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, code, componentType, calculationType, formulaExpression || null,
                isTaxable !== undefined ? isTaxable : false,
                pfApplicable !== undefined ? pfApplicable : false,
                esiApplicable !== undefined ? esiApplicable : false,
                isStatutory !== undefined ? isStatutory : false,
                isActive !== undefined ? isActive : true
            ]
        );
        const [newComponent] = await pool.query("SELECT * FROM salary_components WHERE id = ?", [result.insertId]);
        res.status(201).json(newComponent[0]);
    } catch (error) {
        console.error("Error creating salary component:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Salary component name or code already exists" });
        }
        res.status(500).json({ message: "Error creating salary component", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const {
            name, code, componentType, calculationType, formulaExpression,
            isTaxable, pfApplicable, esiApplicable, isStatutory, isActive
        } = req.body;
        const [result] = await pool.query(
            `UPDATE salary_components SET name = ?, code = ?, componentType = ?, calculationType = ?,
             formulaExpression = ?, isTaxable = ?, pfApplicable = ?, esiApplicable = ?, isStatutory = ?, isActive = ?
             WHERE id = ? AND deletedAt IS NULL`,
            [
                name, code, componentType, calculationType, formulaExpression || null,
                isTaxable !== undefined ? isTaxable : false,
                pfApplicable !== undefined ? pfApplicable : false,
                esiApplicable !== undefined ? esiApplicable : false,
                isStatutory !== undefined ? isStatutory : false,
                isActive !== undefined ? isActive : true, req.params.id
            ]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Salary component not found" });
        }
        const [updatedComponent] = await pool.query("SELECT * FROM salary_components WHERE id = ?", [req.params.id]);
        res.json(updatedComponent[0]);
    } catch (error) {
        console.error("Error updating salary component:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Salary component name or code already exists" });
        }
        res.status(500).json({ message: "Error updating salary component", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE salary_components SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Salary component not found" });
        }
        res.json({ message: "Salary component deleted successfully" });
    } catch (error) {
        console.error("Error deleting salary component:", error);
        res.status(500).json({ message: "Error deleting salary component", error: error.message });
    }
});

export default router;
