import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { departmentId, status, search } = req.query;
        let query = `SELECT m.*, d.name AS departmentName, sl.name AS locationName
                     FROM machines m
                     LEFT JOIN departments d ON m.departmentId = d.id
                     LEFT JOIN stock_locations sl ON m.locationId = sl.id
                     WHERE m.deletedAt IS NULL`;
        const params = [];
        if (departmentId) { query += " AND m.departmentId = ?"; params.push(departmentId); }
        if (status) { query += " AND m.status = ?"; params.push(status); }
        if (search) { query += " AND (m.machineCode LIKE ? OR m.machineName LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
        query += " ORDER BY m.machineName";
        const [machines] = await pool.query(query, params);
        res.json(machines);
    } catch (error) {
        console.error("Error fetching machines:", error);
        res.status(500).json({ message: "Error fetching machines", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [machines] = await pool.query(
            `SELECT m.*, d.name AS departmentName, sl.name AS locationName
             FROM machines m
             LEFT JOIN departments d ON m.departmentId = d.id
             LEFT JOIN stock_locations sl ON m.locationId = sl.id
             WHERE m.id = ? AND m.deletedAt IS NULL`,
            [req.params.id]
        );
        if (machines.length === 0) {
            return res.status(404).json({ message: "Machine not found" });
        }
        res.json(machines[0]);
    } catch (error) {
        console.error("Error fetching machine:", error);
        res.status(500).json({ message: "Error fetching machine", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { machineCode, machineName, departmentId, locationId, maintenanceDueDate, status, description } = req.body;
        const [result] = await pool.query(
            `INSERT INTO machines (machineCode, machineName, departmentId, locationId, maintenanceDueDate, status, description)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [machineCode, machineName, departmentId, locationId || null, maintenanceDueDate || null, status || 'active', description || null]
        );
        const [newMachine] = await pool.query("SELECT * FROM machines WHERE id = ?", [result.insertId]);
        res.status(201).json(newMachine[0]);
    } catch (error) {
        console.error("Error creating machine:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Machine code already exists" });
        }
        res.status(500).json({ message: "Error creating machine", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { machineCode, machineName, departmentId, locationId, maintenanceDueDate, status, description } = req.body;
        const [result] = await pool.query(
            `UPDATE machines SET machineCode = ?, machineName = ?, departmentId = ?, locationId = ?, maintenanceDueDate = ?, status = ?, description = ?
             WHERE id = ? AND deletedAt IS NULL`,
            [machineCode, machineName, departmentId, locationId || null, maintenanceDueDate || null, status || 'active', description || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Machine not found" });
        }
        const [updatedMachine] = await pool.query("SELECT * FROM machines WHERE id = ?", [req.params.id]);
        res.json(updatedMachine[0]);
    } catch (error) {
        console.error("Error updating machine:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Machine code already exists" });
        }
        res.status(500).json({ message: "Error updating machine", error: error.message });
    }
});

router.patch("/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        const [result] = await pool.query(
            "UPDATE machines SET status = ? WHERE id = ? AND deletedAt IS NULL",
            [status, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Machine not found" });
        }
        const [updatedMachine] = await pool.query("SELECT * FROM machines WHERE id = ?", [req.params.id]);
        res.json(updatedMachine[0]);
    } catch (error) {
        console.error("Error updating machine status:", error);
        res.status(500).json({ message: "Error updating machine status", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE machines SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Machine not found" });
        }
        res.json({ message: "Machine deleted successfully" });
    } catch (error) {
        console.error("Error deleting machine:", error);
        res.status(500).json({ message: "Error deleting machine", error: error.message });
    }
});

router.get("/:id/breakdowns", async (req, res) => {
    try {
        const [breakdowns] = await pool.query(
            `SELECT mb.*, emp.firstName, emp.lastName
             FROM machine_breakdowns mb
             LEFT JOIN employees emp ON mb.reportedBy = emp.id
             WHERE mb.machineId = ?`,
            [req.params.id]
        );
        res.json(breakdowns);
    } catch (error) {
        console.error("Error fetching machine breakdowns:", error);
        res.status(500).json({ message: "Error fetching machine breakdowns", error: error.message });
    }
});

router.post("/:id/breakdowns", async (req, res) => {
    try {
        const { breakdownDateTime, problemDescription, severity, reportedBy, downtimeMinutes } = req.body;
        const [result] = await pool.query(
            `INSERT INTO machine_breakdowns (machineId, breakdownDateTime, problemDescription, severity, reportedBy, downtimeMinutes)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.params.id, breakdownDateTime, problemDescription, severity || 'medium', reportedBy, downtimeMinutes || null]
        );
        await pool.query(
            "UPDATE machines SET status = 'breakdown' WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        const [newBreakdown] = await pool.query("SELECT * FROM machine_breakdowns WHERE id = ?", [result.insertId]);
        res.status(201).json(newBreakdown[0]);
    } catch (error) {
        console.error("Error reporting breakdown:", error);
        res.status(500).json({ message: "Error reporting breakdown", error: error.message });
    }
});

router.patch("/breakdowns/:breakdownId/resolve", async (req, res) => {
    try {
        const { resolutionDetails, resolvedBy, downtimeMinutes } = req.body;
        const [breakdownRows] = await pool.query("SELECT * FROM machine_breakdowns WHERE id = ?", [req.params.breakdownId]);
        if (breakdownRows.length === 0) {
            return res.status(404).json({ message: "Breakdown not found" });
        }
        const [result] = await pool.query(
            "UPDATE machine_breakdowns SET status = 'resolved', resolutionDetails = ?, resolvedBy = ?, resolvedAt = NOW(), downtimeMinutes = COALESCE(?, downtimeMinutes) WHERE id = ? AND status = 'open'",
            [resolutionDetails || null, resolvedBy || null, downtimeMinutes || null, req.params.breakdownId]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Breakdown already resolved" });
        }
        await pool.query(
            "UPDATE machines SET status = 'active' WHERE id = ? AND deletedAt IS NULL",
            [breakdownRows[0].machineId]
        );
        const [updatedBreakdown] = await pool.query("SELECT * FROM machine_breakdowns WHERE id = ?", [req.params.breakdownId]);
        res.json(updatedBreakdown[0]);
    } catch (error) {
        console.error("Error resolving breakdown:", error);
        res.status(500).json({ message: "Error resolving breakdown", error: error.message });
    }
});

router.delete("/breakdowns/:breakdownId", async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM machine_breakdowns WHERE id = ?", [req.params.breakdownId]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Breakdown not found" });
        }
        res.json({ message: "Breakdown deleted successfully" });
    } catch (error) {
        console.error("Error deleting breakdown:", error);
        res.status(500).json({ message: "Error deleting breakdown", error: error.message });
    }
});

export default router;