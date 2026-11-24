import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";
import {
    addFinishedLedger,
    addRawLedger,
    consumeFifo,
    conversionFactor,
    duplicateError,
    generateDocumentNumber,
    httpError,
    round4,
    sendError,
    toNullable,
    today,
    upsertFinishedStock,
} from "../utils/production.js";

const router = express.Router();

router.use(authMiddleware);

const DETAIL_QUERY = `
    SELECT po.*, d.name AS departmentName,
           bom.bomNumber, bom.name AS bomName,
           bom.outputQuantity AS bomOutputQuantity,
           bom.outputUnitId AS bomOutputUnitId,
           u.symbol AS bomOutputUnitSymbol,
           fp.id AS finishedProductId, fp.name AS finishedProductName,
           creator.email AS createdByEmail
    FROM production_orders po
    LEFT JOIN departments d ON po.departmentId = d.id
    LEFT JOIN bills_of_materials bom ON po.bomId = bom.id
    LEFT JOIN inventory_units u ON bom.outputUnitId = u.id
    LEFT JOIN finished_products fp ON bom.finishedProductId = fp.id
    LEFT JOIN users creator ON po.createdBy = creator.id
`;

async function loadDetail(id) {
    const [orders] = await pool.query(`${DETAIL_QUERY} WHERE po.id = ?`, [id]);
    if (orders.length === 0) return null;

    const [consumptions] = await pool.query(
        `SELECT pc.*, rm.name AS rawMaterialName, b.batchNumber,
                u.symbol AS unitSymbol, usr.email AS consumedByEmail
         FROM production_consumptions pc
         JOIN raw_materials rm ON pc.rawMaterialId = rm.id
         LEFT JOIN raw_material_batches b ON pc.batchId = b.id
         LEFT JOIN inventory_units u ON pc.unitId = u.id
         LEFT JOIN users usr ON pc.consumedBy = usr.id
         WHERE pc.productionOrderId = ? ORDER BY pc.id`,
        [id]
    );
    const [wastage] = await pool.query(
        `SELECT pw.*, rm.name AS rawMaterialName, u.symbol AS unitSymbol,
                usr.email AS recordedByEmail
         FROM production_wastage pw
         LEFT JOIN raw_materials rm ON pw.rawMaterialId = rm.id
         LEFT JOIN inventory_units u ON pw.unitId = u.id
         LEFT JOIN users usr ON pw.recordedBy = usr.id
         WHERE pw.productionOrderId = ? ORDER BY pw.id`,
        [id]
    );
    const [outputs] = await pool.query(
        `SELECT po2.*, fp.name AS finishedProductName, fp.sku,
                fb.batchNumber, u.symbol AS unitSymbol
         FROM production_outputs po2
         JOIN finished_products fp ON po2.finishedProductId = fp.id
         JOIN finished_product_batches fb ON po2.batchId = fb.id
         LEFT JOIN inventory_units u ON po2.unitId = u.id
         WHERE po2.productionOrderId = ? ORDER BY po2.id`,
        [id]
    );

    orders[0].consumptions = consumptions;
    orders[0].wastage = wastage;
    orders[0].outputs = outputs;
    return orders[0];
}

async function sendDetail(res, id, statusCode = 200) {
    const order = await loadDetail(id);
    if (!order) {
        return res.status(404).json({ message: "Production order not found" });
    }
    return res.status(statusCode).json(order);
}

router.get("/", async (req, res) => {
    try {
        const { status, bomId, departmentId } = req.query;
        let query = `${DETAIL_QUERY} WHERE 1 = 1`;
        const params = [];
        if (status) { query += " AND po.status = ?"; params.push(status); }
        if (bomId) { query += " AND po.bomId = ?"; params.push(bomId); }
        if (departmentId) { query += " AND po.departmentId = ?"; params.push(departmentId); }
        query += " ORDER BY po.createdAt DESC, po.id DESC";
        const [orders] = await pool.query(query, params);
        res.json(orders);
    } catch (error) {
        sendError(res, "fetching production orders", error);
    }
});

router.get("/:id", async (req, res) => {
    try {
        await sendDetail(res, req.params.id);
    } catch (error) {
        sendError(res, "fetching production order", error);
    }
});

