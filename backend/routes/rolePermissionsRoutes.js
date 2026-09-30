import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/role/:roleId", async (req, res) => {
    try {
        const [permissions] = await pool.query(
            `SELECT p.* FROM permissions p
             JOIN role_permissions rp ON rp.permissionId = p.id
             WHERE rp.roleId = ?`,
            [req.params.roleId]
        );
        res.json(permissions);
    } catch (error) {
        console.error("Error fetching role permissions:", error);
        res.status(500).json({ message: "Error fetching role permissions", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { roleId, permissionId } = req.body;
        await pool.query(
            "INSERT INTO role_permissions (roleId, permissionId) VALUES (?, ?)",
            [roleId, permissionId]
        );
        res.status(201).json({ message: "Permission assigned to role", roleId, permissionId });
    } catch (error) {
        console.error("Error assigning permission to role:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Permission already assigned to role" });
        }
        res.status(500).json({ message: "Error assigning permission to role", error: error.message });
    }
});

router.delete("/", async (req, res) => {
    try {
        const { roleId, permissionId } = req.body;
        const [result] = await pool.query(
            "DELETE FROM role_permissions WHERE roleId = ? AND permissionId = ?",
            [roleId, permissionId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Assignment not found" });
        }
        res.json({ message: "Permission removed from role" });
    } catch (error) {
        console.error("Error removing permission from role:", error);
        res.status(500).json({ message: "Error removing permission from role", error: error.message });
    }
});

export default router;
