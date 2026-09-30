import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { module, userId, fromDate, toDate } = req.query;
        let query = `SELECT al.*, u.email AS userEmail
                     FROM audit_logs al
                     LEFT JOIN users u ON al.userId = u.id
                     WHERE 1=1`;
        const params = [];
        if (module) { query += " AND al.module = ?"; params.push(module); }
        if (userId) { query += " AND al.userId = ?"; params.push(userId); }
        if (fromDate) { query += " AND al.createdAt >= ?"; params.push(fromDate); }
        if (toDate) { query += " AND al.createdAt <= ?"; params.push(toDate); }
        query += " ORDER BY al.createdAt DESC LIMIT 200";
        const [logs] = await pool.query(query, params);
        res.json(logs);
    } catch (error) {
        console.error("Error fetching audit logs:", error);
        res.status(500).json({ message: "Error fetching audit logs", error: error.message });
    }
});

router.get("/record/:module/:recordId", async (req, res) => {
    try {
        const [logs] = await pool.query(
            `SELECT al.*, u.email AS userEmail
             FROM audit_logs al
             LEFT JOIN users u ON al.userId = u.id
             WHERE al.module = ? AND al.recordId = ?
             ORDER BY al.createdAt DESC`,
            [req.params.module, req.params.recordId]
        );
        res.json(logs);
    } catch (error) {
        console.error("Error fetching audit logs for record:", error);
        res.status(500).json({ message: "Error fetching audit logs for record", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { action, module, recordId, oldValues, newValues, ipAddress } = req.body;
        const [result] = await pool.query(
            "INSERT INTO audit_logs (userId, action, module, recordId, oldValues, newValues, ipAddress) VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                req.user.id,
                action,
                module,
                recordId || null,
                oldValues ? JSON.stringify(oldValues) : null,
                newValues ? JSON.stringify(newValues) : null,
                ipAddress || req.ip || null
            ]
        );
        res.status(201).json({ message: "Audit log created", id: result.insertId });
    } catch (error) {
        console.error("Error creating audit log:", error);
        res.status(500).json({ message: "Error creating audit log", error: error.message });
    }
});

export default router;