import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";
import {
    generateDocumentNumber,
    httpError,
    sendError,
    toNullable,
    today,
} from "../utils/purchasing.js";

const router = express.Router();

router.use(authMiddleware);

const DETAIL_QUERY = `
    SELECT gr.*,
           po.poNumber,
           s.companyName AS supplierName,
           receiver.email AS receivedByEmail
    FROM goods_receipts gr
    LEFT JOIN purchase_orders po ON gr.purchaseOrderId = po.id
    LEFT JOIN suppliers s ON gr.supplierId = s.id
    LEFT JOIN users receiver ON gr.receivedBy = receiver.id
`;

const ITEM_QUERY = `
    SELECT gri.*, rm.name AS rawMaterialName, rm.sku,
           u.name AS unitName, u.symbol AS unitSymbol
    FROM goods_receipt_items gri
    LEFT JOIN raw_materials rm ON gri.rawMaterialId = rm.id
    LEFT JOIN inventory_units u ON gri.unitId = u.id
`;

async function updatePurchaseOrderReceiptStatus(db, purchaseOrderId) {
    const [rows] = await db.query(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN receivedQuantity >= orderedQuantity THEN 1 ELSE 0 END) AS fullyReceived
         FROM purchase_order_items
         WHERE purchaseOrderId = ?`,
        [purchaseOrderId]
    );
    const status = Number(rows[0].total) > 0 &&
        Number(rows[0].fullyReceived) >= Number(rows[0].total)
        ? "received"
        : "partially_received";
    await db.query("UPDATE purchase_orders SET status = ? WHERE id = ?", [
        status,
        purchaseOrderId,
    ]);
}

async function getPurchaseOrderItem(db, purchaseOrderItemId) {
    const [rows] = await db.query(
        `SELECT poi.*, po.supplierId, po.status AS orderStatus
         FROM purchase_order_items poi
         JOIN purchase_orders po ON poi.purchaseOrderId = po.id
         WHERE poi.id = ?`,
        [purchaseOrderItemId]
    );
    if (rows.length === 0) {
        throw httpError(404, "Purchase order item not found");
    }
    return rows[0];
}

async function insertReceiptItem(db, goodsReceiptId, item) {
    const poItem = await getPurchaseOrderItem(db, item.purchaseOrderItemId);

    if (!item.batchNumber) {
        throw httpError(400, "batchNumber is required for every receipt item");
    }
    if (item.receivedQuantity === undefined || item.receivedQuantity === null) {
        throw httpError(400, "receivedQuantity is required for every receipt item");
    }
    if (item.purchasePrice === undefined || item.purchasePrice === null) {
        throw httpError(400, "purchasePrice is required for every receipt item");
    }

    const remaining = Number(poItem.orderedQuantity) - Number(poItem.receivedQuantity);
    if (Number(item.receivedQuantity) <= 0) {
        throw httpError(400, "receivedQuantity must be greater than zero");
    }
    if (Number(item.receivedQuantity) > remaining) {
        throw httpError(
            400,
            `receivedQuantity exceeds the remaining quantity for this order item (${remaining})`
        );
    }

    const rawMaterialId = item.rawMaterialId || poItem.rawMaterialId;
    const unitId = item.unitId || poItem.unitId;

    const [insertResult] = await db.query(
        `INSERT INTO goods_receipt_items
            (goodsReceiptId, purchaseOrderItemId, rawMaterialId, batchNumber,
             receivedQuantity, unitId, purchasePrice)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            goodsReceiptId,
            item.purchaseOrderItemId,
            rawMaterialId,
            item.batchNumber,
            item.receivedQuantity,
            unitId,
            item.purchasePrice,
        ]
    );

    await db.query(
        "UPDATE purchase_order_items SET receivedQuantity = receivedQuantity + ? WHERE id = ?",
        [item.receivedQuantity, item.purchaseOrderItemId]
    );

    return {
        insertId: insertResult.insertId,
        purchaseOrderId: poItem.purchaseOrderId,
    };
}

