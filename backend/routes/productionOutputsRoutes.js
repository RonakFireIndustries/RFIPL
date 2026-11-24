import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";
import { sendError } from "../utils/production.js";

const router = express.Router();

router.use(authMiddleware);

// Outputs are created automatically when a production order is completed.
// This router is read-only so stock cannot be posted twice.

const DETAIL_QUERY = `
    SELECT po.*, fp.name AS finishedProductName, fp.sku AS finishedProductSku,
           fb.batchNumber, fb.manualCost,
           po2.productionNumber, u.name AS unitName, u.symbol AS unitSymbol
    FROM production_outputs po
    JOIN finished_products fp ON po.finishedProductId = fp.id
    JOIN finished_product_batches fb ON po.batchId = fb.id
    JOIN production_orders po2 ON po.productionOrderId = po2.id
    LEFT JOIN inventory_units u ON po.unitId = u.id
`;

router.get("/", async (req, res) => {
    try {
        const { productionOrderId, finishedProductId } = req.query;
        let query = `${DETAIL_QUERY} WHERE 1 = 1`;
        const params = [];
        if (productionOrderId) { query += " AND po.productionOrderId = ?"; params.push(productionOrderId); }
        if (finishedProductId) { query += " AND po.finishedProductId = ?"; params.push(finishedProductId); }
        query += " ORDER BY po.createdAt DESC, po.id DESC";
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        sendError(res, "fetching production outputs", error);
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [rows] = await pool.query(`${DETAIL_QUERY} WHERE po.id = ?`, [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Production output not found" });
        }
        res.json(rows[0]);
    } catch (error) {
        sendError(res, "fetching production output", error);
    }
});

export default router;
