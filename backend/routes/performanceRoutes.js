import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/cycles", async (req, res) => {
    try {
        const [cycles] = await pool.query("SELECT * FROM performance_review_cycles ORDER BY startDate DESC");
        res.json(cycles);
    } catch (error) {
        console.error("Error fetching review cycles:", error);
        res.status(500).json({ message: "Error fetching review cycles", error: error.message });
    }
});

router.post("/cycles", async (req, res) => {
    try {
        const { name, periodType, startDate, endDate } = req.body;
        const [result] = await pool.query(
            "INSERT INTO performance_review_cycles (name, periodType, startDate, endDate) VALUES (?, ?, ?, ?)",
            [name, periodType, startDate, endDate]
        );
        const [newRow] = await pool.query("SELECT * FROM performance_review_cycles WHERE id = ?", [result.insertId]);
        res.status(201).json(newRow[0]);
    } catch (error) {
        console.error("Error creating review cycle:", error);
        res.status(500).json({ message: "Error creating review cycle", error: error.message });
    }
});

router.put("/cycles/:id", async (req, res) => {
    try {
        const { name, periodType, startDate, endDate, status } = req.body;
        const [result] = await pool.query(
            "UPDATE performance_review_cycles SET name = ?, periodType = ?, startDate = ?, endDate = ?, status = ? WHERE id = ?",
            [name, periodType, startDate, endDate, status || "draft", req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Review cycle not found" });
        }
        const [updatedRow] = await pool.query("SELECT * FROM performance_review_cycles WHERE id = ?", [req.params.id]);
        res.json(updatedRow[0]);
    } catch (error) {
        console.error("Error updating review cycle:", error);
        res.status(500).json({ message: "Error updating review cycle", error: error.message });
    }
});

router.delete("/cycles/:id", async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM performance_review_cycles WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Review cycle not found" });
        }
        res.json({ message: "Review cycle deleted successfully" });
    } catch (error) {
        console.error("Error deleting review cycle:", error);
        res.status(500).json({ message: "Error deleting review cycle", error: error.message });
    }
});

router.get("/rating-scales", async (req, res) => {
    try {
        const [scales] = await pool.query("SELECT * FROM rating_scales ORDER BY minScore");
        res.json(scales);
    } catch (error) {
        console.error("Error fetching rating scales:", error);
        res.status(500).json({ message: "Error fetching rating scales", error: error.message });
    }
});

router.post("/rating-scales", async (req, res) => {
    try {
        const { name, minScore, maxScore, label, description } = req.body;
        const [result] = await pool.query(
            "INSERT INTO rating_scales (name, minScore, maxScore, label, description) VALUES (?, ?, ?, ?, ?)",
            [name, minScore, maxScore, label, description || null]
        );
        const [newRow] = await pool.query("SELECT * FROM rating_scales WHERE id = ?", [result.insertId]);
        res.status(201).json(newRow[0]);
    } catch (error) {
        console.error("Error creating rating scale:", error);
        res.status(500).json({ message: "Error creating rating scale", error: error.message });
    }
});

router.delete("/rating-scales/:id", async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM rating_scales WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Rating scale not found" });
        }
        res.json({ message: "Rating scale deleted successfully" });
    } catch (error) {
        console.error("Error deleting rating scale:", error);
        res.status(500).json({ message: "Error deleting rating scale", error: error.message });
    }
});

router.get("/kpis", async (req, res) => {
    try {
        const [kpis] = await pool.query("SELECT * FROM kpis ORDER BY name");
        res.json(kpis);
    } catch (error) {
        console.error("Error fetching KPIs:", error);
        res.status(500).json({ message: "Error fetching KPIs", error: error.message });
    }
});

router.post("/kpis", async (req, res) => {
    try {
        const { name, description, unit } = req.body;
        const [result] = await pool.query(
            "INSERT INTO kpis (name, description, unit) VALUES (?, ?, ?)",
            [name, description || null, unit || null]
        );
        const [newRow] = await pool.query("SELECT * FROM kpis WHERE id = ?", [result.insertId]);
        res.status(201).json(newRow[0]);
    } catch (error) {
        console.error("Error creating KPI:", error);
        res.status(500).json({ message: "Error creating KPI", error: error.message });
    }
});

router.put("/kpis/:id", async (req, res) => {
    try {
        const { name, description, unit, isActive } = req.body;
        const [result] = await pool.query(
            "UPDATE kpis SET name = ?, description = ?, unit = ?, isActive = ? WHERE id = ?",
            [name, description || null, unit || null, isActive !== undefined ? isActive : true, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "KPI not found" });
        }
        const [updatedRow] = await pool.query("SELECT * FROM kpis WHERE id = ?", [req.params.id]);
        res.json(updatedRow[0]);
    } catch (error) {
        console.error("Error updating KPI:", error);
        res.status(500).json({ message: "Error updating KPI", error: error.message });
    }
});

router.delete("/kpis/:id", async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM kpis WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "KPI not found" });
        }
        res.json({ message: "KPI deleted successfully" });
    } catch (error) {
        console.error("Error deleting KPI:", error);
        res.status(500).json({ message: "Error deleting KPI", error: error.message });
    }
});

