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
    SELECT po.*,
           s.companyName AS supplierName,
           s.supplierCode,
           pr.requestNumber,
           creator.email AS createdByEmail,
           admin.email AS adminApprovedByEmail
    FROM purchase_orders po
    LEFT JOIN suppliers s ON po.supplierId = s.id
    LEFT JOIN purchase_requests pr ON po.purchaseRequestId = pr.id
    LEFT JOIN users creator ON po.createdBy = creator.id
    LEFT JOIN users admin ON po.adminApprovedBy = admin.id
`;

const ITEM_QUERY = `
    SELECT poi.*, rm.name AS rawMaterialName, rm.sku,
           u.name AS unitName, u.symbol AS unitSymbol
    FROM purchase_order_items poi
    LEFT JOIN raw_materials rm ON poi.rawMaterialId = rm.id
    LEFT JOIN inventory_units u ON poi.unitId = u.id
`;

async function recalculateTotal(db, orderId) {
    const [rows] = await db.query(
        "SELECT COALESCE(SUM(totalAmount), 0) AS total FROM purchase_order_items WHERE purchaseOrderId = ?",
        [orderId]
    );
    await db.query("UPDATE purchase_orders SET totalAmount = ? WHERE id = ?", [
        rows[0].total || 0,
        orderId,
    ]);
}

function itemTotal(item) {
    return Number(item.unitPrice) * Number(item.orderedQuantity);
}

async function insertItems(db, orderId, items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
        await db.query(
            `INSERT INTO purchase_order_items
                (purchaseOrderId, rawMaterialId, orderedQuantity, unitId, unitPrice, totalAmount)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                orderId,
                item.rawMaterialId,
                item.orderedQuantity,
                item.unitId,
                item.unitPrice,
                itemTotal(item),
            ]
        );
    }
}

router.get("/", async (req, res) => {
    try {
        const { status, supplierId, purchaseRequestId } = req.query;
        let query = `${DETAIL_QUERY} WHERE po.deletedAt IS NULL`;
        const params = [];
        if (status) { query += " AND po.status = ?"; params.push(status); }
        if (supplierId) { query += " AND po.supplierId = ?"; params.push(supplierId); }
        if (purchaseRequestId) { query += " AND po.purchaseRequestId = ?"; params.push(purchaseRequestId); }
        query += " ORDER BY po.orderDate DESC, po.id DESC";
        const [orders] = await pool.query(query, params);
        res.json(orders);
    } catch (error) {
        sendError(res, "fetching purchase orders", error);
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [orders] = await pool.query(
            `${DETAIL_QUERY} WHERE po.id = ? AND po.deletedAt IS NULL`,
            [req.params.id]
        );
        if (orders.length === 0) {
            return res.status(404).json({ message: "Purchase order not found" });
        }
        const [items] = await pool.query(
            `${ITEM_QUERY} WHERE poi.purchaseOrderId = ? ORDER BY poi.id`,
            [req.params.id]
        );
        orders[0].items = items;
        res.json(orders[0]);
    } catch (error) {
        sendError(res, "fetching purchase order", error);
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            purchaseRequestId, supplierId, orderDate, expectedDeliveryDate,
            items, createdBy,
        } = req.body;
        if (!supplierId) {
            throw httpError(400, "supplierId is required");
        }

        await connection.beginTransaction();

        const poNumber = await generateDocumentNumber(connection, {
            table: "purchase_orders",
            column: "poNumber",
            prefix: "PO-",
        });

        const [result] = await connection.query(
            `INSERT INTO purchase_orders
                (poNumber, purchaseRequestId, supplierId, orderDate, expectedDeliveryDate, createdBy)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                poNumber,
                toNullable(purchaseRequestId),
                supplierId,
                orderDate || today(),
                toNullable(expectedDeliveryDate),
                createdBy || req.user.id,
            ]
        );

        await insertItems(connection, result.insertId, items);
        await recalculateTotal(connection, result.insertId);

        if (purchaseRequestId) {
            await connection.query(
                `UPDATE purchase_requests SET status = 'converted_to_po'
                 WHERE id = ? AND status = 'manager_approved'`,
                [purchaseRequestId]
            );
        }

        await connection.commit();

        const [created] = await pool.query(`${DETAIL_QUERY} WHERE po.id = ?`, [result.insertId]);
        const [createdItems] = await pool.query(
            `${ITEM_QUERY} WHERE poi.purchaseOrderId = ? ORDER BY poi.id`,
            [result.insertId]
        );
        created[0].items = createdItems;
        res.status(201).json(created[0]);
    } catch (error) {
        await connection.rollback();
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Purchase order number already exists" });
        }
        sendError(res, "creating purchase order", error);
    } finally {
        connection.release();
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { purchaseRequestId, supplierId, orderDate, expectedDeliveryDate } = req.body;
        const [result] = await pool.query(
            `UPDATE purchase_orders
             SET purchaseRequestId = ?, supplierId = ?, orderDate = ?, expectedDeliveryDate = ?
             WHERE id = ? AND deletedAt IS NULL AND status = 'draft'`,
            [
                toNullable(purchaseRequestId),
                supplierId,
                orderDate,
                toNullable(expectedDeliveryDate),
                req.params.id,
            ]
        );
        if (result.affectedRows === 0) {
            throw httpError(404, "Purchase order not found or no longer editable");
        }
        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE po.id = ?`, [req.params.id]);
        res.json(updated[0]);
    } catch (error) {
        sendError(res, "updating purchase order", error);
    }
});

