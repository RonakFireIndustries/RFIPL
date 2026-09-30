import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const [designations] = await pool.query(
            "SELECT * FROM designations WHERE deletedAt IS NULL ORDER BY name"
        );
        res.json(designations);
    } catch (error) {
        console.error("Error fetching designations:", error);
        res.status(500).json({ message: "Error fetching designations", error: error.message });
    }
});

router.get("/active", async (req, res) => {
    try {
        const [designations] = await pool.query(
            "SELECT * FROM designations WHERE isActive = 1 AND deletedAt IS NULL ORDER BY name"
        );
        res.json(designations);
    } catch (error) {
        console.error("Error fetching active designations:", error);
        res.status(500).json({ message: "Error fetching active designations", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [designations] = await pool.query(
            "SELECT * FROM designations WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (designations.length === 0) {
            return res.status(404).json({ message: "Designation not found" });
        }
        res.json(designations[0]);
    } catch (error) {
        console.error("Error fetching designation:", error);
        res.status(500).json({ message: "Error fetching designation", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, code, description, isActive } = req.body;
        const [result] = await pool.query(
            "INSERT INTO designations (name, code, description, isActive) VALUES (?, ?, ?, ?)",
            [name, code, description || null, isActive !== undefined ? isActive : true]
        );
        const [newDesignation] = await pool.query("SELECT * FROM designations WHERE id = ?", [result.insertId]);
        res.status(201).json(newDesignation[0]);
    } catch (error) {
        console.error("Error creating designation:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Designation name or code already exists" });
        }
        res.status(500).json({ message: "Error creating designation", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, code, description, isActive } = req.body;
        const [result] = await pool.query(
            "UPDATE designations SET name = ?, code = ?, description = ?, isActive = ? WHERE id = ? AND deletedAt IS NULL",
            [name, code, description || null, isActive !== undefined ? isActive : true, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Designation not found" });
        }
        const [updatedDesignation] = await pool.query("SELECT * FROM designations WHERE id = ?", [req.params.id]);
        res.json(updatedDesignation[0]);
    } catch (error) {
        console.error("Error updating designation:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Designation name or code already exists" });
        }
        res.status(500).json({ message: "Error updating designation", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE designations SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Designation not found" });
        }
        res.json({ message: "Designation deleted successfully" });
    } catch (error) {
        console.error("Error deleting designation:", error);
        res.status(500).json({ message: "Error deleting designation", error: error.message });
    }
});

export default router;
