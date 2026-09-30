import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

const addFinishedLedger = async (db, entry) => {
    await db.query(
        `INSERT INTO finished_product_stock_ledger (finishedProductId, batchId, locationId, transactionType, referenceType, referenceId, quantityIn, quantityOut, unitCost, remarks, createdBy)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [entry.finishedProductId, entry.batchId || null, entry.locationId || null, entry.transactionType,
         entry.referenceType || null, entry.referenceId || null,
         entry.quantityIn || 0, entry.quantityOut || 0, entry.unitCost || null, entry.remarks || null, entry.createdBy]
    );
};

router.get("/", async (req, res) => {
    try {
        const { status, departmentId } = req.query;
        let query = `SELECT po.*, d.name AS departmentName, bom.bomNumber, emp.firstName, emp.lastName
                     FROM production_orders po
                     LEFT JOIN departments d ON po.departmentId = d.id
                     LEFT JOIN bills_of_materials bom ON po.bomId = bom.id
                     LEFT JOIN employees emp ON po.createdBy = emp.id
                     WHERE 1 = 1`;
        const params = [];
        if (status) { query += " AND po.status = ?"; params.push(status); }
        if (departmentId) { query += " AND po.departmentId = ?"; params.push(departmentId); }
        query += " ORDER BY po.createdAt DESC";
        const [orders] = await pool.query(query, params);
        res.json(orders);
    } catch (error) {
        console.error("Error fetching production orders:", error);
        res.status(500).json({ message: "Error fetching production orders", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [orders] = await pool.query(
            `SELECT po.*, d.name AS departmentName, bom.bomNumber, emp.firstName, emp.lastName
             FROM production_orders po
             LEFT JOIN departments d ON po.departmentId = d.id
             LEFT JOIN bills_of_materials bom ON po.bomId = bom.id
             LEFT JOIN employees emp ON po.createdBy = emp.id
             WHERE po.id = ?`,
            [req.params.id]
        );
        if (orders.length === 0) {
            return res.status(404).json({ message: "Production order not found" });
        }
        const [consumptions] = await pool.query(
            `SELECT pc.*, rm.name AS rawMaterialName, rm.sku, rb.batchNumber, u.symbol AS unitSymbol, sl.name AS locationName
             FROM production_consumptions pc
             LEFT JOIN raw_materials rm ON pc.rawMaterialId = rm.id
             LEFT JOIN raw_material_batches rb ON pc.batchId = rb.id
             LEFT JOIN inventory_units u ON pc.unitId = u.id
             LEFT JOIN stock_locations sl ON pc.locationId = sl.id
             WHERE pc.productionOrderId = ?`,
            [req.params.id]
        );
        const [wastage] = await pool.query(
            `SELECT pw.*, rm.name AS rawMaterialName, u.symbol AS unitSymbol
             FROM production_wastage pw
             LEFT JOIN raw_materials rm ON pw.rawMaterialId = rm.id
             LEFT JOIN inventory_units u ON pw.unitId = u.id
             WHERE pw.productionOrderId = ?`,
            [req.params.id]
        );
        const [outputs] = await pool.query(
            `SELECT po2.*, fp.name AS finishedProductName, fp.sku, fb.batchNumber, u.symbol AS unitSymbol, sl.name AS locationName
             FROM production_outputs po2
             LEFT JOIN finished_products fp ON po2.finishedProductId = fp.id
             LEFT JOIN finished_product_batches fb ON po2.batchId = fb.id
             LEFT JOIN inventory_units u ON po2.unitId = u.id
             LEFT JOIN stock_locations sl ON po2.locationId = sl.id
             WHERE po2.productionOrderId = ?`,
            [req.params.id]
        );
        orders[0].consumptions = consumptions;
        orders[0].wastage = wastage;
        orders[0].outputs = outputs;
        res.json(orders[0]);
    } catch (error) {
        console.error("Error fetching production order:", error);
        res.status(500).json({ message: "Error fetching production order", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { productionNumber, departmentId, bomId, plannedStartDate, plannedCompletionDate, status, createdBy, remarks } = req.body;
        const [result] = await pool.query(
            `INSERT INTO production_orders (productionNumber, departmentId, bomId, plannedStartDate, plannedCompletionDate, status, createdBy, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [productionNumber, departmentId || null, bomId || null, plannedStartDate || null,
             plannedCompletionDate || null, status || 'draft', createdBy, remarks || null]
        );
        const [newOrder] = await pool.query("SELECT * FROM production_orders WHERE id = ?", [result.insertId]);
        res.status(201).json(newOrder[0]);
    } catch (error) {
        console.error("Error creating production order:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Production order number already exists" });
        }
        res.status(500).json({ message: "Error creating production order", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { departmentId, bomId, plannedStartDate, plannedCompletionDate, remarks } = req.body;
        const [result] = await pool.query(
            "UPDATE production_orders SET departmentId = ?, bomId = ?, plannedStartDate = ?, plannedCompletionDate = ?, remarks = ? WHERE id = ?",
            [departmentId || null, bomId || null, plannedStartDate || null, plannedCompletionDate || null, remarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Production order not found" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM production_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error updating production order:", error);
        res.status(500).json({ message: "Error updating production order", error: error.message });
    }
});

