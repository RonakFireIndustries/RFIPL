import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const [rules] = await pool.query("SELECT * FROM attendance_rules ORDER BY id DESC LIMIT 1");
        if (rules.length === 0) {
            const [result] = await pool.query("INSERT INTO attendance_rules () VALUES ()");
            const [created] = await pool.query("SELECT * FROM attendance_rules WHERE id = ?", [result.insertId]);
            return res.json(created[0]);
        }
        res.json(rules[0]);
    } catch (error) {
        console.error("Error fetching attendance rules:", error);
        res.status(500).json({ message: "Error fetching attendance rules", error: error.message });
    }
});

router.put("/", async (req, res) => {
    try {
        const { lateHalfDayThreshold, lateFullDayThreshold, autoAbsentEnabled } = req.body;
        const [existing] = await pool.query("SELECT * FROM attendance_rules ORDER BY id DESC LIMIT 1");
        if (existing.length === 0) {
            const [result] = await pool.query(
                `INSERT INTO attendance_rules (lateHalfDayThreshold, lateFullDayThreshold, autoAbsentEnabled)
                 VALUES (?, ?, ?)`,
                [lateHalfDayThreshold || 3, lateFullDayThreshold || 5, autoAbsentEnabled !== undefined ? autoAbsentEnabled : true]
            );
            const [created] = await pool.query("SELECT * FROM attendance_rules WHERE id = ?", [result.insertId]);
            return res.json(created[0]);
        }
        await pool.query(
            `UPDATE attendance_rules SET lateHalfDayThreshold = ?, lateFullDayThreshold = ?, autoAbsentEnabled = ? WHERE id = ?`,
            [lateHalfDayThreshold || 3, lateFullDayThreshold || 5, autoAbsentEnabled !== undefined ? autoAbsentEnabled : true, existing[0].id]
        );
        const [updated] = await pool.query("SELECT * FROM attendance_rules WHERE id = ?", [existing[0].id]);
        res.json(updated[0]);
    } catch (error) {
        console.error("Error updating attendance rules:", error);
        res.status(500).json({ message: "Error updating attendance rules", error: error.message });
    }
});

export default router;
