import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { isRead } = req.query;
        let query = "SELECT * FROM notifications WHERE userId = ?";
        const params = [req.user.id];
        if (isRead !== undefined) {
            query += " AND isRead = ?";
            params.push(isRead === "true" ? 1 : 0);
        }
        query += " ORDER BY createdAt DESC";
        const [notifications] = await pool.query(query, params);
        res.json(notifications);
    } catch (error) {
        console.error("Error fetching notifications:", error);
        res.status(500).json({ message: "Error fetching notifications", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [notifications] = await pool.query(
            "SELECT * FROM notifications WHERE id = ? AND userId = ?",
            [req.params.id, req.user.id]
        );
        if (notifications.length === 0) {
            return res.status(404).json({ message: "Notification not found" });
        }
        res.json(notifications[0]);
    } catch (error) {
        console.error("Error fetching notification:", error);
        res.status(500).json({ message: "Error fetching notification", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { userId, title, message, type, relatedModule, relatedModuleId } = req.body;
        const [result] = await pool.query(
            "INSERT INTO notifications (userId, title, message, type, relatedModule, relatedModuleId) VALUES (?, ?, ?, ?, ?, ?)",
            [userId, title, message, type, relatedModule || null, relatedModuleId || null]
        );
        const [newNotification] = await pool.query("SELECT * FROM notifications WHERE id = ?", [result.insertId]);
        res.status(201).json(newNotification[0]);
    } catch (error) {
        console.error("Error creating notification:", error);
        res.status(500).json({ message: "Error creating notification", error: error.message });
    }
});

router.patch("/:id/read", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE notifications SET isRead = TRUE, readAt = CASE WHEN isRead = 0 THEN NOW() ELSE readAt END WHERE id = ? AND userId = ?",
            [req.params.id, req.user.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Notification not found" });
        }
        const [updatedNotification] = await pool.query(
            "SELECT * FROM notifications WHERE id = ?",
            [req.params.id]
        );
        res.json(updatedNotification[0]);
    } catch (error) {
        console.error("Error marking notification as read:", error);
        res.status(500).json({ message: "Error marking notification as read", error: error.message });
    }
});

router.patch("/read-all", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE notifications SET isRead = TRUE, readAt = NOW() WHERE userId = ? AND isRead = FALSE",
            [req.user.id]
        );
        res.json({ message: "All notifications marked as read", count: result.affectedRows });
    } catch (error) {
        console.error("Error marking all notifications as read:", error);
        res.status(500).json({ message: "Error marking all notifications as read", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM notifications WHERE id = ? AND userId = ?",
            [req.params.id, req.user.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Notification not found" });
        }
        res.json({ message: "Notification deleted successfully" });
    } catch (error) {
        console.error("Error deleting notification:", error);
        res.status(500).json({ message: "Error deleting notification", error: error.message });
    }
});

export default router;