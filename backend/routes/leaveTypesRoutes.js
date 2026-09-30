import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const [types] = await pool.query(
            "SELECT * FROM leave_types WHERE deletedAt IS NULL ORDER BY name"
        );
        res.json(types);
    } catch (error) {
        console.error("Error fetching leave types:", error);
        res.status(500).json({ message: "Error fetching leave types", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [types] = await pool.query(
            "SELECT * FROM leave_types WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (types.length === 0) {
            return res.status(404).json({ message: "Leave type not found" });
        }
        res.json(types[0]);
    } catch (error) {
        console.error("Error fetching leave type:", error);
        res.status(500).json({ message: "Error fetching leave type", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, code, annualLimit, isPaid, isActive } = req.body;
        const [result] = await pool.query(
            "INSERT INTO leave_types (name, code, annualLimit, isPaid, isActive) VALUES (?, ?, ?, ?, ?)",
            [name, code, annualLimit || null, isPaid !== undefined ? isPaid : true, isActive !== undefined ? isActive : true]
        );
        const [newType] = await pool.query("SELECT * FROM leave_types WHERE id = ?", [result.insertId]);
        res.status(201).json(newType[0]);
    } catch (error) {
        console.error("Error creating leave type:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Leave type name or code already exists" });
        }
        res.status(500).json({ message: "Error creating leave type", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, code, annualLimit, isPaid, isActive } = req.body;
        const [result] = await pool.query(
            "UPDATE leave_types SET name = ?, code = ?, annualLimit = ?, isPaid = ?, isActive = ? WHERE id = ? AND deletedAt IS NULL",
            [name, code, annualLimit || null, isPaid !== undefined ? isPaid : true, isActive !== undefined ? isActive : true, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Leave type not found" });
        }
        const [updatedType] = await pool.query("SELECT * FROM leave_types WHERE id = ?", [req.params.id]);
        res.json(updatedType[0]);
    } catch (error) {
        console.error("Error updating leave type:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Leave type name or code already exists" });
        }
        res.status(500).json({ message: "Error updating leave type", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE leave_types SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Leave type not found" });
        }
        res.json({ message: "Leave type deleted successfully" });
    } catch (error) {
        console.error("Error deleting leave type:", error);
        res.status(500).json({ message: "Error deleting leave type", error: error.message });
    }
});

export default router;
