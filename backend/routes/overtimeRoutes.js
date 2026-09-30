import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { employeeId, status, fromDate, toDate } = req.query;
        let query = `SELECT * FROM overtime_records WHERE 1=1`;
        const params = [];
        if (employeeId) {
            query += " AND employeeId = ?";
            params.push(employeeId);
        }
        if (status) {
            query += " AND status = ?";
            params.push(status);
        }
        if (fromDate) {
            query += " AND overtimeDate >= ?";
            params.push(fromDate);
        }
        if (toDate) {
            query += " AND overtimeDate <= ?";
            params.push(toDate);
        }
        query += " ORDER BY overtimeDate DESC";
        const [records] = await pool.query(query, params);
        res.json(records);
    } catch (error) {
        console.error("Error fetching overtime records:", error);
        res.status(500).json({ message: "Error fetching overtime records", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [records] = await pool.query("SELECT * FROM overtime_records WHERE id = ?", [req.params.id]);
        if (records.length === 0) {
            return res.status(404).json({ message: "Overtime record not found" });
        }
        res.json(records[0]);
    } catch (error) {
        console.error("Error fetching overtime record:", error);
        res.status(500).json({ message: "Error fetching overtime record", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { employeeId, attendanceId, overtimeDate, overtimeMinutes, hourlyRate, source, remarks } = req.body;
        const amount = overtimeMinutes * (hourlyRate / 60);
        const [result] = await pool.query(
            `INSERT INTO overtime_records (employeeId, attendanceId, overtimeDate, overtimeMinutes, hourlyRate, amount, source, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [employeeId, attendanceId || null, overtimeDate, overtimeMinutes, hourlyRate, amount, source || "manual", remarks || null]
        );
        const [newRecord] = await pool.query("SELECT * FROM overtime_records WHERE id = ?", [result.insertId]);
        res.status(201).json(newRecord[0]);
    } catch (error) {
        console.error("Error creating overtime record:", error);
        res.status(500).json({ message: "Error creating overtime record", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { overtimeMinutes, hourlyRate, remarks } = req.body;
        const amount = overtimeMinutes * (hourlyRate / 60);
        const [result] = await pool.query(
            "UPDATE overtime_records SET overtimeMinutes = ?, hourlyRate = ?, amount = ?, remarks = ? WHERE id = ?",
            [overtimeMinutes, hourlyRate, amount, remarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Overtime record not found" });
        }
        const [updatedRecord] = await pool.query("SELECT * FROM overtime_records WHERE id = ?", [req.params.id]);
        res.json(updatedRecord[0]);
    } catch (error) {
        console.error("Error updating overtime record:", error);
        res.status(500).json({ message: "Error updating overtime record", error: error.message });
    }
});

router.patch("/:id/approve", async (req, res) => {
    try {
        const { status, approvedBy, remarks } = req.body;
        const [result] = await pool.query(
            `UPDATE overtime_records SET status = ?, approvedBy = ?, approvedAt = NOW(), remarks = ? WHERE id = ?`,
            [status, approvedBy || null, remarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Overtime record not found" });
        }
        const [updatedRecord] = await pool.query("SELECT * FROM overtime_records WHERE id = ?", [req.params.id]);
        res.json(updatedRecord[0]);
    } catch (error) {
        console.error("Error approving overtime record:", error);
        res.status(500).json({ message: "Error approving overtime record", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM overtime_records WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Overtime record not found" });
        }
        res.json({ message: "Overtime record deleted successfully" });
    } catch (error) {
        console.error("Error deleting overtime record:", error);
        res.status(500).json({ message: "Error deleting overtime record", error: error.message });
    }
});

export default router;
