import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";
import { httpError, sendError, toNullable } from "../utils/production.js";

const router = express.Router();

router.use(authMiddleware);

const DETAIL_QUERY = `
    SELECT pw.*, rm.name AS rawMaterialName, rm.sku,
           u.name AS unitName, u.symbol AS unitSymbol,
           usr.email AS recordedByEmail, po.productionNumber
    FROM production_wastage pw
    JOIN production_orders po ON pw.productionOrderId = po.id
    LEFT JOIN raw_materials rm ON pw.rawMaterialId = rm.id
    LEFT JOIN inventory_units u ON pw.unitId = u.id
    LEFT JOIN users usr ON pw.recordedBy = usr.id
`;

router.get("/", async (req, res) => {
    try {
        const { productionOrderId, wastageType, rawMaterialId } = req.query;
        let query = `${DETAIL_QUERY} WHERE 1 = 1`;
        const params = [];
        if (productionOrderId) { query += " AND pw.productionOrderId = ?"; params.push(productionOrderId); }
        if (wastageType) { query += " AND pw.wastageType = ?"; params.push(wastageType); }
        if (rawMaterialId) { query += " AND pw.rawMaterialId = ?"; params.push(rawMaterialId); }
        query += " ORDER BY pw.recordedAt DESC, pw.id DESC";
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        sendError(res, "fetching production wastage", error);
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [rows] = await pool.query(`${DETAIL_QUERY} WHERE pw.id = ?`, [req.params.id]);
        if (rows.length === 0) {
            return res.status(404).json({ message: "Wastage record not found" });
        }
        res.json(rows[0]);
    } catch (error) {
        sendError(res, "fetching wastage record", error);
    }
});

// Wastage is recorded for reporting only: the matching quantity is already
// included in the raw-material consumption when production is completed.
router.post("/", async (req, res) => {
    try {
        const {
            productionOrderId, rawMaterialId, wastageType,
            quantity, unitId, description,
        } = req.body;
        if (!productionOrderId || !wastageType || !quantity || !unitId) {
            throw httpError(400, "productionOrderId, wastageType, quantity and unitId are required");
        }
        const [result] = await pool.query(
            `INSERT INTO production_wastage
                (productionOrderId, rawMaterialId, wastageType, quantity,
                 unitId, description, recordedBy)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                productionOrderId,
                toNullable(rawMaterialId),
                wastageType,
                quantity,
                unitId,
                toNullable(description),
                req.user.id,
            ]
        );
        const [created] = await pool.query(`${DETAIL_QUERY} WHERE pw.id = ?`, [result.insertId]);
        res.status(201).json(created[0]);
    } catch (error) {
        sendError(res, "recording production wastage", error);
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { rawMaterialId, wastageType, quantity, unitId, description } = req.body;
        const [result] = await pool.query(
            `UPDATE production_wastage
             SET rawMaterialId = ?, wastageType = ?, quantity = ?, unitId = ?, description = ?
             WHERE id = ?`,
            [
                toNullable(rawMaterialId),
                wastageType,
                quantity,
                unitId,
                toNullable(description),
                req.params.id,
            ]
        );
        if (result.affectedRows === 0) {
            throw httpError(404, "Wastage record not found");
        }
        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE pw.id = ?`, [req.params.id]);
        res.json(updated[0]);
    } catch (error) {
        sendError(res, "updating wastage record", error);
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM production_wastage WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) {
            throw httpError(404, "Wastage record not found");
        }
        res.json({ message: "Wastage record deleted successfully" });
    } catch (error) {
        sendError(res, "deleting wastage record", error);
    }
});

export default router;