router.get("/employee-kpis", async (req, res) => {
    try {
        const { employeeId, reviewCycleId } = req.query;
        let query = `SELECT ek.*, k.name AS kpiName, k.unit
                     FROM employee_kpis ek
                     JOIN kpis k ON ek.kpiId = k.id WHERE 1=1`;
        const params = [];
        if (employeeId) { query += " AND ek.employeeId = ?"; params.push(employeeId); }
        if (reviewCycleId) { query += " AND ek.reviewCycleId = ?"; params.push(reviewCycleId); }
        const [kpis] = await pool.query(query, params);
        res.json(kpis);
    } catch (error) {
        console.error("Error fetching employee KPIs:", error);
        res.status(500).json({ message: "Error fetching employee KPIs", error: error.message });
    }
});

router.post("/employee-kpis", async (req, res) => {
    try {
        const { employeeId, kpiId, reviewCycleId, targetValue, actualValue, weightage, remarks } = req.body;
        const [result] = await pool.query(
            `INSERT INTO employee_kpis (employeeId, kpiId, reviewCycleId, targetValue, actualValue, weightage, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [employeeId, kpiId, reviewCycleId, targetValue || null, actualValue || null, weightage || 0, remarks || null]
        );
        const [newRow] = await pool.query("SELECT * FROM employee_kpis WHERE id = ?", [result.insertId]);
        res.status(201).json(newRow[0]);
    } catch (error) {
        console.error("Error creating employee KPI:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "KPI already assigned to employee for this cycle" });
        }
        res.status(500).json({ message: "Error creating employee KPI", error: error.message });
    }
});

router.put("/employee-kpis/:id", async (req, res) => {
    try {
        const { targetValue, actualValue, weightage, remarks } = req.body;
        const [result] = await pool.query(
            "UPDATE employee_kpis SET targetValue = ?, actualValue = ?, weightage = ?, remarks = ? WHERE id = ?",
            [targetValue || null, actualValue || null, weightage || 0, remarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Employee KPI not found" });
        }
        const [updatedRow] = await pool.query("SELECT * FROM employee_kpis WHERE id = ?", [req.params.id]);
        res.json(updatedRow[0]);
    } catch (error) {
        console.error("Error updating employee KPI:", error);
        res.status(500).json({ message: "Error updating employee KPI", error: error.message });
    }
});

router.delete("/employee-kpis/:id", async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM employee_kpis WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Employee KPI not found" });
        }
        res.json({ message: "Employee KPI deleted successfully" });
    } catch (error) {
        console.error("Error deleting employee KPI:", error);
        res.status(500).json({ message: "Error deleting employee KPI", error: error.message });
    }
});

router.get("/reviews", async (req, res) => {
    try {
        const { employeeId, reviewCycleId, status } = req.query;
        let query = `SELECT pr.*, e.firstName, e.lastName, rs.label AS ratingLabel, rc.name AS cycleName
                     FROM performance_reviews pr
                     LEFT JOIN employees e ON pr.employeeId = e.id
                     LEFT JOIN rating_scales rs ON pr.ratingScaleId = rs.id
                     LEFT JOIN performance_review_cycles rc ON pr.reviewCycleId = rc.id
                     WHERE 1=1`;
        const params = [];
        if (employeeId) { query += " AND pr.employeeId = ?"; params.push(employeeId); }
        if (reviewCycleId) { query += " AND pr.reviewCycleId = ?"; params.push(reviewCycleId); }
        if (status) { query += " AND pr.status = ?"; params.push(status); }
        const [reviews] = await pool.query(query, params);
        res.json(reviews);
    } catch (error) {
        console.error("Error fetching performance reviews:", error);
        res.status(500).json({ message: "Error fetching performance reviews", error: error.message });
    }
});

router.post("/reviews", async (req, res) => {
    try {
        const { employeeId, reviewCycleId, selfAssessment } = req.body;
        const [result] = await pool.query(
            "INSERT INTO performance_reviews (employeeId, reviewCycleId, selfAssessment) VALUES (?, ?, ?)",
            [employeeId, reviewCycleId, selfAssessment || null]
        );
        const [newRow] = await pool.query("SELECT * FROM performance_reviews WHERE id = ?", [result.insertId]);
        res.status(201).json(newRow[0]);
    } catch (error) {
        console.error("Error creating performance review:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Review already exists for this employee and cycle" });
        }
        res.status(500).json({ message: "Error creating performance review", error: error.message });
    }
});

router.patch("/reviews/:id", async (req, res) => {
    try {
        const { selfAssessment, managerReview, finalScore, ratingScaleId, status, reviewedBy } = req.body;
        const [result] = await pool.query(
            `UPDATE performance_reviews SET selfAssessment = ?, managerReview = ?, finalScore = ?,
             ratingScaleId = ?, status = ?, reviewedBy = ?, reviewedAt = NOW() WHERE id = ?`,
            [selfAssessment || null, managerReview || null, finalScore || null, ratingScaleId || null, status, reviewedBy || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Performance review not found" });
        }
        const [updatedRow] = await pool.query("SELECT * FROM performance_reviews WHERE id = ?", [req.params.id]);
        res.json(updatedRow[0]);
    } catch (error) {
        console.error("Error updating performance review:", error);
        res.status(500).json({ message: "Error updating performance review", error: error.message });
    }
});

router.delete("/reviews/:id", async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM performance_reviews WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Performance review not found" });
        }
        res.json({ message: "Performance review deleted successfully" });
    } catch (error) {
        console.error("Error deleting performance review:", error);
        res.status(500).json({ message: "Error deleting performance review", error: error.message });
    }
});

export default router;