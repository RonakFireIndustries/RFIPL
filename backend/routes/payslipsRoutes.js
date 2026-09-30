import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { payrollId } = req.query;
        let query = `SELECT ps.*, p.payrollPeriodId, e.firstName, e.lastName, e.employeeCode
                     FROM payslips ps
                     JOIN payrolls p ON ps.payrollId = p.id
                     LEFT JOIN employees e ON p.employeeId = e.id WHERE 1=1`;
        const params = [];
        if (payrollId) { query += " AND ps.payrollId = ?"; params.push(payrollId); }
        query += " ORDER BY ps.generatedAt DESC";
        const [payslips] = await pool.query(query, params);
        res.json(payslips);
    } catch (error) {
        console.error("Error fetching payslips:", error);
        res.status(500).json({ message: "Error fetching payslips", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [payslips] = await pool.query(
            `SELECT ps.*, p.payrollPeriodId, p.grossEarnings, p.totalDeductions, p.netSalary, p.payableDays,
                    e.firstName, e.lastName, e.employeeCode
             FROM payslips ps
             JOIN payrolls p ON ps.payrollId = p.id
             LEFT JOIN employees e ON p.employeeId = e.id
             WHERE ps.id = ?`,
            [req.params.id]
        );
        if (payslips.length === 0) {
            return res.status(404).json({ message: "Payslip not found" });
        }
        res.json(payslips[0]);
    } catch (error) {
        console.error("Error fetching payslip:", error);
        res.status(500).json({ message: "Error fetching payslip", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { payrollId, payslipNumber, filePath } = req.body;
        const [result] = await pool.query(
            "INSERT INTO payslips (payrollId, payslipNumber, filePath) VALUES (?, ?, ?)",
            [payrollId, payslipNumber, filePath || null]
        );
        const [newPayslip] = await pool.query("SELECT * FROM payslips WHERE id = ?", [result.insertId]);
        res.status(201).json(newPayslip[0]);
    } catch (error) {
        console.error("Error creating payslip:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Payslip already exists for this payroll" });
        }
        res.status(500).json({ message: "Error creating payslip", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM payslips WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Payslip not found" });
        }
        res.json({ message: "Payslip deleted successfully" });
    } catch (error) {
        console.error("Error deleting payslip:", error);
        res.status(500).json({ message: "Error deleting payslip", error: error.message });
    }
});

export default router;
