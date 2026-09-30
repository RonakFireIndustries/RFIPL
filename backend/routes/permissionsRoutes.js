import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { module } = req.query;
        let query = "SELECT * FROM permissions WHERE deletedAt IS NULL";
        const params = [];
        if (module) {
            query += " AND module = ?";
            params.push(module);
        }
        query += " ORDER BY module, name";
        const [permissions] = await pool.query(query, params);
        res.json(permissions);
    } catch (error) {
        console.error("Error fetching permissions:", error);
        res.status(500).json({ message: "Error fetching permissions", error: error.message });
    }
});

router.get("/modules", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT DISTINCT module FROM permissions WHERE deletedAt IS NULL ORDER BY module"
        );
        res.json(rows.map((r) => r.module));
    } catch (error) {
        console.error("Error fetching permission modules:", error);
        res.status(500).json({ message: "Error fetching permission modules", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [permissions] = await pool.query(
            "SELECT * FROM permissions WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (permissions.length === 0) {
            return res.status(404).json({ message: "Permission not found" });
        }
        res.json(permissions[0]);
    } catch (error) {
        console.error("Error fetching permission:", error);
        res.status(500).json({ message: "Error fetching permission", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, module, description } = req.body;
        const [result] = await pool.query(
            "INSERT INTO permissions (name, module, description) VALUES (?, ?, ?)",
            [name, module, description || null]
        );
        const [newPermission] = await pool.query("SELECT * FROM permissions WHERE id = ?", [result.insertId]);
        res.status(201).json(newPermission[0]);
    } catch (error) {
        console.error("Error creating permission:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Permission name already exists" });
        }
        res.status(500).json({ message: "Error creating permission", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, module, description } = req.body;
        const [result] = await pool.query(
            "UPDATE permissions SET name = ?, module = ?, description = ? WHERE id = ? AND deletedAt IS NULL",
            [name, module, description || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Permission not found" });
        }
        const [updatedPermission] = await pool.query("SELECT * FROM permissions WHERE id = ?", [req.params.id]);
        res.json(updatedPermission[0]);
    } catch (error) {
        console.error("Error updating permission:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Permission name already exists" });
        }
        res.status(500).json({ message: "Error updating permission", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE permissions SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Permission not found" });
        }
        res.json({ message: "Permission deleted successfully" });
    } catch (error) {
        console.error("Error deleting permission:", error);
        res.status(500).json({ message: "Error deleting permission", error: error.message });
    }
});

export default router;
