import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";
import {
    addFinishedLedger,
    httpError,
    sendError,
    toNullable,
} from "../utils/production.js";

const router = express.Router();

router.use(authMiddleware);

const STOCK_QUERY = `
    SELECT fs.*, fp.name AS finishedProductName, fp.sku,
           fb.batchNumber, fb.manufacturingDate, fb.manualCost,
           u.name AS unitName, u.symbol AS unitSymbol
    FROM finished_product_stock fs
    JOIN finished_products fp ON fs.finishedProductId = fp.id
    JOIN finished_product_batches fb ON fs.batchId = fb.id
    LEFT JOIN inventory_units u ON fs.unitId = u.id
`;

const LEDGER_QUERY = `
    SELECT fl.*, fp.name AS finishedProductName, fp.sku,
           fb.batchNumber, u.symbol AS unitSymbol, usr.email AS createdByEmail
    FROM finished_product_stock_ledger fl
    JOIN finished_products fp ON fl.finishedProductId = fp.id
    JOIN finished_product_batches fb ON fl.batchId = fb.id
    LEFT JOIN inventory_units u ON fb.unitId = u.id
    LEFT JOIN users usr ON fl.createdBy = usr.id
`;

router.get("/", async (req, res) => {
    try {
        const { finishedProductId, batchId, search } = req.query;
        let query = `${STOCK_QUERY} WHERE 1 = 1`;
        const params = [];
        if (finishedProductId) { query += " AND fs.finishedProductId = ?"; params.push(finishedProductId); }
        if (batchId) { query += " AND fs.batchId = ?"; params.push(batchId); }
        if (search) {
            query += " AND (fp.name LIKE ? OR fp.sku LIKE ? OR fb.batchNumber LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        query += " ORDER BY fp.name, fb.manufacturingDate DESC";
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        sendError(res, "fetching finished goods stock", error);
    }
});

router.get("/summary", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT fp.id AS finishedProductId, fp.name, fp.sku,
                    fp.minimumStockLevel, u.symbol AS unitSymbol,
                    COALESCE(SUM(fs.quantity), 0) AS quantity,
                    COUNT(DISTINCT fs.batchId) AS batchCount
             FROM finished_products fp
             LEFT JOIN finished_product_stock fs ON fp.id = fs.finishedProductId
             LEFT JOIN inventory_units u ON fp.unitId = u.id
             WHERE fp.deletedAt IS NULL AND fp.isActive = 1
             GROUP BY fp.id, fp.name, fp.sku, fp.minimumStockLevel, u.symbol
             ORDER BY fp.name`
        );
        res.json(rows);
    } catch (error) {
        sendError(res, "fetching finished goods stock summary", error);
    }
});

router.get("/low-stock", async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT fp.id AS finishedProductId, fp.name, fp.sku,
                    fp.minimumStockLevel, u.symbol AS unitSymbol,
                    COALESCE(SUM(fs.quantity), 0) AS quantity
             FROM finished_products fp
             LEFT JOIN finished_product_stock fs ON fp.id = fs.finishedProductId
             LEFT JOIN inventory_units u ON fp.unitId = u.id
             WHERE fp.deletedAt IS NULL AND fp.isActive = 1 AND fp.minimumStockLevel > 0
             GROUP BY fp.id, fp.name, fp.sku, fp.minimumStockLevel, u.symbol
             HAVING quantity < fp.minimumStockLevel
             ORDER BY quantity ASC`
        );
        res.json(rows);
    } catch (error) {
        sendError(res, "fetching low finished goods stock", error);
    }
});

router.get("/batches", async (req, res) => {
    try {
        const { finishedProductId, search } = req.query;
        let query = `
            SELECT fb.*, fp.name AS finishedProductName, fp.sku,
                   u.name AS unitName, u.symbol AS unitSymbol,
                   po.productionNumber
            FROM finished_product_batches fb
            JOIN finished_products fp ON fb.finishedProductId = fp.id
            LEFT JOIN inventory_units u ON fb.unitId = u.id
            LEFT JOIN production_orders po ON fb.productionOrderId = po.id
            WHERE 1 = 1`;
        const params = [];
        if (finishedProductId) { query += " AND fb.finishedProductId = ?"; params.push(finishedProductId); }
        if (search) {
            query += " AND (fb.batchNumber LIKE ? OR fp.name LIKE ?)";
            params.push(`%${search}%`, `%${search}%`);
        }
        query += " ORDER BY fb.manufacturingDate DESC, fb.id DESC";
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        sendError(res, "fetching finished product batches", error);
    }
});

router.get("/ledger", async (req, res) => {
    try {
        const {
            finishedProductId, batchId, transactionType, fromDate, toDate,
        } = req.query;
        let query = `${LEDGER_QUERY} WHERE 1 = 1`;
        const params = [];
        if (finishedProductId) { query += " AND fl.finishedProductId = ?"; params.push(finishedProductId); }
        if (batchId) { query += " AND fl.batchId = ?"; params.push(batchId); }
        if (transactionType) { query += " AND fl.transactionType = ?"; params.push(transactionType); }
        if (fromDate) { query += " AND fl.transactionAt >= ?"; params.push(`${fromDate} 00:00:00`); }
        if (toDate) { query += " AND fl.transactionAt <= ?"; params.push(`${toDate} 23:59:59`); }
        query += " ORDER BY fl.transactionAt DESC, fl.id DESC";
        const [rows] = await pool.query(query, params);
        res.json(rows);
    } catch (error) {
        sendError(res, "fetching finished goods ledger", error);
    }
});

