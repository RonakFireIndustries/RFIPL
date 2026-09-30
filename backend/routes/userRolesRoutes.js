import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/user/:userId", async (req, res) => {
    try {
        const [roles] = await pool.query(
            `SELECT r.* FROM roles r
             JOIN user_roles ur ON ur.roleId = r.id
             WHERE ur.userId = ? AND r.deletedAt IS NULL`,
            [req.params.userId]
        );
        res.json(roles);
    } catch (error) {
        console.error("Error fetching user roles:", error);
        res.status(500).json({ message: "Error fetching user roles", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { userId, roleId } = req.body;
        const [result] = await pool.query(
            "INSERT INTO user_roles (userId, roleId) VALUES (?, ?)",
            [userId, roleId]
        );
        res.status(201).json({ message: "Role assigned to user", userId, roleId });
    } catch (error) {
        console.error("Error assigning role to user:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Role already assigned to user" });
        }
        res.status(500).json({ message: "Error assigning role to user", error: error.message });
    }
});

router.delete("/", async (req, res) => {
    try {
        const { userId, roleId } = req.body;
        const [result] = await pool.query(
            "DELETE FROM user_roles WHERE userId = ? AND roleId = ?",
            [userId, roleId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Assignment not found" });
        }
        res.json({ message: "Role removed from user" });
    } catch (error) {
        console.error("Error removing role from user:", error);
        res.status(500).json({ message: "Error removing role from user", error: error.message });
    }
});

export default router;
