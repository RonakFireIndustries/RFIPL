import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";
import {
    duplicateError,
    generateProductSku,
    httpError,
    sendError,
    toNullable,
} from "../utils/production.js";

const router = express.Router();

router.use(authMiddleware);

const DETAIL_QUERY = `
    SELECT fp.*, ic.name AS categoryName, u.name AS unitName, u.symbol AS unitSymbol
    FROM finished_products fp
    LEFT JOIN inventory_categories ic ON fp.categoryId = ic.id
    LEFT JOIN inventory_units u ON fp.unitId = u.id
`;

router.get("/", async (req, res) => {
    try {
        const { search, categoryId, isActive } = req.query;
        let query = `${DETAIL_QUERY} WHERE fp.deletedAt IS NULL`;
        const params = [];
        if (search) {
            query += " AND (fp.name LIKE ? OR fp.sku LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }
        if (categoryId) { query += " AND fp.categoryId = ?"; params.push(categoryId); }
        if (isActive !== undefined) { query += " AND fp.isActive = ?"; params.push(Number(isActive)); }
        query += " ORDER BY fp.name";
        const [products] = await pool.query(query, params);
        res.json(products);
    } catch (error) {
        sendError(res, "fetching finished products", error);
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [products] = await pool.query(
            `${DETAIL_QUERY} WHERE fp.id = ? AND fp.deletedAt IS NULL`,
            [req.params.id]
        );
        if (products.length === 0) {
            return res.status(404).json({ message: "Finished product not found" });
        }
        res.json(products[0]);
    } catch (error) {
        sendError(res, "fetching finished product", error);
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            sku, name, categoryId, unitId, description,
            minimumStockLevel, sellingPrice, isActive,
        } = req.body;
        if (!name || !unitId) {
            throw httpError(400, "name and unitId are required");
        }

        await connection.beginTransaction();
        const finalSku = sku ? String(sku).trim() : await generateProductSku(connection);

        const [result] = await connection.query(
            `INSERT INTO finished_products
                (sku, name, categoryId, unitId, description, minimumStockLevel, sellingPrice, isActive)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                finalSku,
                name,
                toNullable(categoryId),
                unitId,
                toNullable(description),
                minimumStockLevel === undefined || minimumStockLevel === "" ? 0 : minimumStockLevel,
                toNullable(sellingPrice),
                isActive === undefined ? 1 : Number(isActive),
            ]
        );
        await connection.commit();

        const [created] = await pool.query(`${DETAIL_QUERY} WHERE fp.id = ?`, [result.insertId]);
        res.status(201).json(created[0]);
    } catch (error) {
        await connection.rollback();
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "SKU already exists" });
        }
        sendError(res, "creating finished product", error);
    } finally {
        connection.release();
    }
});

router.put("/:id", async (req, res) => {
    try {
        const {
            sku, name, categoryId, unitId, description,
            minimumStockLevel, sellingPrice, isActive,
        } = req.body;
        const [result] = await pool.query(
            `UPDATE finished_products
             SET sku = ?, name = ?, categoryId = ?, unitId = ?, description = ?,
                 minimumStockLevel = ?, sellingPrice = ?, isActive = ?
             WHERE id = ? AND deletedAt IS NULL`,
            [
                sku,
                name,
                toNullable(categoryId),
                unitId,
                toNullable(description),
                minimumStockLevel === undefined || minimumStockLevel === "" ? 0 : minimumStockLevel,
                toNullable(sellingPrice),
                isActive === undefined ? 1 : Number(isActive),
                req.params.id,
            ]
        );
        if (result.affectedRows === 0) {
            throw httpError(404, "Finished product not found");
        }
        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE fp.id = ?`, [req.params.id]);
        res.json(updated[0]);
    } catch (error) {
        duplicateError(res, error, "SKU already exists");
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE finished_products SET deletedAt = NOW(), isActive = 0 WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(404, "Finished product not found");
        }
        res.json({ message: "Finished product deleted successfully" });
    } catch (error) {
        sendError(res, "deleting finished product", error);
    }
});

export default router;
