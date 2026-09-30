import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { toolId, employeeId, status } = req.query;
        let query = `SELECT ta.*, t.name AS toolName, t.toolCode, emp.firstName, emp.lastName, emp.employeeCode, sl.name AS locationName
                     FROM tool_assignments ta
                     LEFT JOIN tools t ON ta.toolId = t.id
                     LEFT JOIN employees emp ON ta.employeeId = emp.id
                     LEFT JOIN stock_locations sl ON ta.locationId = sl.id
                     WHERE 1 = 1`;
        const params = [];
        if (toolId) { query += " AND ta.toolId = ?"; params.push(toolId); }
        if (employeeId) { query += " AND ta.employeeId = ?"; params.push(employeeId); }
        if (status) { query += " AND ta.status = ?"; params.push(status); }
        query += " ORDER BY ta.assignedAt DESC";
        const [assignments] = await pool.query(query, params);
        res.json(assignments);
    } catch (error) {
        console.error("Error fetching tool assignments:", error);
        res.status(500).json({ message: "Error fetching tool assignments", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [assignments] = await pool.query(
            `SELECT ta.*, t.name AS toolName, t.toolCode, emp.firstName, emp.lastName, emp.employeeCode, sl.name AS locationName
             FROM tool_assignments ta
             LEFT JOIN tools t ON ta.toolId = t.id
             LEFT JOIN employees emp ON ta.employeeId = emp.id
             LEFT JOIN stock_locations sl ON ta.locationId = sl.id
             WHERE ta.id = ?`,
            [req.params.id]
        );
        if (assignments.length === 0) {
            return res.status(404).json({ message: "Tool assignment not found" });
        }
        const [returns] = await pool.query(
            "SELECT * FROM tool_returns WHERE toolAssignmentId = ? ORDER BY returnedAt DESC",
            [req.params.id]
        );
        assignments[0].returns = returns;
        res.json(assignments[0]);
    } catch (error) {
        console.error("Error fetching tool assignment:", error);
        res.status(500).json({ message: "Error fetching tool assignment", error: error.message });
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { assignmentNumber, toolId, employeeId, locationId, quantity, assignedBy, expectedReturnDate, remarks } = req.body;
        await connection.beginTransaction();
        const [stockRows] = await connection.query(
            "SELECT * FROM tool_stock WHERE toolId = ? AND locationId <=> ? ORDER BY id LIMIT 1",
            [toolId, locationId || null]
        );
        if (stockRows.length > 0 && Number(quantity) > Number(stockRows[0].availableQuantity)) {
            await connection.rollback();
            return res.status(400).json({ message: "Insufficient available stock for this tool" });
        }
        const [result] = await connection.query(
            `INSERT INTO tool_assignments (assignmentNumber, toolId, employeeId, locationId, quantity, assignedBy, expectedReturnDate, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [assignmentNumber, toolId, employeeId, locationId || null, quantity, assignedBy, expectedReturnDate || null, remarks || null]
        );
        if (stockRows.length > 0) {
            await connection.query(
                "UPDATE tool_stock SET availableQuantity = GREATEST(availableQuantity - ?, 0), assignedQuantity = assignedQuantity + ? WHERE id = ?",
                [quantity, quantity, stockRows[0].id]
            );
        }
        await connection.commit();
        const [newAssignment] = await pool.query("SELECT * FROM tool_assignments WHERE id = ?", [result.insertId]);
        res.status(201).json(newAssignment[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating tool assignment:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Assignment number already exists" });
        }
        res.status(500).json({ message: "Error creating tool assignment", error: error.message });
    } finally {
        connection.release();
    }
});

router.get("/:id/returns", async (req, res) => {
    try {
        const [returns] = await pool.query(
            "SELECT * FROM tool_returns WHERE toolAssignmentId = ? ORDER BY returnedAt DESC",
            [req.params.id]
        );
        res.json(returns);
    } catch (error) {
        console.error("Error fetching tool returns:", error);
        res.status(500).json({ message: "Error fetching tool returns", error: error.message });
    }
});

router.post("/:id/returns", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { returnedQuantity, returnCondition, returnedAt, receivedBy, remarks } = req.body;
        await connection.beginTransaction();
        const [assignmentRows] = await connection.query(
            "SELECT * FROM tool_assignments WHERE id = ?",
            [req.params.id]
        );
        if (assignmentRows.length === 0) {
            await connection.rollback();
            return res.status(404).json({ message: "Tool assignment not found" });
        }
        const assignment = assignmentRows[0];
        const [result] = await connection.query(
            `INSERT INTO tool_returns (toolAssignmentId, returnedQuantity, returnCondition, returnedAt, receivedBy, remarks)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [req.params.id, returnedQuantity, returnCondition, new Date(returnedAt || Date.now()), receivedBy, remarks || null]
        );
        const [stockRows] = await connection.query(
            "SELECT * FROM tool_stock WHERE toolId = ? AND locationId <=> ? ORDER BY id LIMIT 1",
            [assignment.toolId, assignment.locationId || null]
        );
        if (stockRows.length > 0) {
            if (returnCondition === 'good' || returnCondition === 'needs_repair') {
                await connection.query(
                    "UPDATE tool_stock SET availableQuantity = availableQuantity + ?, assignedQuantity = GREATEST(assignedQuantity - ?, 0) WHERE id = ?",
                    [returnedQuantity, returnedQuantity, stockRows[0].id]
                );
            } else if (returnCondition === 'damaged') {
                await connection.query(
                    "UPDATE tool_stock SET damagedQuantity = damagedQuantity + ?, assignedQuantity = GREATEST(assignedQuantity - ?, 0) WHERE id = ?",
                    [returnedQuantity, returnedQuantity, stockRows[0].id]
                );
            } else if (returnCondition === 'lost') {
                await connection.query(
                    "UPDATE tool_stock SET lostQuantity = lostQuantity + ?, assignedQuantity = GREATEST(assignedQuantity - ?, 0) WHERE id = ?",
                    [returnedQuantity, returnedQuantity, stockRows[0].id]
                );
            }
        }
        const [totalReturned] = await connection.query(
            "SELECT COALESCE(SUM(returnedQuantity), 0) AS totalReturned FROM tool_returns WHERE toolAssignmentId = ?",
            [req.params.id]
        );
        let newStatus = 'returned';
        if (Number(totalReturned[0].totalReturned) >= Number(assignment.quantity)) {
            newStatus = returnCondition === 'damaged' ? 'damaged' : returnCondition === 'lost' ? 'lost' : 'returned';
        } else {
            newStatus = 'partially_returned';
        }
        await connection.query(
            "UPDATE tool_assignments SET status = ? WHERE id = ?",
            [newStatus, req.params.id]
        );
        await connection.commit();
        const [newReturn] = await pool.query("SELECT * FROM tool_returns WHERE id = ?", [result.insertId]);
        res.status(201).json(newReturn[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error recording tool return:", error);
        res.status(500).json({ message: "Error recording tool return", error: error.message });
    } finally {
        connection.release();
    }
});

router.patch("/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        const [result] = await pool.query(
            "UPDATE tool_assignments SET status = ? WHERE id = ?",
            [status, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Tool assignment not found" });
        }
        const [updatedAssignment] = await pool.query("SELECT * FROM tool_assignments WHERE id = ?", [req.params.id]);
        res.json(updatedAssignment[0]);
    } catch (error) {
        console.error("Error updating tool assignment status:", error);
        res.status(500).json({ message: "Error updating tool assignment status", error: error.message });
    }
});

export default router;