router.post("/", async (req, res) => {
    try {
        const {
            departmentId, bomId, plannedStartDate, plannedCompletionDate, remarks, createdBy,
        } = req.body;

        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();
            const productionNumber = await generateDocumentNumber(connection, {
                table: "production_orders",
                column: "productionNumber",
                prefix: "PROD-",
            });
            const [result] = await connection.query(
                `INSERT INTO production_orders
                    (productionNumber, departmentId, bomId, plannedStartDate,
                     plannedCompletionDate, status, createdBy, remarks)
                 VALUES (?, ?, ?, ?, ?, 'draft', ?, ?)`,
                [
                    productionNumber,
                    toNullable(departmentId),
                    toNullable(bomId),
                    toNullable(plannedStartDate),
                    toNullable(plannedCompletionDate),
                    createdBy || req.user.id,
                    toNullable(remarks),
                ]
            );
            await connection.commit();
            return await sendDetail(res, result.insertId, 201);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        duplicateError(res, error, "Production number already exists");
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { departmentId, bomId, plannedStartDate, plannedCompletionDate, remarks } = req.body;
        const [result] = await pool.query(
            `UPDATE production_orders
             SET departmentId = ?, bomId = ?, plannedStartDate = ?,
                 plannedCompletionDate = ?, remarks = ?
             WHERE id = ? AND status IN ('draft', 'planned')`,
            [
                toNullable(departmentId),
                toNullable(bomId),
                toNullable(plannedStartDate),
                toNullable(plannedCompletionDate),
                toNullable(remarks),
                req.params.id,
            ]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Production order not found or no longer editable");
        }
        await sendDetail(res, req.params.id);
    } catch (error) {
        sendError(res, "updating production order", error);
    }
});

