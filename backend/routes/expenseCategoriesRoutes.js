import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const [categories] = await pool.query(
            "SELECT * FROM expense_categories WHERE deletedAt IS NULL ORDER BY name"
        );
        res.json(categories);
    } catch (error) {
        console.error("Error fetching expense categories:", error);
        res.status(500).json({ message: "Error fetching expense categories", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [categories] = await pool.query(
            "SELECT * FROM expense_categories WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (categories.length === 0) {
            return res.status(404).json({ message: "Expense category not found" });
        }
        res.json(categories[0]);
    } catch (error) {
        console.error("Error fetching expense category:", error);
        res.status(500).json({ message: "Error fetching expense category", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, description, isActive } = req.body;
        const [result] = await pool.query(
            "INSERT INTO expense_categories (name, description, isActive) VALUES (?, ?, ?)",
            [name, description || null, isActive !== undefined ? isActive : true]
        );
        const [newCategory] = await pool.query("SELECT * FROM expense_categories WHERE id = ?", [result.insertId]);
        res.status(201).json(newCategory[0]);
    } catch (error) {
        console.error("Error creating expense category:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Expense category already exists" });
        }
        res.status(500).json({ message: "Error creating expense category", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, description, isActive } = req.body;
        const [result] = await pool.query(
            "UPDATE expense_categories SET name = ?, description = ?, isActive = ? WHERE id = ? AND deletedAt IS NULL",
            [name, description || null, isActive !== undefined ? isActive : true, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Expense category not found" });
        }
        const [updatedCategory] = await pool.query("SELECT * FROM expense_categories WHERE id = ?", [req.params.id]);
        res.json(updatedCategory[0]);
    } catch (error) {
        console.error("Error updating expense category:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Expense category already exists" });
        }
        res.status(500).json({ message: "Error updating expense category", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE expense_categories SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Expense category not found" });
        }
        res.json({ message: "Expense category deleted successfully" });
    } catch (error) {
        console.error("Error deleting expense category:", error);
        res.status(500).json({ message: "Error deleting expense category", error: error.message });
    }
});

export default router;
