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
    SELECT pr.*,
           d.name AS departmentName,
           requester.email AS requestedByEmail,
           manager.email AS managerApprovedByEmail
    FROM purchase_requests pr
    LEFT JOIN departments d ON pr.departmentId = d.id
    LEFT JOIN users requester ON pr.requestedBy = requester.id
    LEFT JOIN users manager ON pr.managerApprovedBy = manager.id
`;

const ITEM_QUERY = `
    SELECT pri.*, rm.name AS rawMaterialName, rm.sku, u.name AS unitName, u.symbol AS unitSymbol
    FROM purchase_request_items pri
    LEFT JOIN raw_materials rm ON pri.rawMaterialId = rm.id
    LEFT JOIN inventory_units u ON pri.unitId = u.id
`;

async function insertItems(db, requestId, items) {
    if (!Array.isArray(items)) return;
    for (const item of items) {
        await db.query(
            `INSERT INTO purchase_request_items
                (purchaseRequestId, rawMaterialId, quantity, unitId, remarks)
             VALUES (?, ?, ?, ?, ?)`,
            [
                requestId,
                item.rawMaterialId,
                item.quantity,
                item.unitId,
                toNullable(item.remarks),
            ]
        );
    }
}

router.get("/", async (req, res) => {
    try {
        const { status, departmentId, requestedBy } = req.query;
        let query = `${DETAIL_QUERY} WHERE pr.deletedAt IS NULL`;
        const params = [];
        if (status) { query += " AND pr.status = ?"; params.push(status); }
        if (departmentId) { query += " AND pr.departmentId = ?"; params.push(departmentId); }
        if (requestedBy) { query += " AND pr.requestedBy = ?"; params.push(requestedBy); }
        query += " ORDER BY pr.requestDate DESC, pr.id DESC";
        const [requests] = await pool.query(query, params);
        res.json(requests);
    } catch (error) {
        sendError(res, "fetching purchase requests", error);
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [requests] = await pool.query(
            `${DETAIL_QUERY} WHERE pr.id = ? AND pr.deletedAt IS NULL`,
            [req.params.id]
        );
        if (requests.length === 0) {
            return res.status(404).json({ message: "Purchase request not found" });
        }
        const [items] = await pool.query(
            `${ITEM_QUERY} WHERE pri.purchaseRequestId = ? ORDER BY pri.id`,
            [req.params.id]
        );
        requests[0].items = items;
        res.json(requests[0]);
    } catch (error) {
        sendError(res, "fetching purchase request", error);
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            departmentId, requestedBy, requestDate, requiredDate, purpose, items,
        } = req.body;

        await connection.beginTransaction();

        const requestNumber = await generateDocumentNumber(connection, {
            table: "purchase_requests",
            column: "requestNumber",
            prefix: "PR-",
        });

        const [result] = await connection.query(
            `INSERT INTO purchase_requests
                (requestNumber, departmentId, requestedBy, requestDate, requiredDate, purpose)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                requestNumber,
                toNullable(departmentId),
                requestedBy || req.user.id,
                requestDate || today(),
                toNullable(requiredDate),
                toNullable(purpose),
            ]
        );

        await insertItems(connection, result.insertId, items);
        await connection.commit();

        const [created] = await pool.query(
            `${DETAIL_QUERY} WHERE pr.id = ?`,
            [result.insertId]
        );
        const [createdItems] = await pool.query(
            `${ITEM_QUERY} WHERE pri.purchaseRequestId = ? ORDER BY pri.id`,
            [result.insertId]
        );
        created[0].items = createdItems;
        res.status(201).json(created[0]);
    } catch (error) {
        await connection.rollback();
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Purchase request number already exists" });
        }
        sendError(res, "creating purchase request", error);
    } finally {
        connection.release();
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { departmentId, requestDate, requiredDate, purpose } = req.body;
        const [result] = await pool.query(
            `UPDATE purchase_requests
             SET departmentId = ?, requestDate = ?, requiredDate = ?, purpose = ?
             WHERE id = ? AND deletedAt IS NULL AND status = 'draft'`,
            [
                toNullable(departmentId),
                requestDate,
                toNullable(requiredDate),
                toNullable(purpose),
                req.params.id,
            ]
        );
        if (result.affectedRows === 0) {
            throw httpError(404, "Purchase request not found or no longer editable");
        }
        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE pr.id = ?`, [req.params.id]);
        res.json(updated[0]);
    } catch (error) {
        sendError(res, "updating purchase request", error);
    }
});

router.patch("/:id/submit", async (req, res) => {
    try {
        const [result] = await pool.query(
            `UPDATE purchase_requests SET status = 'pending_manager'
             WHERE id = ? AND status = 'draft' AND deletedAt IS NULL`,
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Purchase request cannot be submitted");
        }
        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE pr.id = ?`, [req.params.id]);
        res.json(updated[0]);
    } catch (error) {
        sendError(res, "submitting purchase request", error);
    }
});