router.patch("/:id/start", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE production_orders SET status = 'in_progress', actualStartAt = NOW() WHERE id = ? AND status IN ('draft', 'planned')",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Production order cannot be started" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM production_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error starting production order:", error);
        res.status(500).json({ message: "Error starting production order", error: error.message });
    }
});

router.patch("/:id/complete", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE production_orders SET status = 'completed', actualCompletedAt = NOW() WHERE id = ? AND status IN ('planned', 'in_progress')",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Production order cannot be completed" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM production_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error completing production order:", error);
        res.status(500).json({ message: "Error completing production order", error: error.message });
    }
});

router.patch("/:id/cancel", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE production_orders SET status = 'cancelled' WHERE id = ? AND status NOT IN ('completed', 'cancelled')",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Production order cannot be cancelled" });
        }
        const [updatedOrder] = await pool.query("SELECT * FROM production_orders WHERE id = ?", [req.params.id]);
        res.json(updatedOrder[0]);
    } catch (error) {
        console.error("Error cancelling production order:", error);
        res.status(500).json({ message: "Error cancelling production order", error: error.message });
    }
});

router.get("/:id/consumptions", async (req, res) => {
    try {
        const [consumptions] = await pool.query(
            `SELECT pc.*, rm.name AS rawMaterialName, rm.sku, rb.batchNumber, u.symbol AS unitSymbol, sl.name AS locationName
             FROM production_consumptions pc
             LEFT JOIN raw_materials rm ON pc.rawMaterialId = rm.id
             LEFT JOIN raw_material_batches rb ON pc.batchId = rb.id
             LEFT JOIN inventory_units u ON pc.unitId = u.id
             LEFT JOIN stock_locations sl ON pc.locationId = sl.id
             WHERE pc.productionOrderId = ?`,
            [req.params.id]
        );
        res.json(consumptions);
    } catch (error) {
        console.error("Error fetching production consumptions:", error);
        res.status(500).json({ message: "Error fetching production consumptions", error: error.message });
    }
});

router.post("/:id/consumptions", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { rawMaterialId, batchId, locationId, consumptionMode, plannedQuantity, consumedQuantity, unitId, consumedBy, remarks } = req.body;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO production_consumptions (productionOrderId, rawMaterialId, batchId, locationId, consumptionMode, plannedQuantity, consumedQuantity, unitId, consumedBy, remarks)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, rawMaterialId, batchId || null, locationId, consumptionMode || 'manual',
             plannedQuantity !== undefined ? plannedQuantity : null, consumedQuantity, unitId, consumedBy || null, remarks || null]
        );
        const [stockRows] = await connection.query(
            "SELECT * FROM raw_material_stock WHERE rawMaterialId = ? AND batchId <=> ? AND locationId = ?",
            [rawMaterialId, batchId || null, locationId]
        );
        if (stockRows.length > 0) {
            await connection.query(
                "UPDATE raw_material_stock SET quantity = GREATEST(quantity - ?, 0) WHERE id = ?",
                [consumedQuantity, stockRows[0].id]
            );
        }
        await connection.query(
            `INSERT INTO raw_material_stock_ledger (rawMaterialId, batchId, locationId, transactionType, referenceType, referenceId, quantityOut, remarks, createdBy)
             VALUES (?, ?, ?, 'production_consumption', 'production_order', ?, ?, ?, ?)`,
            [rawMaterialId, batchId || null, locationId, req.params.id, consumedQuantity, remarks || 'Consumed in production', req.user.id]
        );
        await connection.commit();
        const [newConsumption] = await pool.query("SELECT * FROM production_consumptions WHERE id = ?", [result.insertId]);
        res.status(201).json(newConsumption[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error recording consumption:", error);
        res.status(500).json({ message: "Error recording consumption", error: error.message });
    } finally {
        connection.release();
    }
});

router.get("/:id/wastage", async (req, res) => {
    try {
        const [wastage] = await pool.query(
            `SELECT pw.*, rm.name AS rawMaterialName, u.symbol AS unitSymbol
             FROM production_wastage pw
             LEFT JOIN raw_materials rm ON pw.rawMaterialId = rm.id
             LEFT JOIN inventory_units u ON pw.unitId = u.id
             WHERE pw.productionOrderId = ?`,
            [req.params.id]
        );
        res.json(wastage);
    } catch (error) {
        console.error("Error fetching production wastage:", error);
        res.status(500).json({ message: "Error fetching production wastage", error: error.message });
    }
});

