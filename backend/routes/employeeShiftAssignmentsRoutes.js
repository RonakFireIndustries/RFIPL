import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/employee/:employeeId", async (req, res) => {
    try {
        const [assignments] = await pool.query(`
            SELECT esa.*, s.name AS shiftName, s.startTime, s.endTime
            FROM employee_shift_assignments esa
            LEFT JOIN shifts s ON esa.shiftId = s.id
            WHERE esa.employeeId = ?
            ORDER BY esa.effectiveFrom DESC
        `, [req.params.employeeId]);
        res.json(assignments);
    } catch (error) {
        console.error("Error fetching shift assignments:", error);
        res.status(500).json({ message: "Error fetching shift assignments", error: error.message });
    }
});

router.get("/active/:employeeId", async (req, res) => {
    try {
        const [assignments] = await pool.query(`
            SELECT esa.*, s.name AS shiftName, s.startTime, s.endTime
            FROM employee_shift_assignments esa
            LEFT JOIN shifts s ON esa.shiftId = s.id
            WHERE esa.employeeId = ? AND esa.isActive = 1
               AND (esa.effectiveTo IS NULL OR esa.effectiveTo >= CURDATE())
            ORDER BY esa.effectiveFrom DESC LIMIT 1
        `, [req.params.employeeId]);
        if (assignments.length === 0) {
            return res.status(404).json({ message: "No active shift assignment found" });
        }
        res.json(assignments[0]);
    } catch (error) {
        console.error("Error fetching active shift assignment:", error);
        res.status(500).json({ message: "Error fetching active shift assignment", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [assignments] = await pool.query(`
            SELECT esa.*, s.name AS shiftName, s.startTime, s.endTime
            FROM employee_shift_assignments esa
            LEFT JOIN shifts s ON esa.shiftId = s.id
            WHERE esa.id = ?
        `, [req.params.id]);
        if (assignments.length === 0) {
            return res.status(404).json({ message: "Shift assignment not found" });
        }
        res.json(assignments[0]);
    } catch (error) {
        console.error("Error fetching shift assignment:", error);
        res.status(500).json({ message: "Error fetching shift assignment", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { employeeId, shiftId, effectiveFrom, effectiveTo, isActive, createdBy } = req.body;
        const [result] = await pool.query(
            `INSERT INTO employee_shift_assignments (employeeId, shiftId, effectiveFrom, effectiveTo, isActive, createdBy)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [employeeId, shiftId, effectiveFrom, effectiveTo || null, isActive !== undefined ? isActive : true, createdBy || null]
        );
        const [newAssignment] = await pool.query("SELECT * FROM employee_shift_assignments WHERE id = ?", [result.insertId]);
        res.status(201).json(newAssignment[0]);
    } catch (error) {
        console.error("Error creating shift assignment:", error);
        res.status(500).json({ message: "Error creating shift assignment", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { shiftId, effectiveFrom, effectiveTo, isActive } = req.body;
        const [result] = await pool.query(
            `UPDATE employee_shift_assignments SET shiftId = ?, effectiveFrom = ?, effectiveTo = ?, isActive = ?
             WHERE id = ?`,
            [shiftId, effectiveFrom, effectiveTo || null, isActive !== undefined ? isActive : true, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Shift assignment not found" });
        }
        const [updatedAssignment] = await pool.query("SELECT * FROM employee_shift_assignments WHERE id = ?", [req.params.id]);
        res.json(updatedAssignment[0]);
    } catch (error) {
        console.error("Error updating shift assignment:", error);
        res.status(500).json({ message: "Error updating shift assignment", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM employee_shift_assignments WHERE id = ?",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Shift assignment not found" });
        }
        res.json({ message: "Shift assignment deleted successfully" });
    } catch (error) {
        console.error("Error deleting shift assignment:", error);
        res.status(500).json({ message: "Error deleting shift assignment", error: error.message });
    }
});

export default router;