router.patch("/:id/approve", async (req, res) => {
    try {
        const [result] = await pool.query(
            `UPDATE purchase_requests
             SET status = 'manager_approved',
                 managerApprovedBy = ?,
                 managerApprovedAt = NOW(),
                 managerRemarks = ?
             WHERE id = ? AND status = 'pending_manager' AND deletedAt IS NULL`,
            [
                req.body.managerApprovedBy || req.user.id,
                toNullable(req.body.managerRemarks),
                req.params.id,
            ]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Purchase request cannot be approved");
        }
        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE pr.id = ?`, [req.params.id]);
        res.json(updated[0]);
    } catch (error) {
        sendError(res, "approving purchase request", error);
    }
});

router.patch("/:id/reject", async (req, res) => {
    try {
        const [result] = await pool.query(
            `UPDATE purchase_requests
             SET status = 'rejected',
                 managerApprovedBy = ?,
                 managerApprovedAt = NOW(),
                 managerRemarks = ?
             WHERE id = ? AND status = 'pending_manager' AND deletedAt IS NULL`,
            [
                req.body.managerApprovedBy || req.user.id,
                toNullable(req.body.managerRemarks),
                req.params.id,
            ]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Purchase request cannot be rejected");
        }
        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE pr.id = ?`, [req.params.id]);
        res.json(updated[0]);
    } catch (error) {
        sendError(res, "rejecting purchase request", error);
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            `UPDATE purchase_requests SET deletedAt = NOW()
             WHERE id = ? AND deletedAt IS NULL AND status IN ('draft', 'pending_manager')`,
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(400, "Purchase request not found or cannot be deleted");
        }
        res.json({ message: "Purchase request deleted successfully" });
    } catch (error) {
        sendError(res, "deleting purchase request", error);
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            `${ITEM_QUERY} WHERE pri.purchaseRequestId = ? ORDER BY pri.id`,
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        sendError(res, "fetching purchase request items", error);
    }
});

router.post("/:id/items", async (req, res) => {
    try {
        const { rawMaterialId, quantity, unitId, remarks } = req.body;
        if (!rawMaterialId || !quantity || !unitId) {
            throw httpError(400, "rawMaterialId, quantity and unitId are required");
        }
        const [request] = await pool.query(
            "SELECT id FROM purchase_requests WHERE id = ? AND deletedAt IS NULL AND status = 'draft'",
            [req.params.id]
        );
        if (request.length === 0) {
            throw httpError(400, "Items can only be added to a draft purchase request");
        }
        const [result] = await pool.query(
            `INSERT INTO purchase_request_items
                (purchaseRequestId, rawMaterialId, quantity, unitId, remarks)
             VALUES (?, ?, ?, ?, ?)`,
            [req.params.id, rawMaterialId, quantity, unitId, toNullable(remarks)]
        );
        const [created] = await pool.query(
            `${ITEM_QUERY} WHERE pri.id = ?`,
            [result.insertId]
        );
        res.status(201).json(created[0]);
    } catch (error) {
        sendError(res, "adding purchase request item", error);
    }
});

router.put("/:id/items/:itemId", async (req, res) => {
    try {
        const { rawMaterialId, quantity, unitId, remarks } = req.body;
        const [result] = await pool.query(
            `UPDATE purchase_request_items
             SET rawMaterialId = ?, quantity = ?, unitId = ?, remarks = ?
             WHERE id = ? AND purchaseRequestId = ?`,
            [
                rawMaterialId,
                quantity,
                unitId,
                toNullable(remarks),
                req.params.itemId,
                req.params.id,
            ]
        );
        if (result.affectedRows === 0) {
            throw httpError(404, "Purchase request item not found");
        }
        const [updated] = await pool.query(`${ITEM_QUERY} WHERE pri.id = ?`, [req.params.itemId]);
        res.json(updated[0]);
    } catch (error) {
        sendError(res, "updating purchase request item", error);
    }
});

router.delete("/:id/items/:itemId", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM purchase_request_items WHERE id = ? AND purchaseRequestId = ?",
            [req.params.itemId, req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(404, "Purchase request item not found");
        }
        res.json({ message: "Purchase request item deleted successfully" });
    } catch (error) {
        sendError(res, "deleting purchase request item", error);
    }
});

export default router;
