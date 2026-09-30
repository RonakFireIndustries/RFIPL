import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { employeeId, status } = req.query;
        let query = "SELECT * FROM attendance_corrections WHERE 1=1";
        const params = [];
        if (employeeId) {
            query += " AND employeeId = ?";
            params.push(employeeId);
        }
        if (status) {
            query += " AND status = ?";
            params.push(status);
        }
        query += " ORDER BY requestedAt DESC";
        const [corrections] = await pool.query(query, params);
        res.json(corrections);
    } catch (error) {
        console.error("Error fetching attendance corrections:", error);
        res.status(500).json({ message: "Error fetching attendance corrections", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [corrections] = await pool.query(
            "SELECT * FROM attendance_corrections WHERE id = ?",
            [req.params.id]
        );
        if (corrections.length === 0) {
            return res.status(404).json({ message: "Correction not found" });
        }
        res.json(corrections[0]);
    } catch (error) {
        console.error("Error fetching correction:", error);
        res.status(500).json({ message: "Error fetching correction", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { employeeId, attendanceId, correctionType, requestedCheckInAt, requestedCheckOutAt, reason } = req.body;
        const [result] = await pool.query(
            `INSERT INTO attendance_corrections (employeeId, attendanceId, correctionType, requestedCheckInAt, requestedCheckOutAt, reason)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [employeeId, attendanceId || null, correctionType, requestedCheckInAt || null, requestedCheckOutAt || null, reason]
        );
        const [newCorrection] = await pool.query("SELECT * FROM attendance_corrections WHERE id = ?", [result.insertId]);
        res.status(201).json(newCorrection[0]);
    } catch (error) {
        console.error("Error creating correction:", error);
        res.status(500).json({ message: "Error creating correction", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { correctionType, requestedCheckInAt, requestedCheckOutAt, reason } = req.body;
        const [result] = await pool.query(
            `UPDATE attendance_corrections SET correctionType = ?, requestedCheckInAt = ?,
             requestedCheckOutAt = ?, reason = ? WHERE id = ?`,
            [correctionType, requestedCheckInAt || null, requestedCheckOutAt || null, reason, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Correction not found" });
        }
        const [updatedCorrection] = await pool.query("SELECT * FROM attendance_corrections WHERE id = ?", [req.params.id]);
        res.json(updatedCorrection[0]);
    } catch (error) {
        console.error("Error updating correction:", error);
        res.status(500).json({ message: "Error updating correction", error: error.message });
    }
});

router.patch("/:id/review", async (req, res) => {
    try {
        const { status, reviewRemarks, reviewedBy } = req.body;
        const [result] = await pool.query(
            `UPDATE attendance_corrections SET status = ?, reviewRemarks = ?, reviewedBy = ?, reviewedAt = NOW()
             WHERE id = ?`,
            [status, reviewRemarks || null, reviewedBy || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Correction not found" });
        }
        const [updatedCorrection] = await pool.query("SELECT * FROM attendance_corrections WHERE id = ?", [req.params.id]);
        res.json(updatedCorrection[0]);
    } catch (error) {
        console.error("Error reviewing correction:", error);
        res.status(500).json({ message: "Error reviewing correction", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM attendance_corrections WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Correction not found" });
        }
        res.json({ message: "Correction deleted successfully" });
    } catch (error) {
        console.error("Error deleting correction:", error);
        res.status(500).json({ message: "Error deleting correction", error: error.message });
    }
});

export default router;
