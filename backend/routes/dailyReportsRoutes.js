import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { employeeId, reportDate, status } = req.query;
        let query = `SELECT dr.*, e.firstName, e.lastName, e.employeeCode
                     FROM daily_reports dr
                     LEFT JOIN employees e ON dr.employeeId = e.id
                     WHERE 1=1`;
        const params = [];
        if (employeeId) { query += " AND dr.employeeId = ?"; params.push(employeeId); }
        if (reportDate) { query += " AND dr.reportDate = ?"; params.push(reportDate); }
        if (status) { query += " AND dr.status = ?"; params.push(status); }
        query += " ORDER BY dr.reportDate DESC";
        const [reports] = await pool.query(query, params);
        res.json(reports);
    } catch (error) {
        console.error("Error fetching daily reports:", error);
        res.status(500).json({ message: "Error fetching daily reports", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [reports] = await pool.query(
            `SELECT dr.*, e.firstName, e.lastName, e.employeeCode
             FROM daily_reports dr
             LEFT JOIN employees e ON dr.employeeId = e.id
             WHERE dr.id = ?`,
            [req.params.id]
        );
        if (reports.length === 0) {
            return res.status(404).json({ message: "Daily report not found" });
        }
        const [reviews] = await pool.query(
            `SELECT drr.*, e.firstName, e.lastName
             FROM daily_report_reviews drr
             LEFT JOIN employees e ON drr.reviewerId = e.id
             WHERE drr.dailyReportId = ?`,
            [req.params.id]
        );
        reports[0].reviews = reviews;
        res.json(reports[0]);
    } catch (error) {
        console.error("Error fetching daily report:", error);
        res.status(500).json({ message: "Error fetching daily report", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { employeeId, reportDate, workSummary, tasksCompleted, hoursWorked, problemsBlockers, tomorrowPlan } = req.body;
        const [result] = await pool.query(
            `INSERT INTO daily_reports (employeeId, reportDate, workSummary, tasksCompleted, hoursWorked, problemsBlockers, tomorrowPlan)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [employeeId, reportDate, workSummary, tasksCompleted || null, hoursWorked || null, problemsBlockers || null, tomorrowPlan || null]
        );
        const [newReport] = await pool.query("SELECT * FROM daily_reports WHERE id = ?", [result.insertId]);
        res.status(201).json(newReport[0]);
    } catch (error) {
        console.error("Error creating daily report:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Daily report already exists for this day" });
        }
        res.status(500).json({ message: "Error creating daily report", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { workSummary, tasksCompleted, hoursWorked, problemsBlockers, tomorrowPlan } = req.body;
        const [result] = await pool.query(
            `UPDATE daily_reports SET workSummary = ?, tasksCompleted = ?, hoursWorked = ?,
             problemsBlockers = ?, tomorrowPlan = ? WHERE id = ?`,
            [workSummary, tasksCompleted || null, hoursWorked || null, problemsBlockers || null, tomorrowPlan || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Daily report not found" });
        }
        const [updatedReport] = await pool.query("SELECT * FROM daily_reports WHERE id = ?", [req.params.id]);
        res.json(updatedReport[0]);
    } catch (error) {
        console.error("Error updating daily report:", error);
        res.status(500).json({ message: "Error updating daily report", error: error.message });
    }
});

router.patch("/:id/submit", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE daily_reports SET status = 'submitted', submittedAt = NOW() WHERE id = ? AND status = 'draft'",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Daily report not found or cannot be submitted" });
        }
        const [updatedReport] = await pool.query("SELECT * FROM daily_reports WHERE id = ?", [req.params.id]);
        res.json(updatedReport[0]);
    } catch (error) {
        console.error("Error submitting daily report:", error);
        res.status(500).json({ message: "Error submitting daily report", error: error.message });
    }
});

router.post("/:id/reviews", async (req, res) => {
    try {
        const { reviewerId, status, remarks } = req.body;
        await pool.query(
            `INSERT INTO daily_report_reviews (dailyReportId, reviewerId, status, remarks)
             VALUES (?, ?, ?, ?)`,
            [req.params.id, reviewerId, status, remarks || null]
        );
        await pool.query(
            "UPDATE daily_reports SET status = ? WHERE id = ?",
            [status === "approved" ? "approved" : status, req.params.id]
        );
        const [updatedReport] = await pool.query("SELECT * FROM daily_reports WHERE id = ?", [req.params.id]);
        res.status(201).json(updatedReport[0]);
    } catch (error) {
        console.error("Error reviewing daily report:", error);
        res.status(500).json({ message: "Error reviewing daily report", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM daily_reports WHERE id = ? AND status = 'draft'",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Daily report not found or cannot be deleted" });
        }
        res.json({ message: "Daily report deleted successfully" });
    } catch (error) {
        console.error("Error deleting daily report:", error);
        res.status(500).json({ message: "Error deleting daily report", error: error.message });
    }
});

export default router;