router.patch("/:id/plan", async (req, res) => {
    try {
        const { plannedStartDate, plannedCompletionDate } = req.body;
        const [result] = await pool.query(
            `UPDATE production_orders
             SET status = 'planned',
                 plannedStartDate = COALESCE(?, plannedStartDate),
                 plannedCompletionDate = COALESCE(?, plannedCompletionDate)
             WHERE id = ? AND status = 'draft'`,
            [toNullable(plannedStartDate), toNullable(plannedCompletionDate), req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Only draft orders can be planned");
        }
        await sendDetail(res, req.params.id);
    } catch (error) {
        sendError(res, "planning production order", error);
    }
});

router.patch("/:id/start", async (req, res) => {
    try {
        const [result] = await pool.query(
            `UPDATE production_orders
             SET status = 'in_progress', actualStartAt = NOW()
             WHERE id = ? AND status IN ('draft', 'planned')`,
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Only planned or draft orders can be started");
        }
        await sendDetail(res, req.params.id);
    } catch (error) {
        sendError(res, "starting production order", error);
    }
});

router.patch("/:id/cancel", async (req, res) => {
    try {
        const [result] = await pool.query(
            `UPDATE production_orders SET status = 'cancelled'
             WHERE id = ? AND status NOT IN ('completed', 'cancelled')`,
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Production order cannot be cancelled");
        }
        await sendDetail(res, req.params.id);
    } catch (error) {
        sendError(res, "cancelling production order", error);
    }
});

// Completes a production order atomically:
//   1. consume BOM raw materials FIFO from batch stock (with ledger rows)
//   2. record BOM wastage as normal wastage rows
//   3. create finished batches + outputs + stock and finished ledger rows
router.post("/:id/complete", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const [orders] = await connection.query(
            `${DETAIL_QUERY} WHERE po.id = ?`,
            [req.params.id]
        );
        if (orders.length === 0) {
            throw httpError(404, "Production order not found");
        }
        const order = orders[0];
        if (!["planned", "in_progress"].includes(order.status)) {
            throw httpError(400, "Only planned or in-progress orders can be completed");
        }
        if (!order.bomId) {
            throw httpError(400, "Assign a BOM before completing this order");
        }

        const [boms] = await connection.query(
            "SELECT * FROM bills_of_materials WHERE id = ? AND deletedAt IS NULL",
            [order.bomId]
        );
        if (boms.length === 0) {
            throw httpError(404, "BOM not found");
        }
        const bom = boms[0];
        if (Number(bom.outputQuantity) <= 0) {
            throw httpError(400, "BOM output quantity must be greater than zero");
        }

        const [bomItems] = await connection.query(
            `SELECT bi.*, rm.name AS materialName
             FROM bom_items bi
             JOIN raw_materials rm ON bi.rawMaterialId = rm.id
             WHERE bi.bomId = ? ORDER BY bi.id`,
            [bom.id]
        );
        if (bomItems.length === 0) {
            throw httpError(400, "The selected BOM has no materials");
        }

        const requestedOutputs =
            Array.isArray(req.body.outputs) && req.body.outputs.length > 0
                ? req.body.outputs
                : [{
                    finishedProductId: bom.finishedProductId,
                    outputQuantity: bom.outputQuantity,
                    unitId: bom.outputUnitId,
                    manufacturingDate: today(),
                    batchNumber: `${order.productionNumber}-B1`,
                    manualCost: req.body.manualCost,
                }];

        const outputs = requestedOutputs.map((output, index) => ({
            finishedProductId: output.finishedProductId || bom.finishedProductId,
            outputQuantity: Number(
                output.outputQuantity === undefined || output.outputQuantity === ""
                    ? bom.outputQuantity
                    : output.outputQuantity
            ),
            unitId: output.unitId || bom.outputUnitId,
            manufacturingDate: output.manufacturingDate || today(),
            batchNumber: output.batchNumber || `${order.productionNumber}-B${index + 1}`,
            manualCost: toNullable(output.manualCost),
        }));
        if (outputs.some((output) => !(output.outputQuantity > 0))) {
            throw httpError(400, "Every output needs a quantity greater than zero");
        }

        let totalOutputInBomUnit = 0;
        for (const output of outputs) {
            const factor = await conversionFactor(connection, output.unitId, bom.outputUnitId);
            totalOutputInBomUnit = round4(totalOutputInBomUnit + output.outputQuantity * factor);
        }
        const scale = round4(totalOutputInBomUnit / Number(bom.outputQuantity));
        if (!(scale > 0)) {
            throw httpError(400, "Total output quantity must be greater than zero");
        }

        await connection.beginTransaction();

        for (const item of bomItems) {
            const baseQuantity = round4(Number(item.requiredQuantity) * scale);
            const wastageQuantity = round4(baseQuantity * Number(item.wastagePercentage) / 100);
            const plannedQuantity = round4(baseQuantity + wastageQuantity);

            let allocations;
            try {
                allocations = await consumeFifo(connection, {
                    rawMaterialId: item.rawMaterialId,
                    requiredQuantity: plannedQuantity,
                    unitId: item.unitId,
                });
            } catch (error) {
                if (error.statusCode === 400) {
                    throw httpError(400, `${item.materialName}: ${error.message}`);
                }
                throw error;
            }

            for (const [index, allocation] of allocations.entries()) {
                await connection.query(
                    `INSERT INTO production_consumptions
                        (productionOrderId, rawMaterialId, batchId, consumptionMode,
                         plannedQuantity, consumedQuantity, unitId, consumedBy, remarks)
                     VALUES (?, ?, ?, 'automatic', ?, ?, ?, ?, ?)`,
                    [
                        order.id,
                        item.rawMaterialId,
                        allocation.batchId,
                        index === 0 ? baseQuantity : null,
                        allocation.quantity,
                        item.unitId,
                        req.user.id,
                        `FIFO consumption from batch ${allocation.batchNumber}`,
                    ]
                );
                await addRawLedger(connection, {
                    rawMaterialId: item.rawMaterialId,
                    batchId: allocation.batchId,
                    transactionType: "production_consumption",
                    referenceType: "production_order",
                    referenceId: order.id,
                    quantityOut: allocation.stockDeduction,
                    unitCost: allocation.unitCost,
                    remarks: `${order.productionNumber} · ${item.materialName} · ${allocation.batchNumber}`,
                    createdBy: req.user.id,
                });
            }

            if (wastageQuantity > 0) {
                await connection.query(
                    `INSERT INTO production_wastage
                        (productionOrderId, rawMaterialId, wastageType, quantity,
                         unitId, description, recordedBy)
                     VALUES (?, ?, 'normal', ?, ?, ?, ?)`,
                    [
                        order.id,
                        item.rawMaterialId,
                        wastageQuantity,
                        item.unitId,
                        `BOM wastage ${item.wastagePercentage}% for ${item.materialName}`,
                        req.user.id,
                    ]
                );
            }
        }

        for (const output of outputs) {
            const [batchResult] = await connection.query(
                `INSERT INTO finished_product_batches
                    (finishedProductId, batchNumber, productionOrderId, manufacturingDate,
                     originalQuantity, currentQuantity, unitId, manualCost)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    output.finishedProductId,
                    output.batchNumber,
                    order.id,
                    output.manufacturingDate,
                    output.outputQuantity,
                    output.outputQuantity,
                    output.unitId,
                    output.manualCost,
                ]
            );
            const batchId = batchResult.insertId;

            await connection.query(
                `INSERT INTO production_outputs
                    (productionOrderId, finishedProductId, batchId, outputQuantity,
                     unitId, manufacturingDate)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    order.id,
                    output.finishedProductId,
                    batchId,
                    output.outputQuantity,
                    output.unitId,
                    output.manufacturingDate,
                ]
            );

            await upsertFinishedStock(connection, {
                finishedProductId: output.finishedProductId,
                batchId,
                quantity: output.outputQuantity,
                unitId: output.unitId,
            });

            await addFinishedLedger(connection, {
                finishedProductId: output.finishedProductId,
                batchId,
                transactionType: "production_output",
                referenceType: "production_order",
                referenceId: order.id,
                quantityIn: output.outputQuantity,
                unitCost: output.manualCost,
                remarks: `${order.productionNumber} · batch ${output.batchNumber}`,
                createdBy: req.user.id,
            });
        }

        await connection.query(
            `UPDATE production_orders
             SET status = 'completed',
                 actualStartAt = COALESCE(actualStartAt, NOW()),
                 actualCompletedAt = NOW()
             WHERE id = ?`,
            [order.id]
        );

        await connection.commit();
        return await sendDetail(res, order.id);
    } catch (error) {
        await connection.rollback();
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "A generated batch number already exists" });
        }
        sendError(res, "completing production order", error);
    } finally {
        connection.release();
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM production_orders WHERE id = ? AND status = 'draft'",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Only draft production orders can be deleted");
        }
        res.json({ message: "Production order deleted successfully" });
    } catch (error) {
        sendError(res, "deleting production order", error);
    }
});

export default router;
