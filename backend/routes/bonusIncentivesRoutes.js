import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { employeeId, type, status, applicableMonth } = req.query;
        let query = `SELECT bi.*, e.firstName, e.lastName, e.employeeCode
                     FROM bonus_incentives bi
                     LEFT JOIN employees e ON bi.employeeId = e.id WHERE 1=1`;
        const params = [];
        if (employeeId) { query += " AND bi.employeeId = ?"; params.push(employeeId); }
        if (type) { query += " AND bi.type = ?"; params.push(type); }
        if (status) { query += " AND bi.status = ?"; params.push(status); }
        if (applicableMonth) { query += " AND bi.applicableMonth = ?"; params.push(applicableMonth); }
        query += " ORDER BY bi.createdAt DESC";
        const [records] = await pool.query(query, params);
        res.json(records);
    } catch (error) {
        console.error("Error fetching bonus/incentives:", error);
        res.status(500).json({ message: "Error fetching bonus/incentives", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [records] = await pool.query(
            `SELECT bi.*, e.firstName, e.lastName, e.employeeCode
             FROM bonus_incentives bi
             LEFT JOIN employees e ON bi.employeeId = e.id
             WHERE bi.id = ?`,
            [req.params.id]
        );
        if (records.length === 0) {
            return res.status(404).json({ message: "Bonus/incentive not found" });
        }
        res.json(records[0]);
    } catch (error) {
        console.error("Error fetching bonus/incentive:", error);
        res.status(500).json({ message: "Error fetching bonus/incentive", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { employeeId, type, amount, reason, applicableMonth, createdBy } = req.body;
        const [result] = await pool.query(
            `INSERT INTO bonus_incentives (employeeId, type, amount, reason, applicableMonth, createdBy)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [employeeId, type, amount, reason || null, applicableMonth, createdBy || null]
        );
        const [newRecord] = await pool.query("SELECT * FROM bonus_incentives WHERE id = ?", [result.insertId]);
        res.status(201).json(newRecord[0]);
    } catch (error) {
        console.error("Error creating bonus/incentive:", error);
        res.status(500).json({ message: "Error creating bonus/incentive", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { type, amount, reason, applicableMonth } = req.body;
        const [result] = await pool.query(
            "UPDATE bonus_incentives SET type = ?, amount = ?, reason = ?, applicableMonth = ? WHERE id = ?",
            [type, amount, reason || null, applicableMonth, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Bonus/incentive not found" });
        }
        const [updatedRecord] = await pool.query("SELECT * FROM bonus_incentives WHERE id = ?", [req.params.id]);
        res.json(updatedRecord[0]);
    } catch (error) {
        console.error("Error updating bonus/incentive:", error);
        res.status(500).json({ message: "Error updating bonus/incentive", error: error.message });
    }
});

router.patch("/:id/approve", async (req, res) => {
    try {
        const { status, approvedBy } = req.body;
        const [result] = await pool.query(
            "UPDATE bonus_incentives SET status = ?, approvedBy = ?, approvedAt = NOW() WHERE id = ?",
            [status, approvedBy || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Bonus/incentive not found" });
        }
        const [updatedRecord] = await pool.query("SELECT * FROM bonus_incentives WHERE id = ?", [req.params.id]);
        res.json(updatedRecord[0]);
    } catch (error) {
        console.error("Error approving bonus/incentive:", error);
        res.status(500).json({ message: "Error approving bonus/incentive", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM bonus_incentives WHERE id = ? AND status = 'pending'", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Bonus/incentive not found or already processed" });
        }
        res.json({ message: "Bonus/incentive deleted successfully" });
    } catch (error) {
        console.error("Error deleting bonus/incentive:", error);
        res.status(500).json({ message: "Error deleting bonus/incentive", error: error.message });
    }
});

export default router;
