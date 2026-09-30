import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { employeeId, status } = req.query;
        let query = `SELECT ec.*, e.firstName, e.lastName, e.employeeCode, cat.name AS categoryName
                     FROM expense_claims ec
                     LEFT JOIN employees e ON ec.employeeId = e.id
                     LEFT JOIN expense_categories cat ON ec.expenseCategoryId = cat.id
                     WHERE ec.deletedAt IS NULL`;
        const params = [];
        if (employeeId) { query += " AND ec.employeeId = ?"; params.push(employeeId); }
        if (status) { query += " AND ec.status = ?"; params.push(status); }
        query += " ORDER BY ec.submittedAt DESC";
        const [claims] = await pool.query(query, params);
        res.json(claims);
    } catch (error) {
        console.error("Error fetching expense claims:", error);
        res.status(500).json({ message: "Error fetching expense claims", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [claims] = await pool.query(
            `SELECT ec.*, e.firstName, e.lastName, e.employeeCode, cat.name AS categoryName
             FROM expense_claims ec
             LEFT JOIN employees e ON ec.employeeId = e.id
             LEFT JOIN expense_categories cat ON ec.expenseCategoryId = cat.id
             WHERE ec.id = ? AND ec.deletedAt IS NULL`,
            [req.params.id]
        );
        if (claims.length === 0) {
            return res.status(404).json({ message: "Expense claim not found" });
        }
        const [attachments] = await pool.query(
            "SELECT * FROM expense_attachments WHERE expenseClaimId = ?",
            [req.params.id]
        );
        claims[0].attachments = attachments;
        res.json(claims[0]);
    } catch (error) {
        console.error("Error fetching expense claim:", error);
        res.status(500).json({ message: "Error fetching expense claim", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { employeeId, expenseCategoryId, expenseDate, amount, description } = req.body;
        const [result] = await pool.query(
            `INSERT INTO expense_claims (employeeId, expenseCategoryId, expenseDate, amount, description)
             VALUES (?, ?, ?, ?, ?)`,
            [employeeId, expenseCategoryId, expenseDate, amount, description]
        );
        const [newClaim] = await pool.query("SELECT * FROM expense_claims WHERE id = ?", [result.insertId]);
        res.status(201).json(newClaim[0]);
    } catch (error) {
        console.error("Error creating expense claim:", error);
        res.status(500).json({ message: "Error creating expense claim", error: error.message });
    }
});

router.post("/:id/attachments", async (req, res) => {
    try {
        const { fileName, filePath, fileType } = req.body;
        const [result] = await pool.query(
            "INSERT INTO expense_attachments (expenseClaimId, fileName, filePath, fileType) VALUES (?, ?, ?, ?)",
            [req.params.id, fileName, filePath, fileType || null]
        );
        const [newAttachment] = await pool.query("SELECT * FROM expense_attachments WHERE id = ?", [result.insertId]);
        res.status(201).json(newAttachment[0]);
    } catch (error) {
        console.error("Error adding attachment:", error);
        res.status(500).json({ message: "Error adding attachment", error: error.message });
    }
});

router.get("/:id/attachments", async (req, res) => {
    try {
        const [attachments] = await pool.query(
            "SELECT * FROM expense_attachments WHERE expenseClaimId = ?",
            [req.params.id]
        );
        res.json(attachments);
    } catch (error) {
        console.error("Error fetching attachments:", error);
        res.status(500).json({ message: "Error fetching attachments", error: error.message });
    }
});

router.delete("/:id/attachments/:attachmentId", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM expense_attachments WHERE id = ? AND expenseClaimId = ?",
            [req.params.attachmentId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Attachment not found" });
        }
        res.json({ message: "Attachment deleted successfully" });
    } catch (error) {
        console.error("Error deleting attachment:", error);
        res.status(500).json({ message: "Error deleting attachment", error: error.message });
    }
});

router.patch("/:id/approve", async (req, res) => {
    try {
        const { status, approvedBy, remarks, approvalLevel } = req.body;
        const [existing] = await pool.query(
            "SELECT * FROM expense_approvals WHERE expenseClaimId = ? AND approvalLevel = ?",
            [req.params.id, approvalLevel]
        );
        if (existing.length === 0) {
            await pool.query(
                `INSERT INTO expense_approvals (expenseClaimId, approvalLevel, approvedBy, status, remarks, actionAt)
                 VALUES (?, ?, ?, ?, ?, NOW())`,
                [req.params.id, approvalLevel, approvedBy || null, status, remarks || null]
            );
        } else {
            await pool.query(
                "UPDATE expense_approvals SET status = ?, approvedBy = ?, remarks = ?, actionAt = NOW() WHERE id = ?",
                [status, approvedBy || null, remarks || null, existing[0].id]
            );
        }
        let newClaimStatus = "pending";
        if (approvalLevel === "manager" && status === "approved") newClaimStatus = "manager_approved";
        else if (approvalLevel === "accounts" && status === "approved") newClaimStatus = "accounts_approved";
        else if (status === "rejected") newClaimStatus = "rejected";
        await pool.query("UPDATE expense_claims SET status = ? WHERE id = ?", [newClaimStatus, req.params.id]);
        const [updatedClaim] = await pool.query("SELECT * FROM expense_claims WHERE id = ?", [req.params.id]);
        res.json(updatedClaim[0]);
    } catch (error) {
        console.error("Error reviewing expense claim:", error);
        res.status(500).json({ message: "Error reviewing expense claim", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE expense_claims SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL AND status = 'pending'",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Expense claim not found or cannot be deleted" });
        }
        res.json({ message: "Expense claim deleted successfully" });
    } catch (error) {
        console.error("Error deleting expense claim:", error);
        res.status(500).json({ message: "Error deleting expense claim", error: error.message });
    }
});

export default router;