router.patch("/:id/submit", async (req, res) => {
    try {
        const [result] = await pool.query(
            `UPDATE purchase_orders SET status = 'pending_admin'
             WHERE id = ? AND status = 'draft' AND deletedAt IS NULL`,
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Purchase order cannot be submitted");
        }
        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE po.id = ?`, [req.params.id]);
        res.json(updated[0]);
    } catch (error) {
        sendError(res, "submitting purchase order", error);
    }
});

router.patch("/:id/approve", async (req, res) => {
    try {
        const [result] = await pool.query(
            `UPDATE purchase_orders
             SET status = 'approved',
                 adminApprovedBy = ?,
                 adminApprovedAt = NOW(),
                 adminRemarks = ?
             WHERE id = ? AND status = 'pending_admin' AND deletedAt IS NULL`,
            [
                req.body.adminApprovedBy || req.user.id,
                toNullable(req.body.adminRemarks),
                req.params.id,
            ]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Purchase order cannot be approved");
        }
        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE po.id = ?`, [req.params.id]);
        res.json(updated[0]);
    } catch (error) {
        sendError(res, "approving purchase order", error);
    }
});

router.patch("/:id/reject", async (req, res) => {
    try {
        const [result] = await pool.query(
            `UPDATE purchase_orders
             SET status = 'rejected',
                 adminApprovedBy = ?,
                 adminApprovedAt = NOW(),
                 adminRemarks = ?
             WHERE id = ? AND status = 'pending_admin' AND deletedAt IS NULL`,
            [
                req.body.adminApprovedBy || req.user.id,
                toNullable(req.body.adminRemarks),
                req.params.id,
            ]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Purchase order cannot be rejected");
        }
        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE po.id = ?`, [req.params.id]);
        res.json(updated[0]);
    } catch (error) {
        sendError(res, "rejecting purchase order", error);
    }
});

router.patch("/:id/cancel", async (req, res) => {
    try {
        const [result] = await pool.query(
            `UPDATE purchase_orders SET status = 'cancelled'
             WHERE id = ? AND deletedAt IS NULL AND status NOT IN ('received', 'cancelled')`,
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Purchase order cannot be cancelled");
        }
        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE po.id = ?`, [req.params.id]);
        res.json(updated[0]);
    } catch (error) {
        sendError(res, "cancelling purchase order", error);
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE purchase_orders SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL AND status = 'draft'",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Purchase order not found or cannot be deleted");
        }
        res.json({ message: "Purchase order deleted successfully" });
    } catch (error) {
        sendError(res, "deleting purchase order", error);
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            `${ITEM_QUERY} WHERE poi.purchaseOrderId = ? ORDER BY poi.id`,
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        sendError(res, "fetching purchase order items", error);
    }
});

router.post("/:id/items", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { rawMaterialId, orderedQuantity, unitId, unitPrice } = req.body;
        if (!rawMaterialId || !orderedQuantity || !unitId || unitPrice === undefined) {
            throw httpError(400, "rawMaterialId, orderedQuantity, unitId and unitPrice are required");
        }
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO purchase_order_items
                (purchaseOrderId, rawMaterialId, orderedQuantity, unitId, unitPrice, totalAmount)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                req.params.id,
                rawMaterialId,
                orderedQuantity,
                unitId,
                unitPrice,
                itemTotal({ orderedQuantity, unitPrice }),
            ]
        );
        await recalculateTotal(connection, req.params.id);
        await connection.commit();
        const [created] = await pool.query(`${ITEM_QUERY} WHERE poi.id = ?`, [result.insertId]);
        res.status(201).json(created[0]);
    } catch (error) {
        await connection.rollback();
        sendError(res, "adding purchase order item", error);
    } finally {
        connection.release();
    }
});

router.put("/:id/items/:itemId", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { rawMaterialId, orderedQuantity, unitId, unitPrice } = req.body;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `UPDATE purchase_order_items
             SET rawMaterialId = ?, orderedQuantity = ?, unitId = ?, unitPrice = ?, totalAmount = ?
             WHERE id = ? AND purchaseOrderId = ?`,
            [
                rawMaterialId,
                orderedQuantity,
                unitId,
                unitPrice,
                itemTotal({ orderedQuantity, unitPrice }),
                req.params.itemId,
                req.params.id,
            ]
        );
        if (result.affectedRows === 0) {
            throw httpError(404, "Purchase order item not found");
        }
        await recalculateTotal(connection, req.params.id);
        await connection.commit();
        const [updated] = await pool.query(`${ITEM_QUERY} WHERE poi.id = ?`, [req.params.itemId]);
        res.json(updated[0]);
    } catch (error) {
        await connection.rollback();
        sendError(res, "updating purchase order item", error);
    } finally {
        connection.release();
    }
});

router.delete("/:id/items/:itemId", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [result] = await connection.query(
            "DELETE FROM purchase_order_items WHERE id = ? AND purchaseOrderId = ?",
            [req.params.itemId, req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(404, "Purchase order item not found");
        }
        await recalculateTotal(connection, req.params.id);
        await connection.commit();
        res.json({ message: "Purchase order item deleted successfully" });
    } catch (error) {
        await connection.rollback();
        sendError(res, "deleting purchase order item", error);
    } finally {
        connection.release();
    }
});

export default router;
