import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware, hashPassword } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { unlinked } = req.query;
        let query = `
            SELECT u.id, u.email, u.isActive, u.lastLoginAt, u.createdAt, u.updatedAt,
                   e.id AS employeeId,
                   CONCAT(e.firstName, ' ', COALESCE(e.lastName, '')) AS employeeName
            FROM users u
            LEFT JOIN employees e ON e.userId = u.id AND e.deletedAt IS NULL
            WHERE u.deletedAt IS NULL
        `;
        const params = [];
        if (unlinked === "1" || unlinked === "true") {
            query += " AND e.id IS NULL";
        }
        query += " ORDER BY u.email";
        const [users] = await pool.query(query, params);
        res.json(users);
    } catch (error) {
        console.error("Error fetching users:", error);
        res.status(500).json({ message: "Error fetching users", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [users] = await pool.query(
            "SELECT id, email, isActive, lastLoginAt, createdAt FROM users WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (users.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        const [roles] = await pool.query(
            `SELECT r.id, r.name FROM roles r
             JOIN user_roles ur ON ur.roleId = r.id
             WHERE ur.userId = ?`,
            [req.params.id]
        );
        res.json({ ...users[0], roles });
    } catch (error) {
        console.error("Error fetching user:", error);
        res.status(500).json({ message: "Error fetching user", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { email, password, isActive } = req.body;
        const passwordHash = await hashPassword(password);
        const [result] = await pool.query(
            "INSERT INTO users (email, passwordHash, isActive) VALUES (?, ?, ?)",
            [email, passwordHash, isActive !== undefined ? isActive : true]
        );
        const [newUser] = await pool.query(
            "SELECT id, email, isActive, createdAt FROM users WHERE id = ?",
            [result.insertId]
        );
        res.status(201).json(newUser[0]);
    } catch (error) {
        console.error("Error creating user:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Email already exists" });
        }
        res.status(500).json({ message: "Error creating user", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { email, password, isActive } = req.body;
        let query = "UPDATE users SET email = ?";
        const params = [email];
        if (password) {
            query += ", passwordHash = ?";
            params.push(await hashPassword(password));
        }
        if (isActive !== undefined) {
            query += ", isActive = ?";
            params.push(isActive);
        }
        query += " WHERE id = ? AND deletedAt IS NULL";
        params.push(req.params.id);
        const [result] = await pool.query(query, params);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        const [updatedUser] = await pool.query(
            "SELECT id, email, isActive, createdAt FROM users WHERE id = ?",
            [req.params.id]
        );
        res.json(updatedUser[0]);
    } catch (error) {
        console.error("Error updating user:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Email already exists" });
        }
        res.status(500).json({ message: "Error updating user", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE users SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error deleting user:", error);
        res.status(500).json({ message: "Error deleting user", error: error.message });
    }
});

export default router;