router.get("/", async (req, res) => {
    try {
        const { status, purchaseOrderId, supplierId } = req.query;
        let query = `${DETAIL_QUERY} WHERE 1 = 1`;
        const params = [];
        if (status) { query += " AND gr.status = ?"; params.push(status); }
        if (purchaseOrderId) { query += " AND gr.purchaseOrderId = ?"; params.push(purchaseOrderId); }
        if (supplierId) { query += " AND gr.supplierId = ?"; params.push(supplierId); }
        query += " ORDER BY gr.receivedDate DESC, gr.id DESC";
        const [receipts] = await pool.query(query, params);
        res.json(receipts);
    } catch (error) {
        sendError(res, "fetching goods receipts", error);
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [receipts] = await pool.query(`${DETAIL_QUERY} WHERE gr.id = ?`, [req.params.id]);
        if (receipts.length === 0) {
            return res.status(404).json({ message: "Goods receipt not found" });
        }
        const [items] = await pool.query(
            `${ITEM_QUERY} WHERE gri.goodsReceiptId = ? ORDER BY gri.id`,
            [req.params.id]
        );
        receipts[0].items = items;
        res.json(receipts[0]);
    } catch (error) {
        sendError(res, "fetching goods receipt", error);
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            purchaseOrderId, supplierId, receivedDate, receivedBy, remarks, items,
        } = req.body;
        if (!purchaseOrderId) {
            throw httpError(400, "purchaseOrderId is required");
        }
        if (!Array.isArray(items) || items.length === 0) {
            throw httpError(400, "At least one receipt item is required");
        }

        await connection.beginTransaction();

        const [orders] = await connection.query(
            `SELECT id, supplierId, status FROM purchase_orders
             WHERE id = ? AND deletedAt IS NULL`,
            [purchaseOrderId]
        );
        if (orders.length === 0) {
            throw httpError(404, "Purchase order not found");
        }
        if (!["approved", "partially_received"].includes(orders[0].status)) {
            throw httpError(400, "Only approved purchase orders can be received");
        }

        const grnNumber = await generateDocumentNumber(connection, {
            table: "goods_receipts",
            column: "grnNumber",
            prefix: "GRN-",
        });

        const [result] = await connection.query(
            `INSERT INTO goods_receipts
                (grnNumber, purchaseOrderId, supplierId, receivedDate, receivedBy, remarks)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                grnNumber,
                purchaseOrderId,
                supplierId || orders[0].supplierId,
                receivedDate || today(),
                receivedBy || req.user.id,
                toNullable(remarks),
            ]
        );

        for (const item of items) {
            await insertReceiptItem(connection, result.insertId, item);
        }

        await updatePurchaseOrderReceiptStatus(connection, purchaseOrderId);
        await connection.commit();

        const [created] = await pool.query(`${DETAIL_QUERY} WHERE gr.id = ?`, [result.insertId]);
        const [createdItems] = await pool.query(
            `${ITEM_QUERY} WHERE gri.goodsReceiptId = ? ORDER BY gri.id`,
            [result.insertId]
        );
        created[0].items = createdItems;
        res.status(201).json(created[0]);
    } catch (error) {
        await connection.rollback();
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "GRN number already exists" });
        }
        sendError(res, "creating goods receipt", error);
    } finally {
        connection.release();
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            `${ITEM_QUERY} WHERE gri.goodsReceiptId = ? ORDER BY gri.id`,
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        sendError(res, "fetching goods receipt items", error);
    }
});

router.post("/:id/items", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const [receipts] = await connection.query(
            "SELECT id, purchaseOrderId, status FROM goods_receipts WHERE id = ?",
            [req.params.id]
        );
        if (receipts.length === 0) {
            throw httpError(404, "Goods receipt not found");
        }
        if (!["received", "partially_qc"].includes(receipts[0].status)) {
            throw httpError(400, "Items cannot be added to this goods receipt");
        }

        await connection.beginTransaction();
        const receiptInfo = await insertReceiptItem(connection, req.params.id, req.body);
        await updatePurchaseOrderReceiptStatus(connection, receiptInfo.purchaseOrderId);
        await connection.commit();

        const [created] = await pool.query(
            `${ITEM_QUERY} WHERE gri.id = ?`,
            [receiptInfo.insertId]
        );
        res.status(201).json(created[0] || { message: "Goods receipt item added successfully" });
    } catch (error) {
        await connection.rollback();
        sendError(res, "adding goods receipt item", error);
    } finally {
        connection.release();
    }
});

router.patch("/:id/cancel", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE goods_receipts SET status = 'cancelled' WHERE id = ? AND status NOT IN ('qc_completed', 'cancelled')",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Goods receipt cannot be cancelled");
        }
        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE gr.id = ?`, [req.params.id]);
        res.json(updated[0]);
    } catch (error) {
        sendError(res, "cancelling goods receipt", error);
    }
});

export default router;
