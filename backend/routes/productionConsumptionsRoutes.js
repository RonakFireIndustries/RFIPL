import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";
import {
    addRawLedger,
    consumeFifo,
    consumeFromBatch,
    httpError,
    sendError,
    toNullable,
} from "../utils/production.js";

const router = express.Router();

router.use(authMiddleware);

const DETAIL_QUERY = `
    SELECT pc.*, rm.name AS rawMaterialName, rm.sku,
           b.batchNumber, u.name AS unitName, u.symbol AS unitSymbol,
           usr.email AS consumedByEmail, po.productionNumber
    FROM production_consumptions pc
    JOIN raw_materials rm ON pc.rawMaterialId = rm.id
    LEFT JOIN raw_material_batches b ON pc.batchId = b.id
    LEFT JOIN inventory_units u ON pc.unitId = u.id
    LEFT JOIN users usr ON pc.consumedBy = usr.id
    JOIN production_orders po ON pc.productionOrderId = po.id
`;

router.get("/", async (req, res) => {
    try {
        const { productionOrderId, rawMaterialId, consumptionMode } = req.query;
        let query = `${DETAIL_QUERY} WHERE 1 = 1`;
        const params = [];
        if (productionOrderId) { query += " AND pc.productionOrderId = ?"; params.push(productionOrderId); }
        if (rawMaterialId) { query += " AND pc.rawMaterialId = ?"; params.push(rawMaterialId); }
        if (consumptionMode) { query += " AND pc.consumptionMode = ?"; params.push(consumptionMode); }
        query += " ORDER BY pc.consumedAt DESC, pc.id DESC";
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        sendError(res, "fetching production consumption", error);
    }
});

// Records an additional manual consumption for an in-progress order.
// Stock is deducted immediately, FIFO unless a batch is specified.
router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            productionOrderId, rawMaterialId, batchId,
            consumedQuantity, unitId, remarks,
        } = req.body;
        if (!productionOrderId || !rawMaterialId || !consumedQuantity || !unitId) {
            throw httpError(400, "productionOrderId, rawMaterialId, consumedQuantity and unitId are required");
        }

        const [orders] = await connection.query(
            "SELECT id, status, productionNumber FROM production_orders WHERE id = ?",
            [productionOrderId]
        );
        if (orders.length === 0) {
            throw httpError(404, "Production order not found");
        }
        if (orders[0].status !== "in_progress") {
            throw httpError(400, "Manual consumption is only allowed on in-progress orders");
        }

        await connection.beginTransaction();

        const allocations = batchId
            ? await consumeFromBatch(connection, {
                rawMaterialId, batchId, requiredQuantity: consumedQuantity, unitId,
            })
            : await consumeFifo(connection, {
                rawMaterialId, requiredQuantity: consumedQuantity, unitId,
            });

        for (const allocation of allocations) {
            await connection.query(
                `INSERT INTO production_consumptions
                    (productionOrderId, rawMaterialId, batchId, consumptionMode,
                     plannedQuantity, consumedQuantity, unitId, consumedBy, remarks)
                 VALUES (?, ?, ?, 'manual', NULL, ?, ?, ?, ?)`,
                [
                    productionOrderId,
                    rawMaterialId,
                    allocation.batchId,
                    allocation.quantity,
                    unitId,
                    req.user.id,
                    toNullable(remarks || `Manual consumption from batch ${allocation.batchNumber}`),
                ]
            );
            await addRawLedger(connection, {
                rawMaterialId,
                batchId: allocation.batchId,
                transactionType: "production_consumption",
                referenceType: "production_order",
                referenceId: productionOrderId,
                quantityOut: allocation.stockDeduction,
                unitCost: allocation.unitCost,
                remarks: `${orders[0].productionNumber} · manual consumption · ${allocation.batchNumber}`,
                createdBy: req.user.id,
            });
        }

        await connection.commit();
        const [created] = await pool.query(`${DETAIL_QUERY} WHERE pc.productionOrderId = ? ORDER BY pc.id DESC LIMIT ?`, [productionOrderId, allocations.length]);
        res.status(201).json(allocations.length === 1 ? created[0] : created.reverse());
    } catch (error) {
        await connection.rollback();
        sendError(res, "recording production consumption", error);
    } finally {
        connection.release();
    }
});

export default router;
