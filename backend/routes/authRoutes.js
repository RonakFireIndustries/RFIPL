import express from "express";
import crypto from "crypto";
import { pool } from "../config/db.js";
import {
    authMiddleware, hashPassword, comparePassword, signAccessToken,
    hashRefreshToken, REFRESH_EXPIRES_DAYS
} from "../config/auth.js";

const router = express.Router();

const issueTokens = async (user, res) => {
    const accessToken = signAccessToken(user);
    const refreshToken = crypto.randomBytes(64).toString("hex");
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_EXPIRES_DAYS);
    const tokenHash = await hashRefreshToken(refreshToken);
    await pool.query(
        "INSERT INTO refresh_tokens (userId, tokenHash, expiresAt) VALUES (?, ?, ?)",
        [user.id, tokenHash, expiresAt]
    );
    return { accessToken, refreshToken };
};

router.post("/register", async (req, res) => {
    try {
        const { email, password } = req.body;
        const passwordHash = await hashPassword(password);
        const [result] = await pool.query(
            "INSERT INTO users (email, passwordHash) VALUES (?, ?)",
            [email, passwordHash]
        );

        const [matched] = await pool.query(
            "SELECT id FROM employees WHERE personalEmail = ? AND employmentStatus = 'active' AND deletedAt IS NULL AND userId IS NULL ORDER BY id DESC LIMIT 1",
            [email]
        );
        if (matched.length > 0) {
            await pool.query(
                "UPDATE employees SET userId = ? WHERE id = ?",
                [result.insertId, matched[0].id]
            );
        }
        const [users] = await pool.query(
            "SELECT id, email, isActive FROM users WHERE id = ?",
            [result.insertId]
        );
        const user = users[0];
        const { accessToken, refreshToken } = await issueTokens(user, res);
        res.status(201).json({ message: "User registered", user, accessToken, refreshToken });
    } catch (error) {
        console.error("Error registering user:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Email already exists" });
        }
        res.status(500).json({ message: "Error registering user", error: error.message });
    }
});

router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const [users] = await pool.query(
            "SELECT id, email, passwordHash, isActive FROM users WHERE email = ? AND deletedAt IS NULL",
            [email]
        );
        if (users.length === 0) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        const user = users[0];
        if (!user.isActive) {
            return res.status(403).json({ message: "Account is inactive" });
        }
        const valid = await comparePassword(password, user.passwordHash);
        if (!valid) {
            return res.status(401).json({ message: "Invalid credentials" });
        }
        await pool.query("UPDATE users SET lastLoginAt = NOW() WHERE id = ?", [user.id]);
        const safeUser = { id: user.id, email: user.email };
        const { accessToken, refreshToken } = await issueTokens(safeUser, res);
        res.json({ message: "Login successful", user: safeUser, accessToken, refreshToken });
    } catch (error) {
        console.error("Error logging in:", error);
        res.status(500).json({ message: "Error logging in", error: error.message });
    }
});

router.post("/refresh", async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (!refreshToken) {
            return res.status(400).json({ message: "refreshToken required" });
        }
        const [tokens] = await pool.query(
            "SELECT * FROM refresh_tokens WHERE revokedAt IS NULL AND expiresAt > NOW()"
        );
        let matchedToken = null;
        for (const t of tokens) {
            if (await comparePassword(refreshToken, t.tokenHash)) {
                matchedToken = t;
                break;
            }
        }
        if (!matchedToken) {
            return res.status(401).json({ message: "Invalid or expired refresh token" });
        }
        const token = matchedToken;
        const [users] = await pool.query(
            "SELECT id, email, isActive FROM users WHERE id = ? AND deletedAt IS NULL",
            [token.userId]
        );
        if (users.length === 0 || !users[0].isActive) {
            return res.status(401).json({ message: "User not found or inactive" });
        }
        await pool.query("UPDATE refresh_tokens SET revokedAt = NOW() WHERE id = ?", [token.id]);
        const safeUser = { id: users[0].id, email: users[0].email };
        const { accessToken, refreshToken: newRefreshToken } = await issueTokens(safeUser, res);
        res.json({ accessToken, refreshToken: newRefreshToken });
    } catch (error) {
        console.error("Error refreshing token:", error);
        res.status(500).json({ message: "Error refreshing token", error: error.message });
    }
});

