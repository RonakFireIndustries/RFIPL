import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { status, inventoryType } = req.query;
        let query = `SELECT d.*, rep.firstName AS reportedByName, app.lastName AS approvedByName, sl.name AS locationName
                     FROM inventory_damage_loss_reports d
                     LEFT JOIN employees rep ON d.reportedBy = rep.id
                     LEFT JOIN employees app ON d.approvedBy = app.id
                     LEFT JOIN stock_locations sl ON d.locationId = sl.id
                     WHERE 1 = 1`;
        const params = [];
        if (status) { query += " AND d.status = ?"; params.push(status); }
        if (inventoryType) { query += " AND d.inventoryType = ?"; params.push(inventoryType); }
        query += " ORDER BY d.incidentDate DESC";
        const [reports] = await pool.query(query, params);
        res.json(reports);
    } catch (error) {
        console.error("Error fetching damage/loss reports:", error);
        res.status(500).json({ message: "Error fetching damage/loss reports", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [reports] = await pool.query(
            `SELECT d.*, rep.firstName AS reportedByName, app.lastName AS approvedByName, sl.name AS locationName
             FROM inventory_damage_loss_reports d
             LEFT JOIN employees rep ON d.reportedBy = rep.id
             LEFT JOIN employees app ON d.approvedBy = app.id
             LEFT JOIN stock_locations sl ON d.locationId = sl.id
             WHERE d.id = ?`,
            [req.params.id]
        );
        if (reports.length === 0) {
            return res.status(404).json({ message: "Damage/loss report not found" });
        }
        res.json(reports[0]);
    } catch (error) {
        console.error("Error fetching damage/loss report:", error);
        res.status(500).json({ message: "Error fetching damage/loss report", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { reportNumber, inventoryType, itemId, locationId, reportType, quantity, incidentDate, description, reportedBy, responsibleEmployeeId } = req.body;
        const [result] = await pool.query(
            `INSERT INTO inventory_damage_loss_reports (reportNumber, inventoryType, itemId, locationId, reportType, quantity, incidentDate, description, reportedBy, responsibleEmployeeId)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [reportNumber, inventoryType, itemId, locationId || null, reportType, quantity !== undefined ? quantity : null,
             incidentDate, description, reportedBy, responsibleEmployeeId || null]
        );
        const [newReport] = await pool.query("SELECT * FROM inventory_damage_loss_reports WHERE id = ?", [result.insertId]);
        res.status(201).json(newReport[0]);
    } catch (error) {
        console.error("Error creating damage/loss report:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Report number already exists" });
        }
        res.status(500).json({ message: "Error creating damage/loss report", error: error.message });
    }
});

router.patch("/:id/approve", async (req, res) => {
    try {
        const { approvedBy, approvalRemarks } = req.body;
        const [result] = await pool.query(
            "UPDATE inventory_damage_loss_reports SET status = 'approved', approvedBy = ?, approvedAt = NOW(), approvalRemarks = ? WHERE id = ? AND status = 'pending'",
            [approvedBy || null, approvalRemarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Report cannot be approved" });
        }
        const [updatedReport] = await pool.query("SELECT * FROM inventory_damage_loss_reports WHERE id = ?", [req.params.id]);
        res.json(updatedReport[0]);
    } catch (error) {
        console.error("Error approving report:", error);
        res.status(500).json({ message: "Error approving report", error: error.message });
    }
});

router.patch("/:id/reject", async (req, res) => {
    try {
        const { approvedBy, approvalRemarks } = req.body;
        const [result] = await pool.query(
            "UPDATE inventory_damage_loss_reports SET status = 'rejected', approvedBy = ?, approvedAt = NOW(), approvalRemarks = ? WHERE id = ? AND status = 'pending'",
            [approvedBy || null, approvalRemarks || null, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(400).json({ message: "Report cannot be rejected" });
        }
        const [updatedReport] = await pool.query("SELECT * FROM inventory_damage_loss_reports WHERE id = ?", [req.params.id]);
        res.json(updatedReport[0]);
    } catch (error) {
        console.error("Error rejecting report:", error);
        res.status(500).json({ message: "Error rejecting report", error: error.message });
    }
});

router.patch("/:id/apply", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        const [reports] = await connection.query(
            "SELECT * FROM inventory_damage_loss_reports WHERE id = ? AND status = 'approved'",
            [req.params.id]
        );
        if (reports.length === 0) {
            await connection.rollback();
            return res.status(400).json({ message: "Report must be approved before applying" });
        }
        const report = reports[0];
        const qty = Number(report.quantity || 0);
        const txType = report.reportType === 'damage' ? 'damage' : 'loss';
        if (report.inventoryType === 'raw_material') {
            const [batchRows] = await connection.query(
                "SELECT * FROM raw_material_batches WHERE rawMaterialId = ? AND currentQuantity > 0 ORDER BY receivedDate DESC LIMIT 1",
                [report.itemId]
            );
            const [stockRows] = await connection.query(
                "SELECT * FROM raw_material_stock WHERE rawMaterialId = ? AND batchId <=> ? AND locationId <=> ? ORDER BY id LIMIT 1",
                [report.itemId, batchRows.length > 0 ? batchRows[0].id : null, report.locationId || null]
            );
            if (stockRows.length > 0) {
                await connection.query(
                    "UPDATE raw_material_stock SET quantity = GREATEST(quantity - ?, 0) WHERE id = ?",
                    [qty, stockRows[0].id]
                );
            }
            await connection.query(
                `INSERT INTO raw_material_stock_ledger (rawMaterialId, batchId, locationId, transactionType, referenceType, referenceId, quantityOut, remarks, createdBy)
                 VALUES (?, ?, ?, ?, 'damage_loss_report', ?, ?, ?, ?)`,
                [report.itemId, batchRows.length > 0 ? batchRows[0].id : null, report.locationId || null,
                 txType, req.params.id, qty, `Damage/loss report ${report.reportNumber}`, req.user.id]
            );
        } else if (report.inventoryType === 'finished_product') {
            const [batchRows] = await connection.query(
                "SELECT * FROM finished_product_batches WHERE finishedProductId = ? AND currentQuantity > 0 ORDER BY manufacturingDate DESC LIMIT 1",
                [report.itemId]
            );
            const [stockRows] = await connection.query(
                "SELECT * FROM finished_product_stock WHERE finishedProductId = ? AND batchId <=> ? AND locationId <=> ? ORDER BY id LIMIT 1",
                [report.itemId, batchRows.length > 0 ? batchRows[0].id : null, report.locationId || null]
            );
            if (stockRows.length > 0) {
                await connection.query(
                    "UPDATE finished_product_stock SET quantity = GREATEST(quantity - ?, 0) WHERE id = ?",
                    [qty, stockRows[0].id]
                );
            }
            await connection.query(
                `INSERT INTO finished_product_stock_ledger (finishedProductId, batchId, locationId, transactionType, referenceType, referenceId, quantityOut, remarks, createdBy)
                 VALUES (?, ?, ?, ?, 'damage_loss_report', ?, ?, ?, ?)`,
                [report.itemId, batchRows.length > 0 ? batchRows[0].id : null, report.locationId || null,
                 txType, req.params.id, qty, `Damage/loss report ${report.reportNumber}`, req.user.id]
            );
        } else if (report.inventoryType === 'tool') {
            const [stockRows] = await connection.query(
                "SELECT * FROM tool_stock WHERE toolId = ? AND locationId <=> ? ORDER BY id LIMIT 1",
                [report.itemId, report.locationId || null]
            );
            if (stockRows.length > 0) {
                if (report.reportType === 'damage') {
                    await connection.query(
                        "UPDATE tool_stock SET damagedQuantity = damagedQuantity + ?, availableQuantity = GREATEST(availableQuantity - ?, 0) WHERE id = ?",
                        [qty, qty, stockRows[0].id]
                    );
                } else {
                    await connection.query(
                        "UPDATE tool_stock SET lostQuantity = lostQuantity + ?, availableQuantity = GREATEST(availableQuantity - ?, 0) WHERE id = ?",
                        [qty, qty, stockRows[0].id]
                    );
                }
            }
        } else if (report.inventoryType === 'machine') {
            await connection.query(
                "UPDATE machines SET status = ? WHERE id = ?",
                [report.reportType === 'damage' ? 'breakdown' : 'inactive', report.itemId]
            );
        }
        await connection.query(
            "UPDATE inventory_damage_loss_reports SET status = 'applied' WHERE id = ?",
            [req.params.id]
        );
        await connection.commit();
        const [updatedReport] = await pool.query("SELECT * FROM inventory_damage_loss_reports WHERE id = ?", [req.params.id]);
        res.json(updatedReport[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error applying report:", error);
        res.status(500).json({ message: "Error applying report", error: error.message });
    } finally {
        connection.release();
    }
});

export default router;