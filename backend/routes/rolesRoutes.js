import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const [roles] = await pool.query(
            "SELECT * FROM roles WHERE deletedAt IS NULL ORDER BY name"
        );
        res.json(roles);
    } catch (error) {
        console.error("Error fetching roles:", error);
        res.status(500).json({ message: "Error fetching roles", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [roles] = await pool.query(
            "SELECT * FROM roles WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (roles.length === 0) {
            return res.status(404).json({ message: "Role not found" });
        }
        const [permissions] = await pool.query(
            `SELECT p.* FROM permissions p
             JOIN role_permissions rp ON rp.permissionId = p.id
             WHERE rp.roleId = ?`,
            [req.params.id]
        );
        res.json({ ...roles[0], permissions });
    } catch (error) {
        console.error("Error fetching role:", error);
        res.status(500).json({ message: "Error fetching role", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, description, isSystemRole } = req.body;
        const [result] = await pool.query(
            "INSERT INTO roles (name, description, isSystemRole) VALUES (?, ?, ?)",
            [name, description || null, isSystemRole !== undefined ? isSystemRole : false]
        );
        const [newRole] = await pool.query("SELECT * FROM roles WHERE id = ?", [result.insertId]);
        res.status(201).json(newRole[0]);
    } catch (error) {
        console.error("Error creating role:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Role name already exists" });
        }
        res.status(500).json({ message: "Error creating role", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, description, isSystemRole } = req.body;
        const [result] = await pool.query(
            "UPDATE roles SET name = ?, description = ?, isSystemRole = ? WHERE id = ? AND deletedAt IS NULL",
            [name, description || null, isSystemRole !== undefined ? isSystemRole : false, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Role not found" });
        }
        const [updatedRole] = await pool.query("SELECT * FROM roles WHERE id = ?", [req.params.id]);
        res.json(updatedRole[0]);
    } catch (error) {
        console.error("Error updating role:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Role name already exists" });
        }
        res.status(500).json({ message: "Error updating role", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE roles SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Role not found" });
        }
        res.json({ message: "Role deleted successfully" });
    } catch (error) {
        console.error("Error deleting role:", error);
        res.status(500).json({ message: "Error deleting role", error: error.message });
    }
});

export default router;
