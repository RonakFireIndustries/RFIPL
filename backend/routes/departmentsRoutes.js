import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const [departments] = await pool.query(
            "SELECT * FROM departments WHERE deletedAt IS NULL ORDER BY name"
        );
        res.json(departments);
    } catch (error) {
        console.error("Error fetching departments:", error);
        res.status(500).json({ message: "Error fetching departments", error: error.message });
    }
});

router.get("/active", async (req, res) => {
    try {
        const [departments] = await pool.query(
            "SELECT * FROM departments WHERE isActive = 1 AND deletedAt IS NULL ORDER BY name"
        );
        res.json(departments);
    } catch (error) {
        console.error("Error fetching active departments:", error);
        res.status(500).json({ message: "Error fetching active departments", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [departments] = await pool.query(
            "SELECT * FROM departments WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (departments.length === 0) {
            return res.status(404).json({ message: "Department not found" });
        }
        res.json(departments[0]);
    } catch (error) {
        console.error("Error fetching department:", error);
        res.status(500).json({ message: "Error fetching department", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, code, description, hodEmployeeId, isActive } = req.body;
        const [result] = await pool.query(
            "INSERT INTO departments (name, code, description, hodEmployeeId, isActive) VALUES (?, ?, ?, ?, ?)",
            [name, code, description || null, hodEmployeeId || null, isActive !== undefined ? isActive : true]
        );
        const [newDepartment] = await pool.query("SELECT * FROM departments WHERE id = ?", [result.insertId]);
        res.status(201).json(newDepartment[0]);
    } catch (error) {
        console.error("Error creating department:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Department name or code already exists" });
        }
        res.status(500).json({ message: "Error creating department", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, code, description, hodEmployeeId, isActive } = req.body;
        const [result] = await pool.query(
            "UPDATE departments SET name = ?, code = ?, description = ?, hodEmployeeId = ?, isActive = ? WHERE id = ? AND deletedAt IS NULL",
            [name, code, description || null, hodEmployeeId || null, isActive !== undefined ? isActive : true, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Department not found" });
        }
        const [updatedDepartment] = await pool.query("SELECT * FROM departments WHERE id = ?", [req.params.id]);
        res.json(updatedDepartment[0]);
    } catch (error) {
        console.error("Error updating department:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Department name or code already exists" });
        }
        res.status(500).json({ message: "Error updating department", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE departments SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Department not found" });
        }
        res.json({ message: "Department deleted successfully" });
    } catch (error) {
        console.error("Error deleting department:", error);
        res.status(500).json({ message: "Error deleting department", error: error.message });
    }
});

export default router;
