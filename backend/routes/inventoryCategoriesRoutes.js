import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { inventoryType, isActive, search } = req.query;
        let query = "SELECT * FROM inventory_categories WHERE deletedAt IS NULL";
        const params = [];
        if (inventoryType) { query += " AND inventoryType = ?"; params.push(inventoryType); }
        if (isActive !== undefined) { query += " AND isActive = ?"; params.push(Number(isActive)); }
        if (search) { query += " AND name LIKE ?"; params.push(`%${search}%`); }
        query += " ORDER BY name";
        const [categories] = await pool.query(query, params);
        res.json(categories);
    } catch (error) {
        console.error("Error fetching inventory categories:", error);
        res.status(500).json({ message: "Error fetching inventory categories", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [categories] = await pool.query(
            "SELECT * FROM inventory_categories WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (categories.length === 0) {
            return res.status(404).json({ message: "Inventory category not found" });
        }
        res.json(categories[0]);
    } catch (error) {
        console.error("Error fetching inventory category:", error);
        res.status(500).json({ message: "Error fetching inventory category", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, inventoryType, description, isActive } = req.body;
        const [result] = await pool.query(
            "INSERT INTO inventory_categories (name, inventoryType, description, isActive) VALUES (?, ?, ?, ?)",
            [name, inventoryType, description || null, isActive !== undefined ? Number(isActive) : 1]
        );
        const [newCategory] = await pool.query("SELECT * FROM inventory_categories WHERE id = ?", [result.insertId]);
        res.status(201).json(newCategory[0]);
    } catch (error) {
        console.error("Error creating inventory category:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Category with this name already exists for this inventory type" });
        }
        res.status(500).json({ message: "Error creating inventory category", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, inventoryType, description, isActive } = req.body;
        const [result] = await pool.query(
            "UPDATE inventory_categories SET name = ?, inventoryType = ?, description = ?, isActive = ? WHERE id = ? AND deletedAt IS NULL",
            [name, inventoryType, description || null, isActive !== undefined ? Number(isActive) : 1, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Inventory category not found" });
        }
        const [updatedCategory] = await pool.query("SELECT * FROM inventory_categories WHERE id = ?", [req.params.id]);
        res.json(updatedCategory[0]);
    } catch (error) {
        console.error("Error updating inventory category:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Category with this name already exists for this inventory type" });
        }
        res.status(500).json({ message: "Error updating inventory category", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE inventory_categories SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Inventory category not found" });
        }
        res.json({ message: "Inventory category deleted successfully" });
    } catch (error) {
        console.error("Error deleting inventory category:", error);
        res.status(500).json({ message: "Error deleting inventory category", error: error.message });
    }
});

export default router;