import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { isEnabled } = req.query;
        let query = "SELECT * FROM inventory_notification_rules WHERE 1 = 1";
        const params = [];
        if (isEnabled !== undefined) { query += " AND isEnabled = ?"; params.push(Number(isEnabled)); }
        query += " ORDER BY notificationType";
        const [rules] = await pool.query(query, params);
        res.json(rules);
    } catch (error) {
        console.error("Error fetching notification rules:", error);
        res.status(500).json({ message: "Error fetching notification rules", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { isEnabled } = req.body;
        const [result] = await pool.query(
            "UPDATE inventory_notification_rules SET isEnabled = ? WHERE id = ?",
            [isEnabled !== undefined ? Number(isEnabled) : 1, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Notification rule not found" });
        }
        const [updatedRule] = await pool.query("SELECT * FROM inventory_notification_rules WHERE id = ?", [req.params.id]);
        res.json(updatedRule[0]);
    } catch (error) {
        console.error("Error updating notification rule:", error);
        res.status(500).json({ message: "Error updating notification rule", error: error.message });
    }
});

export default router;