router.post("/logout", async (req, res) => {
    try {
        const { refreshToken } = req.body;
        if (refreshToken) {
            const tokenHash = await hashRefreshToken(refreshToken);
            await pool.query(
                "UPDATE refresh_tokens SET revokedAt = NOW() WHERE tokenHash = ?",
                [tokenHash]
            );
        }
        res.json({ message: "Logout successful" });
    } catch (error) {
        console.error("Error logging out:", error);
        res.status(500).json({ message: "Error logging out", error: error.message });
    }
});

router.get("/me", authMiddleware, async (req, res) => {
    try {
        const [users] = await pool.query(
            "SELECT id, email, isActive, lastLoginAt FROM users WHERE id = ?",
            [req.user.id]
        );
        if (users.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        const [roles] = await pool.query(
            `SELECT r.id, r.name FROM roles r
             JOIN user_roles ur ON ur.roleId = r.id
             WHERE ur.userId = ?`,
            [req.user.id]
        );
        res.json({ ...users[0], roles });
    } catch (error) {
        console.error("Error fetching current user:", error);
        res.status(500).json({ message: "Error fetching current user", error: error.message });
    }
});

router.post("/change-password", authMiddleware, async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const [users] = await pool.query(
            "SELECT passwordHash FROM users WHERE id = ?",
            [req.user.id]
        );
        if (users.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        const valid = await comparePassword(currentPassword, users[0].passwordHash);
        if (!valid) {
            return res.status(401).json({ message: "Current password is incorrect" });
        }
        const passwordHash = await hashPassword(newPassword);
        await pool.query("UPDATE users SET passwordHash = ? WHERE id = ?", [passwordHash, req.user.id]);
        res.json({ message: "Password changed successfully" });
    } catch (error) {
        console.error("Error changing password:", error);
        res.status(500).json({ message: "Error changing password", error: error.message });
    }
});

router.post("/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        const [users] = await pool.query(
            "SELECT id FROM users WHERE email = ? AND deletedAt IS NULL",
            [email]
        );
        if (users.length === 0) {
            return res.status(404).json({ message: "User not found" });
        }
        const rawToken = crypto.randomBytes(32).toString("hex");
        const tokenHash = await hashRefreshToken(rawToken);
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);
        await pool.query(
            "INSERT INTO password_reset_tokens (userId, tokenHash, expiresAt) VALUES (?, ?, ?)",
            [users[0].id, tokenHash, expiresAt]
        );
        res.json({ message: "Password reset token generated", resetToken: rawToken });
    } catch (error) {
        console.error("Error generating password reset token:", error);
        res.status(500).json({ message: "Error generating password reset token", error: error.message });
    }
});

router.post("/reset-password", async (req, res) => {
    try {
        const { resetToken, newPassword } = req.body;
        const [tokens] = await pool.query(
            "SELECT * FROM password_reset_tokens WHERE usedAt IS NULL AND expiresAt > NOW()"
        );
        let matchedToken = null;
        for (const t of tokens) {
            if (await comparePassword(resetToken, t.tokenHash)) {
                matchedToken = t;
                break;
            }
        }
        if (!matchedToken) {
            return res.status(401).json({ message: "Invalid or expired reset token" });
        }
        const token = matchedToken;
        const passwordHash = await hashPassword(newPassword);
        await pool.query("UPDATE users SET passwordHash = ? WHERE id = ?", [passwordHash, token.userId]);
        await pool.query("UPDATE password_reset_tokens SET usedAt = NOW() WHERE id = ?", [token.id]);
        res.json({ message: "Password reset successfully" });
    } catch (error) {
        console.error("Error resetting password:", error);
        res.status(500).json({ message: "Error resetting password", error: error.message });
    }
});

export default router;
