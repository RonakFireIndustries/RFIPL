import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { status, departmentId, requestedBy } = req.query;
        let query = `SELECT pr.*, d.name AS departmentName, emp.firstName, emp.lastName
                     FROM purchase_requests pr
                     LEFT JOIN departments d ON pr.departmentId = d.id
                     LEFT JOIN employees emp ON pr.requestedBy = emp.id
                     WHERE pr.deletedAt IS NULL`;
        const params = [];
        if (status) { query += " AND pr.status = ?"; params.push(status); }
        if (departmentId) { query += " AND pr.departmentId = ?"; params.push(departmentId); }
        if (requestedBy) { query += " AND pr.requestedBy = ?"; params.push(requestedBy); }
        query += " ORDER BY pr.requestDate DESC";
        const [requests] = await pool.query(query, params);
        res.json(requests);
    } catch (error) {
        console.error("Error fetching purchase requests:", error);
        res.status(500).json({ message: "Error fetching purchase requests", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [requests] = await pool.query(
            `SELECT pr.*, d.name AS departmentName, emp.firstName, emp.lastName
             FROM purchase_requests pr
             LEFT JOIN departments d ON pr.departmentId = d.id
             LEFT JOIN employees emp ON pr.requestedBy = emp.id
             WHERE pr.id = ? AND pr.deletedAt IS NULL`,
            [req.params.id]
        );
        if (requests.length === 0) {
            return res.status(404).json({ message: "Purchase request not found" });
        }
        const [items] = await pool.query(
            `SELECT pri.*, rm.name AS rawMaterialName, rm.sku, u.symbol AS unitSymbol
             FROM purchase_request_items pri
             LEFT JOIN raw_materials rm ON pri.rawMaterialId = rm.id
             LEFT JOIN inventory_units u ON pri.unitId = u.id
             WHERE pri.purchaseRequestId = ?`,
            [req.params.id]
        );
        requests[0].items = items;
        res.json(requests[0]);
    } catch (error) {
        console.error("Error fetching purchase request:", error);
        res.status(500).json({ message: "Error fetching purchase request", error: error.message });
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { requestNumber, departmentId, requestedBy, requestDate, requiredDate, purpose, items } = req.body;
        await connection.beginTransaction();
        const [result] = await connection.query(
            `INSERT INTO purchase_requests (requestNumber, departmentId, requestedBy, requestDate, requiredDate, purpose)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [requestNumber, departmentId || null, requestedBy, requestDate, requiredDate || null, purpose || null]
        );
        if (Array.isArray(items)) {
            for (const item of items) {
                await connection.query(
                    `INSERT INTO purchase_request_items (purchaseRequestId, rawMaterialId, quantity, unitId, remarks)
                     VALUES (?, ?, ?, ?, ?)`,
                    [result.insertId, item.rawMaterialId, item.quantity, item.unitId, item.remarks || null]
                );
            }
        }
        await connection.commit();
        const [newRequest] = await pool.query("SELECT * FROM purchase_requests WHERE id = ?", [result.insertId]);
        res.status(201).json(newRequest[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating purchase request:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Purchase request number already exists" });
        }
        res.status(500).json({ message: "Error creating purchase request", error: error.message });
    } finally {
        connection.release();
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { departmentId, requestDate, requiredDate, purpose } = req.body;
        const [result] = await pool.query(
            "UPDATE purchase_requests SET departmentId = ?, requestDate = ?, requiredDate = ?, purpose = ? WHERE id = ? AND deletedAt IS NULL",
            [departmentId || null, requestDate, requiredDate || null, purpose || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Purchase request not found" });
        }
        const [updatedRequest] = await pool.query("SELECT * FROM purchase_requests WHERE id = ?", [req.params.id]);
        res.json(updatedRequest[0]);
    } catch (error) {
        console.error("Error updating purchase request:", error);
        res.status(500).json({ message: "Error updating purchase request", error: error.message });
    }
});

router.patch("/:id/submit", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE purchase_requests SET status = 'pending_manager' WHERE id = ? AND status = 'draft' AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Purchase request cannot be submitted" });
        }
        const [updatedRequest] = await pool.query("SELECT * FROM purchase_requests WHERE id = ?", [req.params.id]);
        res.json(updatedRequest[0]);
    } catch (error) {
        console.error("Error submitting purchase request:", error);
        res.status(500).json({ message: "Error submitting purchase request", error: error.message });
    }
});

router.patch("/:id/approve", async (req, res) => {
    try {
        const { managerApprovedBy, managerRemarks } = req.body;
        const [result] = await pool.query(
            "UPDATE purchase_requests SET status = 'manager_approved', managerApprovedBy = ?, managerApprovedAt = NOW(), managerRemarks = ? WHERE id = ? AND status = 'pending_manager' AND deletedAt IS NULL",
            [managerApprovedBy || null, managerRemarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Purchase request cannot be approved" });
        }
        const [updatedRequest] = await pool.query("SELECT * FROM purchase_requests WHERE id = ?", [req.params.id]);
        res.json(updatedRequest[0]);
    } catch (error) {
        console.error("Error approving purchase request:", error);
        res.status(500).json({ message: "Error approving purchase request", error: error.message });
    }
});

router.patch("/:id/reject", async (req, res) => {
    try {
        const { managerRemarks } = req.body;
        const [result] = await pool.query(
            "UPDATE purchase_requests SET status = 'rejected', managerRemarks = ? WHERE id = ? AND status = 'pending_manager' AND deletedAt IS NULL",
            [managerRemarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Purchase request cannot be rejected" });
        }
        const [updatedRequest] = await pool.query("SELECT * FROM purchase_requests WHERE id = ?", [req.params.id]);
        res.json(updatedRequest[0]);
    } catch (error) {
        console.error("Error rejecting purchase request:", error);
        res.status(500).json({ message: "Error rejecting purchase request", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE purchase_requests SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL AND status IN ('draft', 'pending_manager')",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Purchase request not found or cannot be deleted" });
        }
        res.json({ message: "Purchase request deleted successfully" });
    } catch (error) {
        console.error("Error deleting purchase request:", error);
        res.status(500).json({ message: "Error deleting purchase request", error: error.message });
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            `SELECT pri.*, rm.name AS rawMaterialName, rm.sku, u.symbol AS unitSymbol
             FROM purchase_request_items pri
             LEFT JOIN raw_materials rm ON pri.rawMaterialId = rm.id
             LEFT JOIN inventory_units u ON pri.unitId = u.id
             WHERE pri.purchaseRequestId = ?`,
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        console.error("Error fetching purchase request items:", error);
        res.status(500).json({ message: "Error fetching purchase request items", error: error.message });
    }
});

router.post("/:id/items", async (req, res) => {
    try {
        const { rawMaterialId, quantity, unitId, remarks } = req.body;
        const [result] = await pool.query(
            "INSERT INTO purchase_request_items (purchaseRequestId, rawMaterialId, quantity, unitId, remarks) VALUES (?, ?, ?, ?, ?)",
            [req.params.id, rawMaterialId, quantity, unitId, remarks || null]
        );
        const [newItem] = await pool.query("SELECT * FROM purchase_request_items WHERE id = ?", [result.insertId]);
        res.status(201).json(newItem[0]);
    } catch (error) {
        console.error("Error adding purchase request item:", error);
        res.status(500).json({ message: "Error adding purchase request item", error: error.message });
    }
});

router.put("/:id/items/:itemId", async (req, res) => {
    try {
        const { rawMaterialId, quantity, unitId, remarks } = req.body;
        const [result] = await pool.query(
            "UPDATE purchase_request_items SET rawMaterialId = ?, quantity = ?, unitId = ?, remarks = ? WHERE id = ? AND purchaseRequestId = ?",
            [rawMaterialId, quantity, unitId, remarks || null, req.params.itemId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Purchase request item not found" });
        }
        const [updatedItem] = await pool.query("SELECT * FROM purchase_request_items WHERE id = ?", [req.params.itemId]);
        res.json(updatedItem[0]);
    } catch (error) {
        console.error("Error updating purchase request item:", error);
        res.status(500).json({ message: "Error updating purchase request item", error: error.message });
    }
});

router.delete("/:id/items/:itemId", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM purchase_request_items WHERE id = ? AND purchaseRequestId = ?",
            [req.params.itemId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Purchase request item not found" });
        }
        res.json({ message: "Purchase request item deleted successfully" });
    } catch (error) {
        console.error("Error deleting purchase request item:", error);
        res.status(500).json({ message: "Error deleting purchase request item", error: error.message });
    }
});

export default router;