import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const [shifts] = await pool.query(
            "SELECT *, NAME AS name FROM shifts WHERE deletedAt IS NULL ORDER BY startTime"
        );
        for (const shift of shifts) {
            const [weekOffs] = await pool.query(
                "SELECT dayOfWeek FROM shift_week_offs WHERE shiftId = ?",
                [shift.id]
            );
            shift.weekOffDays = weekOffs.map((w) => w.dayOfWeek);
        }
        res.json(shifts);
    } catch (error) {
        console.error("Error fetching shifts:", error);
        res.status(500).json({ message: "Error fetching shifts", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [shifts] = await pool.query(
            "SELECT *, NAME AS name FROM shifts WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (shifts.length === 0) {
            return res.status(404).json({ message: "Shift not found" });
        }
        const [weekOffs] = await pool.query(
            "SELECT dayOfWeek FROM shift_week_offs WHERE shiftId = ?",
            [req.params.id]
        );
        shifts[0].weekOffDays = weekOffs.map((w) => w.dayOfWeek);
        res.json(shifts[0]);
    } catch (error) {
        console.error("Error fetching shift:", error);
        res.status(500).json({ message: "Error fetching shift", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, startTime, endTime, gracePeriodMinutes, halfDayThresholdMinutes, overtimeAfterEndTime, weekOffDays } = req.body;
        const [result] = await pool.query(
            `INSERT INTO shifts (name, startTime, endTime, gracePeriodMinutes, halfDayThresholdMinutes, overtimeAfterEndTime)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, startTime, endTime, gracePeriodMinutes || 0, halfDayThresholdMinutes || 240, overtimeAfterEndTime !== undefined ? overtimeAfterEndTime : true]
        );
        if (Array.isArray(weekOffDays)) {
            for (const day of weekOffDays) {
                await pool.query(
                    "INSERT INTO shift_week_offs (shiftId, dayOfWeek) VALUES (?, ?)",
                    [result.insertId, day]
                );
            }
        }
        const [newShift] = await pool.query("SELECT *, NAME AS name FROM shifts WHERE id = ?", [result.insertId]);
        res.status(201).json(newShift[0]);
    } catch (error) {
        console.error("Error creating shift:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Shift name already exists" });
        }
        res.status(500).json({ message: "Error creating shift", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, startTime, endTime, gracePeriodMinutes, halfDayThresholdMinutes, overtimeAfterEndTime, weekOffDays } = req.body;
        const [result] = await pool.query(
            `UPDATE shifts SET name = ?, startTime = ?, endTime = ?, gracePeriodMinutes = ?,
             halfDayThresholdMinutes = ?, overtimeAfterEndTime = ? WHERE id = ? AND deletedAt IS NULL`,
            [name, startTime, endTime, gracePeriodMinutes || 0, halfDayThresholdMinutes || 240, overtimeAfterEndTime !== undefined ? overtimeAfterEndTime : true, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Shift not found" });
        }
        if (Array.isArray(weekOffDays)) {
            await pool.query("DELETE FROM shift_week_offs WHERE shiftId = ?", [req.params.id]);
            for (const day of weekOffDays) {
                await pool.query(
                    "INSERT INTO shift_week_offs (shiftId, dayOfWeek) VALUES (?, ?)",
                    [req.params.id, day]
                );
            }
        }
        const [updatedShift] = await pool.query("SELECT *, NAME AS name FROM shifts WHERE id = ?", [req.params.id]);
        res.json(updatedShift[0]);
    } catch (error) {
        console.error("Error updating shift:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Shift name already exists" });
        }
        res.status(500).json({ message: "Error updating shift", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE shifts SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Shift not found" });
        }
        res.json({ message: "Shift deleted successfully" });
    } catch (error) {
        console.error("Error deleting shift:", error);
        res.status(500).json({ message: "Error deleting shift", error: error.message });
    }
});

export default router;