router.post("/:id/wastage", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { rawMaterialId, wastageType, quantity, unitId, description, recordedBy } = req.body;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO production_wastage (productionOrderId, rawMaterialId, wastageType, quantity, unitId, description, recordedBy)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, rawMaterialId || null, wastageType, quantity, unitId, description || null, recordedBy || null]
        );
        if (rawMaterialId) {
            const [stockRows] = await connection.query(
                "UPDATE raw_material_stock SET quantity = GREATEST(quantity - ?, 0) WHERE rawMaterialId = ? ORDER BY id LIMIT 1",
                [quantity, rawMaterialId]
            );
            if (stockRows.affectedRows > 0) {
                await connection.query(
                    `INSERT INTO raw_material_stock_ledger (rawMaterialId, locationId, transactionType, referenceType, referenceId, quantityOut, remarks, createdBy)
                     SELECT rawMaterialId, locationId, 'loss', 'production_order', ?, ?, ?, ? FROM raw_material_stock WHERE rawMaterialId = ? ORDER BY id DESC LIMIT 1`,
                    [req.params.id, quantity, `Production wastage (${wastageType})`, req.user.id, rawMaterialId]
                );
            }
        }
        await connection.commit();
        const [newWastage] = await pool.query("SELECT * FROM production_wastage WHERE id = ?", [result.insertId]);
        res.status(201).json(newWastage[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error recording wastage:", error);
        res.status(500).json({ message: "Error recording wastage", error: error.message });
    } finally {
        connection.release();
    }
});

router.get("/:id/outputs", async (req, res) => {
    try {
        const [outputs] = await pool.query(
            `SELECT o.*, fp.name AS finishedProductName, fp.sku, fb.batchNumber, u.symbol AS unitSymbol, sl.name AS locationName
             FROM production_outputs o
             LEFT JOIN finished_products fp ON o.finishedProductId = fp.id
             LEFT JOIN finished_product_batches fb ON o.batchId = fb.id
             LEFT JOIN inventory_units u ON o.unitId = u.id
             LEFT JOIN stock_locations sl ON o.locationId = sl.id
             WHERE o.productionOrderId = ?`,
            [req.params.id]
        );
        res.json(outputs);
    } catch (error) {
        console.error("Error fetching production outputs:", error);
        res.status(500).json({ message: "Error fetching production outputs", error: error.message });
    }
});

router.post("/:id/outputs", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { finishedProductId, batchId, batchNumber, outputQuantity, unitId, locationId, manufacturingDate, manualCost } = req.body;
        await connection.beginTransaction();
        let resolvedBatchId = batchId || null;
        let resolvedBatchNumber = null;
        if (resolvedBatchId) {
            const [batches] = await connection.query("SELECT batchNumber FROM finished_product_batches WHERE id = ?", [resolvedBatchId]);
            resolvedBatchNumber = batches[0] ? batches[0].batchNumber : null;
        } else if (batchNumber) {
            resolvedBatchNumber = batchNumber;
            const [batchResult] = await connection.query(
                `INSERT INTO finished_product_batches (finishedProductId, batchNumber, productionOrderId, manufacturingDate, originalQuantity, currentQuantity, unitId, manualCost)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [finishedProductId, batchNumber, req.params.id, manufacturingDate, outputQuantity, outputQuantity, unitId, manualCost || null]
            );
            resolvedBatchId = batchResult.insertId;
        }
        const [outputResult] = await connection.query(
            `INSERT INTO production_outputs (productionOrderId, finishedProductId, batchId, outputQuantity, unitId, locationId, manufacturingDate)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.params.id, finishedProductId, resolvedBatchId, outputQuantity, unitId, locationId, manufacturingDate]
        );
        const [existingStock] = await connection.query(
            "SELECT * FROM finished_product_stock WHERE finishedProductId = ? AND batchId <=> ? AND locationId = ?",
            [finishedProductId, resolvedBatchId, locationId]
        );
        if (existingStock.length > 0) {
            await connection.query(
                "UPDATE finished_product_stock SET quantity = quantity + ?, unitId = ? WHERE id = ?",
                [outputQuantity, unitId, existingStock[0].id]
            );
        } else {
            await connection.query(
                "INSERT INTO finished_product_stock (finishedProductId, batchId, locationId, quantity, unitId) VALUES (?, ?, ?, ?, ?)",
                [finishedProductId, resolvedBatchId, locationId, outputQuantity, unitId]
            );
        }
        await addFinishedLedger(connection, {
            finishedProductId,
            batchId: resolvedBatchId,
            locationId,
            transactionType: 'production_output',
            referenceType: 'production_order',
            referenceId: req.params.id,
            quantityIn: outputQuantity,
            unitCost: manualCost || null,
            remarks: `Production output batch ${resolvedBatchNumber || ''}`.trim(),
            createdBy: req.user.id
        });
        await connection.commit();
        const [newOutput] = await pool.query("SELECT * FROM production_outputs WHERE id = ?", [outputResult.insertId]);
        res.status(201).json(newOutput[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error recording production output:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Batch number already exists" });
        }
        res.status(500).json({ message: "Error recording production output", error: error.message });
    } finally {
        connection.release();
    }
});

export default router;