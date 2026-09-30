import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { status } = req.query;
        let query = "SELECT * FROM payroll_periods";
        const params = [];
        if (status) {
            query += " WHERE status = ?";
            params.push(status);
        }
        query += " ORDER BY yearNumber DESC, monthNumber DESC";
        const [periods] = await pool.query(query, params);
        res.json(periods);
    } catch (error) {
        console.error("Error fetching payroll periods:", error);
        res.status(500).json({ message: "Error fetching payroll periods", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [periods] = await pool.query(
            "SELECT * FROM payroll_periods WHERE id = ?",
            [req.params.id]
        );
        if (periods.length === 0) {
            return res.status(404).json({ message: "Payroll period not found" });
        }
        res.json(periods[0]);
    } catch (error) {
        console.error("Error fetching payroll period:", error);
        res.status(500).json({ message: "Error fetching payroll period", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, monthNumber, yearNumber, startDate, endDate } = req.body;
        const periodName = name || `${new Date(yearNumber, monthNumber - 1).toLocaleString('default', { month: 'long' })} ${yearNumber}`;
        const [result] = await pool.query(
            "INSERT INTO payroll_periods (name, monthNumber, yearNumber, startDate, endDate) VALUES (?, ?, ?, ?, ?)",
            [periodName, monthNumber, yearNumber, startDate, endDate]
        );
        const [newPeriod] = await pool.query("SELECT * FROM payroll_periods WHERE id = ?", [result.insertId]);
        res.status(201).json(newPeriod[0]);
    } catch (error) {
        console.error("Error creating payroll period:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Payroll period already exists for this month/year" });
        }
        res.status(500).json({ message: "Error creating payroll period", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { status } = req.body;
        const [result] = await pool.query(
            "UPDATE payroll_periods SET status = ? WHERE id = ?",
            [status, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Payroll period not found" });
        }
        const [updatedPeriod] = await pool.query("SELECT * FROM payroll_periods WHERE id = ?", [req.params.id]);
        res.json(updatedPeriod[0]);
    } catch (error) {
        console.error("Error updating payroll period:", error);
        res.status(500).json({ message: "Error updating payroll period", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM payroll_periods WHERE id = ? AND status = 'open'",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Payroll period not found or already processed" });
        }
        res.json({ message: "Payroll period deleted successfully" });
    } catch (error) {
        console.error("Error deleting payroll period:", error);
        res.status(500).json({ message: "Error deleting payroll period", error: error.message });
    }
});

export default router;
