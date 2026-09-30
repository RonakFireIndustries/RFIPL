import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { categoryId, isActive, search } = req.query;
        let query = `SELECT fp.*, c.name AS categoryName, u.name AS unitName, u.symbol AS unitSymbol
                     FROM finished_products fp
                     LEFT JOIN inventory_categories c ON fp.categoryId = c.id
                     LEFT JOIN inventory_units u ON fp.unitId = u.id
                     WHERE fp.deletedAt IS NULL`;
        const params = [];
        if (categoryId) { query += " AND fp.categoryId = ?"; params.push(categoryId); }
        if (isActive !== undefined) { query += " AND fp.isActive = ?"; params.push(Number(isActive)); }
        if (search) { query += " AND (fp.name LIKE ? OR fp.sku LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
        query += " ORDER BY fp.name";
        const [products] = await pool.query(query, params);
        res.json(products);
    } catch (error) {
        console.error("Error fetching finished products:", error);
        res.status(500).json({ message: "Error fetching finished products", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [products] = await pool.query(
            `SELECT fp.*, c.name AS categoryName, u.name AS unitName, u.symbol AS unitSymbol,
                    COALESCE((SELECT SUM(quantity) FROM finished_product_stock fs WHERE fs.finishedProductId = fp.id), 0) AS totalStock
             FROM finished_products fp
             LEFT JOIN inventory_categories c ON fp.categoryId = c.id
             LEFT JOIN inventory_units u ON fp.unitId = u.id
             WHERE fp.id = ? AND fp.deletedAt IS NULL`,
            [req.params.id]
        );
        if (products.length === 0) {
            return res.status(404).json({ message: "Finished product not found" });
        }
        res.json(products[0]);
    } catch (error) {
        console.error("Error fetching finished product:", error);
        res.status(500).json({ message: "Error fetching finished product", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { sku, name, categoryId, unitId, description, minimumStockLevel, sellingPrice, isActive } = req.body;
        const [result] = await pool.query(
            `INSERT INTO finished_products (sku, name, categoryId, unitId, description, minimumStockLevel, sellingPrice, isActive)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [sku, name, categoryId || null, unitId, description || null,
             minimumStockLevel !== undefined ? minimumStockLevel : 0, sellingPrice || null,
             isActive !== undefined ? Number(isActive) : 1]
        );
        const [newProduct] = await pool.query("SELECT * FROM finished_products WHERE id = ?", [result.insertId]);
        res.status(201).json(newProduct[0]);
    } catch (error) {
        console.error("Error creating finished product:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Finished product SKU already exists" });
        }
        res.status(500).json({ message: "Error creating finished product", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { sku, name, categoryId, unitId, description, minimumStockLevel, sellingPrice, isActive } = req.body;
        const [result] = await pool.query(
            `UPDATE finished_products SET sku = ?, name = ?, categoryId = ?, unitId = ?, description = ?, minimumStockLevel = ?, sellingPrice = ?, isActive = ?
             WHERE id = ? AND deletedAt IS NULL`,
            [sku, name, categoryId || null, unitId, description || null,
             minimumStockLevel !== undefined ? minimumStockLevel : 0, sellingPrice || null,
             isActive !== undefined ? Number(isActive) : 1, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Finished product not found" });
        }
        const [updatedProduct] = await pool.query("SELECT * FROM finished_products WHERE id = ?", [req.params.id]);
        res.json(updatedProduct[0]);
    } catch (error) {
        console.error("Error updating finished product:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Finished product SKU already exists" });
        }
        res.status(500).json({ message: "Error updating finished product", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE finished_products SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Finished product not found" });
        }
        res.json({ message: "Finished product deleted successfully" });
    } catch (error) {
        console.error("Error deleting finished product:", error);
        res.status(500).json({ message: "Error deleting finished product", error: error.message });
    }
});

export default router;