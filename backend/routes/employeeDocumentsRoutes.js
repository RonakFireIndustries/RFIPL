import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/employee/:employeeId", async (req, res) => {
    try {
        const [documents] = await pool.query(
            "SELECT * FROM employee_documents WHERE employeeId = ? AND deletedAt IS NULL ORDER BY documentType",
            [req.params.employeeId]
        );
        res.json(documents);
    } catch (error) {
        console.error("Error fetching employee documents:", error);
        res.status(500).json({ message: "Error fetching employee documents", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [documents] = await pool.query(
            "SELECT * FROM employee_documents WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (documents.length === 0) {
            return res.status(404).json({ message: "Document not found" });
        }
        res.json(documents[0]);
    } catch (error) {
        console.error("Error fetching document:", error);
        res.status(500).json({ message: "Error fetching document", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { employeeId, documentType, documentName, filePath, issuedDate, expiryDate } = req.body;
        const [result] = await pool.query(
            `INSERT INTO employee_documents (employeeId, documentType, documentName, filePath, issuedDate, expiryDate)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [employeeId, documentType, documentName, filePath, issuedDate || null, expiryDate || null]
        );
        const [newDocument] = await pool.query("SELECT * FROM employee_documents WHERE id = ?", [result.insertId]);
        res.status(201).json(newDocument[0]);
    } catch (error) {
        console.error("Error creating document:", error);
        res.status(500).json({ message: "Error creating document", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { documentType, documentName, filePath, issuedDate, expiryDate } = req.body;
        const [result] = await pool.query(
            `UPDATE employee_documents SET documentType = ?, documentName = ?, filePath = ?,
             issuedDate = ?, expiryDate = ? WHERE id = ? AND deletedAt IS NULL`,
            [documentType, documentName, filePath, issuedDate || null, expiryDate || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Document not found" });
        }
        const [updatedDocument] = await pool.query("SELECT * FROM employee_documents WHERE id = ?", [req.params.id]);
        res.json(updatedDocument[0]);
    } catch (error) {
        console.error("Error updating document:", error);
        res.status(500).json({ message: "Error updating document", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE employee_documents SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Document not found" });
        }
        res.json({ message: "Document deleted successfully" });
    } catch (error) {
        console.error("Error deleting document:", error);
        res.status(500).json({ message: "Error deleting document", error: error.message });
    }
});

export default router;
