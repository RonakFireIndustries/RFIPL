import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { year } = req.query;
        let query = "SELECT * FROM holidays WHERE deletedAt IS NULL";
        const params = [];
        if (year) {
            query += " AND YEAR(holidayDate) = ?";
            params.push(year);
        }
        query += " ORDER BY holidayDate";
        const [holidays] = await pool.query(query, params);
        res.json(holidays);
    } catch (error) {
        console.error("Error fetching holidays:", error);
        res.status(500).json({ message: "Error fetching holidays", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [holidays] = await pool.query(
            "SELECT * FROM holidays WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (holidays.length === 0) {
            return res.status(404).json({ message: "Holiday not found" });
        }
        res.json(holidays[0]);
    } catch (error) {
        console.error("Error fetching holiday:", error);
        res.status(500).json({ message: "Error fetching holiday", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, holidayDate, description } = req.body;
        const [result] = await pool.query(
            "INSERT INTO holidays (name, holidayDate, description) VALUES (?, ?, ?)",
            [name, holidayDate, description || null]
        );
        const [newHoliday] = await pool.query("SELECT * FROM holidays WHERE id = ?", [result.insertId]);
        res.status(201).json(newHoliday[0]);
    } catch (error) {
        console.error("Error creating holiday:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Holiday already exists for this date" });
        }
        res.status(500).json({ message: "Error creating holiday", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, holidayDate, description } = req.body;
        const [result] = await pool.query(
            "UPDATE holidays SET name = ?, holidayDate = ?, description = ? WHERE id = ? AND deletedAt IS NULL",
            [name, holidayDate, description || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Holiday not found" });
        }
        const [updatedHoliday] = await pool.query("SELECT * FROM holidays WHERE id = ?", [req.params.id]);
        res.json(updatedHoliday[0]);
    } catch (error) {
        console.error("Error updating holiday:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Holiday already exists for this date" });
        }
        res.status(500).json({ message: "Error updating holiday", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE holidays SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Holiday not found" });
        }
        res.json({ message: "Holiday deleted successfully" });
    } catch (error) {
        console.error("Error deleting holiday:", error);
        res.status(500).json({ message: "Error deleting holiday", error: error.message });
    }
});

export default router;