// Adds a signed delta to finished stock and logs an adjustment.
router.post("/stock", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { finishedProductId, batchId, quantity, remarks } = req.body;
        if (!finishedProductId || !batchId || quantity === undefined || quantity === "") {
            throw httpError(400, "finishedProductId, batchId and quantity are required");
        }
        const delta = Number(quantity);
        if (!Number.isFinite(delta) || delta === 0) {
            throw httpError(400, "quantity must be a non-zero number");
        }

        await connection.beginTransaction();

        const [batches] = await connection.query(
            "SELECT id, unitId, batchNumber FROM finished_product_batches WHERE id = ? AND finishedProductId = ?",
            [batchId, finishedProductId]
        );
        if (batches.length === 0) {
            throw httpError(404, "Finished batch not found for this product");
        }

        const [existing] = await connection.query(
            "SELECT id, quantity FROM finished_product_stock WHERE finishedProductId = ? AND batchId = ?",
            [finishedProductId, batchId]
        );
        if (existing.length === 0 && delta < 0) {
            throw httpError(400, "Cannot reduce stock that does not exist");
        }

        let stockId;
        if (existing.length > 0) {
            stockId = existing[0].id;
            const nextQuantity = Number(existing[0].quantity) + delta;
            if (nextQuantity < 0) {
                throw httpError(400, "Adjustment would make stock negative");
            }
            await connection.query(
                "UPDATE finished_product_stock SET quantity = ?, unitId = ? WHERE id = ?",
                [nextQuantity, batches[0].unitId, stockId]
            );
        } else {
            const [result] = await connection.query(
                `INSERT INTO finished_product_stock (finishedProductId, batchId, quantity, unitId)
                 VALUES (?, ?, ?, ?)`,
                [finishedProductId, batchId, delta, batches[0].unitId]
            );
            stockId = result.insertId;
        }

        await connection.query(
            "UPDATE finished_product_batches SET currentQuantity = currentQuantity + ? WHERE id = ?",
            [delta, batchId]
        );
        await addFinishedLedger(connection, {
            finishedProductId,
            batchId,
            transactionType: "adjustment",
            referenceType: "manual_adjustment",
            referenceId: stockId,
            quantityIn: delta > 0 ? delta : 0,
            quantityOut: delta < 0 ? Math.abs(delta) : 0,
            remarks: toNullable(remarks || `Manual adjustment for batch ${batches[0].batchNumber}`),
            createdBy: req.user.id,
        });

        await connection.commit();
        const [rows] = await pool.query(`${STOCK_QUERY} WHERE fs.id = ?`, [stockId]);
        res.status(201).json(rows[0]);
    } catch (error) {
        await connection.rollback();
        sendError(res, "adjusting finished goods stock", error);
    } finally {
        connection.release();
    }
});

router.put("/stock/:id", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { quantity, remarks } = req.body;
        if (quantity === undefined || quantity === "") {
            throw httpError(400, "quantity is required");
        }
        const target = Number(quantity);
        if (!Number.isFinite(target) || target < 0) {
            throw httpError(400, "quantity must be zero or greater");
        }

        await connection.beginTransaction();
        const [existing] = await connection.query(
            "SELECT * FROM finished_product_stock WHERE id = ?",
            [req.params.id]
        );
        if (existing.length === 0) {
            throw httpError(404, "Finished stock row not found");
        }
        const current = Number(existing[0].quantity);
        const delta = target - current;
        if (delta === 0) {
            await connection.commit();
            const [rows] = await pool.query(`${STOCK_QUERY} WHERE fs.id = ?`, [req.params.id]);
            return res.json(rows[0]);
        }

        const [batches] = await connection.query(
            "SELECT batchNumber FROM finished_product_batches WHERE id = ?",
            [existing[0].batchId]
        );

        await connection.query(
            "UPDATE finished_product_stock SET quantity = ? WHERE id = ?",
            [target, req.params.id]
        );
        await connection.query(
            "UPDATE finished_product_batches SET currentQuantity = currentQuantity + ? WHERE id = ?",
            [delta, existing[0].batchId]
        );
        await addFinishedLedger(connection, {
            finishedProductId: existing[0].finishedProductId,
            batchId: existing[0].batchId,
            transactionType: "adjustment",
            referenceType: "manual_adjustment",
            referenceId: existing[0].id,
            quantityIn: delta > 0 ? delta : 0,
            quantityOut: delta < 0 ? Math.abs(delta) : 0,
            remarks: toNullable(remarks || `Stock set to ${target} for batch ${batches[0]?.batchNumber || existing[0].batchId}`),
            createdBy: req.user.id,
        });

        await connection.commit();
        const [rows] = await pool.query(`${STOCK_QUERY} WHERE fs.id = ?`, [req.params.id]);
        res.json(rows[0]);
    } catch (error) {
        await connection.rollback();
        sendError(res, "updating finished goods stock", error);
    } finally {
        connection.release();
    }
});

export default router;
