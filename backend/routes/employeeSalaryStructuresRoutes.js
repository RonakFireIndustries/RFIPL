import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/employee/:employeeId", async (req, res) => {
    try {
        const [structures] = await pool.query(`
            SELECT ess.*, ss.name AS structureName, ss.description AS structureDescription
            FROM employee_salary_structures ess
            LEFT JOIN salary_structures ss ON ess.salaryStructureId = ss.id
            WHERE ess.employeeId = ?
            ORDER BY ess.effectiveFrom DESC
        `, [req.params.employeeId]);
        res.json(structures);
    } catch (error) {
        console.error("Error fetching employee salary structures:", error);
        res.status(500).json({ message: "Error fetching employee salary structures", error: error.message });
    }
});

router.get("/active/:employeeId", async (req, res) => {
    try {
        const [structures] = await pool.query(`
            SELECT ess.*, ss.name AS structureName, ss.description AS structureDescription
            FROM employee_salary_structures ess
            LEFT JOIN salary_structures ss ON ess.salaryStructureId = ss.id
            WHERE ess.employeeId = ? AND ess.status = 'active'
               AND (ess.effectiveTo IS NULL OR ess.effectiveTo >= CURDATE())
            ORDER BY ess.effectiveFrom DESC LIMIT 1
        `, [req.params.employeeId]);
        if (structures.length === 0) {
            return res.status(404).json({ message: "No active salary structure found" });
        }
        res.json(structures[0]);
    } catch (error) {
        console.error("Error fetching active salary structure:", error);
        res.status(500).json({ message: "Error fetching active salary structure", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [structures] = await pool.query(`
            SELECT ess.*, ss.name AS structureName, ss.description AS structureDescription
            FROM employee_salary_structures ess
            LEFT JOIN salary_structures ss ON ess.salaryStructureId = ss.id
            WHERE ess.id = ?
        `, [req.params.id]);
        if (structures.length === 0) {
            return res.status(404).json({ message: "Salary structure assignment not found" });
        }
        res.json(structures[0]);
    } catch (error) {
        console.error("Error fetching salary structure:", error);
        res.status(500).json({ message: "Error fetching salary structure", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { employeeId, salaryStructureId, effectiveFrom, effectiveTo, status, revisionReason, createdBy } = req.body;
        const [result] = await pool.query(
            `INSERT INTO employee_salary_structures (employeeId, salaryStructureId, effectiveFrom, effectiveTo, status, revisionReason, createdBy)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [employeeId, salaryStructureId, effectiveFrom, effectiveTo || null, status || "active", revisionReason || null, createdBy || null]
        );
        const [newStructure] = await pool.query("SELECT * FROM employee_salary_structures WHERE id = ?", [result.insertId]);
        res.status(201).json(newStructure[0]);
    } catch (error) {
        console.error("Error creating salary structure assignment:", error);
        res.status(500).json({ message: "Error creating salary structure assignment", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { salaryStructureId, effectiveFrom, effectiveTo, status, revisionReason } = req.body;
        const [result] = await pool.query(
            `UPDATE employee_salary_structures SET salaryStructureId = ?, effectiveFrom = ?, effectiveTo = ?,
             status = ?, revisionReason = ? WHERE id = ?`,
            [salaryStructureId, effectiveFrom, effectiveTo || null, status || "active", revisionReason || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Salary structure assignment not found" });
        }
        const [updatedStructure] = await pool.query("SELECT * FROM employee_salary_structures WHERE id = ?", [req.params.id]);
        res.json(updatedStructure[0]);
    } catch (error) {
        console.error("Error updating salary structure assignment:", error);
        res.status(500).json({ message: "Error updating salary structure assignment", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM employee_salary_structures WHERE id = ?",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Salary structure assignment not found" });
        }
        res.json({ message: "Salary structure assignment deleted successfully" });
    } catch (error) {
        console.error("Error deleting salary structure assignment:", error);
        res.status(500).json({ message: "Error deleting salary structure assignment", error: error.message });
    }
});

export default router;
