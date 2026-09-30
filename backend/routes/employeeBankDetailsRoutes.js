import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/employee/:employeeId", async (req, res) => {
    try {
        const [bankDetails] = await pool.query(
            "SELECT * FROM employee_bank_details WHERE employeeId = ?",
            [req.params.employeeId]
        );
        res.json(bankDetails);
    } catch (error) {
        console.error("Error fetching bank details:", error);
        res.status(500).json({ message: "Error fetching bank details", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [bankDetails] = await pool.query(
            "SELECT * FROM employee_bank_details WHERE id = ?",
            [req.params.id]
        );
        if (bankDetails.length === 0) {
            return res.status(404).json({ message: "Bank details not found" });
        }
        res.json(bankDetails[0]);
    } catch (error) {
        console.error("Error fetching bank details:", error);
        res.status(500).json({ message: "Error fetching bank details", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { employeeId, accountHolderName, bankName, accountNumberEncrypted, ifscCode, branchName, isActive } = req.body;
        const [result] = await pool.query(
            `INSERT INTO employee_bank_details (employeeId, accountHolderName, bankName, accountNumberEncrypted, ifscCode, branchName, isActive)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [employeeId, accountHolderName, bankName, accountNumberEncrypted, ifscCode, branchName || null, isActive !== undefined ? isActive : true]
        );
        const [newBankDetail] = await pool.query("SELECT * FROM employee_bank_details WHERE id = ?", [result.insertId]);
        res.status(201).json(newBankDetail[0]);
    } catch (error) {
        console.error("Error creating bank details:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Bank details already exist for this employee" });
        }
        res.status(500).json({ message: "Error creating bank details", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { accountHolderName, bankName, accountNumberEncrypted, ifscCode, branchName, isActive } = req.body;
        const [result] = await pool.query(
            `UPDATE employee_bank_details SET accountHolderName = ?, bankName = ?, accountNumberEncrypted = ?,
             ifscCode = ?, branchName = ?, isActive = ? WHERE id = ?`,
            [accountHolderName, bankName, accountNumberEncrypted, ifscCode, branchName || null, isActive !== undefined ? isActive : true, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Bank details not found" });
        }
        const [updatedBankDetail] = await pool.query("SELECT * FROM employee_bank_details WHERE id = ?", [req.params.id]);
        res.json(updatedBankDetail[0]);
    } catch (error) {
        console.error("Error updating bank details:", error);
        res.status(500).json({ message: "Error updating bank details", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM employee_bank_details WHERE id = ?",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Bank details not found" });
        }
        res.json({ message: "Bank details deleted successfully" });
    } catch (error) {
        console.error("Error deleting bank details:", error);
        res.status(500).json({ message: "Error deleting bank details", error: error.message });
    }
});

export default router;
