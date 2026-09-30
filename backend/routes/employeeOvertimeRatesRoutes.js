import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/employee/:employeeId", async (req, res) => {
    try {
        const [rates] = await pool.query(
            "SELECT * FROM employee_overtime_rates WHERE employeeId = ? ORDER BY effectiveFrom DESC",
            [req.params.employeeId]
        );
        res.json(rates);
    } catch (error) {
        console.error("Error fetching overtime rates:", error);
        res.status(500).json({ message: "Error fetching overtime rates", error: error.message });
    }
});

router.get("/active/:employeeId", async (req, res) => {
    try {
        const [rates] = await pool.query(
            `SELECT * FROM employee_overtime_rates
             WHERE employeeId = ? AND isActive = 1
               AND (effectiveTo IS NULL OR effectiveTo >= CURDATE())
             ORDER BY effectiveFrom DESC LIMIT 1`,
            [req.params.employeeId]
        );
        if (rates.length === 0) {
            return res.status(404).json({ message: "No active overtime rate found" });
        }
        res.json(rates[0]);
    } catch (error) {
        console.error("Error fetching active overtime rate:", error);
        res.status(500).json({ message: "Error fetching active overtime rate", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [rates] = await pool.query(
            "SELECT * FROM employee_overtime_rates WHERE id = ?",
            [req.params.id]
        );
        if (rates.length === 0) {
            return res.status(404).json({ message: "Overtime rate not found" });
        }
        res.json(rates[0]);
    } catch (error) {
        console.error("Error fetching overtime rate:", error);
        res.status(500).json({ message: "Error fetching overtime rate", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { employeeId, hourlyRate, effectiveFrom, effectiveTo, isActive } = req.body;
        const [result] = await pool.query(
            `INSERT INTO employee_overtime_rates (employeeId, hourlyRate, effectiveFrom, effectiveTo, isActive)
             VALUES (?, ?, ?, ?, ?)`,
            [employeeId, hourlyRate, effectiveFrom, effectiveTo || null, isActive !== undefined ? isActive : true]
        );
        const [newRate] = await pool.query("SELECT * FROM employee_overtime_rates WHERE id = ?", [result.insertId]);
        res.status(201).json(newRate[0]);
    } catch (error) {
        console.error("Error creating overtime rate:", error);
        res.status(500).json({ message: "Error creating overtime rate", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { hourlyRate, effectiveFrom, effectiveTo, isActive } = req.body;
        const [result] = await pool.query(
            `UPDATE employee_overtime_rates SET hourlyRate = ?, effectiveFrom = ?, effectiveTo = ?, isActive = ?
             WHERE id = ?`,
            [hourlyRate, effectiveFrom, effectiveTo || null, isActive !== undefined ? isActive : true, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Overtime rate not found" });
        }
        const [updatedRate] = await pool.query("SELECT * FROM employee_overtime_rates WHERE id = ?", [req.params.id]);
        res.json(updatedRate[0]);
    } catch (error) {
        console.error("Error updating overtime rate:", error);
        res.status(500).json({ message: "Error updating overtime rate", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM employee_overtime_rates WHERE id = ?",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Overtime rate not found" });
        }
        res.json({ message: "Overtime rate deleted successfully" });
    } catch (error) {
        console.error("Error deleting overtime rate:", error);
        res.status(500).json({ message: "Error deleting overtime rate", error: error.message });
    }
});

export default router;
