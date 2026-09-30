import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";
import { resolveEmployeeByUser } from "../utils/geo.js";

const router = express.Router();

router.use(authMiddleware);

const ADMIN_ROLES = ["Super Admin", "Admin", "HR"];

async function isAdminUser(userId) {
    const [roles] = await pool.query(
        `SELECT r.name FROM roles r
         JOIN user_roles ur ON ur.roleId = r.id
         WHERE ur.userId = ?`,
        [userId]
    );
    return roles.some((r) => ADMIN_ROLES.includes(r.name));
}

async function currentEmployee(userId) {
    const emp = await resolveEmployeeByUser(userId);
    if (!emp) {
        const err = new Error("No employee is linked to your account. Contact admin.");
        err.statusCode = 400;
        throw err;
    }
    return emp;
}

function parseDateKey(v) {
    const d = new Date(`${v}T00:00:00`);
    const m = `${d.getMonth() + 1}`.padStart(2, "0");
    const day = `${d.getDate()}`.padStart(2, "0");
    return `${d.getFullYear()}-${m}-${day}`;
}

function countDays(fromDate, toDate, durationType) {
    if (durationType === "half_day") return 0.5;
    const f = new Date(`${fromDate}T00:00:00`);
    const t = new Date(`${toDate}T00:00:00`);
    return Math.round(((t - f) / 86400000)) + 1;
}

async function ensureBalances(employeeId, year) {
    const [types] = await pool.query(
        "SELECT id, annualLimit FROM leave_types WHERE isActive = 1 AND deletedAt IS NULL"
    );
    for (const t of types) {
        await pool.query(
            `INSERT INTO leave_balances (employeeId, leaveTypeId, year, allocatedDays, usedDays)
             VALUES (?, ?, ?, ?, 0)
             ON DUPLICATE KEY UPDATE allocatedDays = IFNULL(allocatedDays, VALUES(allocatedDays))`,
            [employeeId, t.id, year, t.annualLimit !== null ? t.annualLimit : null]
        );
    }
}

async function getBalances(employeeId, year) {
    await ensureBalances(employeeId, year);
    const [usedRows] = await pool.query(
        `SELECT leaveTypeId, COALESCE(SUM(totalDays), 0) AS used
         FROM leave_requests
         WHERE employeeId = ? AND status = 'approved' AND YEAR(fromDate) = ?
         GROUP BY leaveTypeId`,
        [employeeId, year]
    );
    const usedByType = {};
    for (const u of usedRows) usedByType[u.leaveTypeId] = Number(u.used);

    const [rows] = await pool.query(
        `SELECT lb.*, lt.name AS leaveTypeName, lt.code AS leaveTypeCode, lt.isPaid
         FROM leave_balances lb
         JOIN leave_types lt ON lb.leaveTypeId = lt.id
         WHERE lb.employeeId = ? AND lb.year = ?
         ORDER BY lt.name`,
        [employeeId, year]
    );

    const results = rows.map((r) => {
        const used = usedByType[r.leaveTypeId] || 0;
        return {
            leaveTypeId: r.leaveTypeId,
            name: r.leaveTypeName,
            code: r.leaveTypeCode,
            isPaid: !!r.isPaid,
            allocatedDays: r.allocatedDays,
            usedDays: used,
            remainingDays: r.allocatedDays === null ? null : Number(r.allocatedDays) - used,
        };
    });

    for (const r of rows) {
        await pool.query(
            "UPDATE leave_balances SET usedDays = ? WHERE id = ?",
            [usedByType[r.leaveTypeId] || 0, r.id]
        );
    }
    return results;
}

async function hasOverlap(employeeId, fromDate, toDate, excludeId) {
    const [rows] = await pool.query(
        `SELECT id FROM leave_requests
         WHERE employeeId = ? AND status IN ('pending', 'approved')
           AND fromDate <= ? AND toDate >= ?
           ${excludeId ? "AND id <> ?" : ""}`,
        excludeId
            ? [employeeId, toDate, fromDate, excludeId]
            : [employeeId, toDate, fromDate]
    );
    return rows.length > 0;
}

function forbidden(msg) {
    const err = new Error(msg);
    err.statusCode = 403;
    return err;
}

router.get("/", async (req, res) => {
    try {
        const { employeeId, status } = req.query;
        let query = `
            SELECT lr.*, lt.name AS leaveTypeName, lt.code AS leaveTypeCode,
                   e.firstName, e.lastName, e.employeeCode,
                   rm.firstName AS managerFirstName, rm.lastName AS managerLastName
            FROM leave_requests lr
            LEFT JOIN leave_types lt ON lr.leaveTypeId = lt.id
            LEFT JOIN employees e ON lr.employeeId = e.id
            LEFT JOIN employees rm ON e.reportingManagerId = rm.id
            WHERE 1=1
        `;
        const params = [];
        if (employeeId) {
            query += " AND lr.employeeId = ?";
            params.push(employeeId);
        }
        if (status) {
            query += " AND lr.status = ?";
            params.push(status);
        }
        query += " ORDER BY lr.requestedAt DESC, lr.id DESC";
        const [requests] = await pool.query(query, params);
        res.json(requests);
    } catch (error) {
        console.error("Error fetching leave requests:", error);
        res.status(500).json({ message: "Error fetching leave requests", error: error.message });
    }
});

router.get("/mine", async (req, res) => {
    try {
        const emp = await currentEmployee(req.user.id);
        const [requests] = await pool.query(
            `SELECT lr.*, lt.name AS leaveTypeName, lt.code AS leaveTypeCode,
                    rm.firstName AS managerFirstName, rm.lastName AS managerLastName
             FROM leave_requests lr
             LEFT JOIN leave_types lt ON lr.leaveTypeId = lt.id
             LEFT JOIN employees rm ON lr.employeeId = rm.id
             WHERE lr.employeeId = ?
             ORDER BY lr.requestedAt DESC, lr.id DESC`,
            [emp.id]
        );
        res.json(requests);
    } catch (error) {
        console.error("Error fetching my leave requests:", error);
        res.status(500).json({ message: "Error fetching my leave requests", error: error.message });
    }
});

router.get("/balance", async (req, res) => {
    try {
        const emp = await currentEmployee(req.user.id);
        const year = Number(req.query.year) || new Date().getFullYear();
        const balances = await getBalances(emp.id, year);
        res.json({ employeeId: emp.id, year, balances });
    } catch (error) {
        console.error("Error fetching leave balance:", error);
        res.status(500).json({ message: "Error fetching leave balance", error: error.message });
    }
});

router.get("/approvals", async (req, res) => {
    try {
        const emp = await currentEmployee(req.user.id);
        const admin = await isAdminUser(req.user.id);
        const { status } = req.query;
        let query = `
            SELECT lr.*, lt.name AS leaveTypeName, lt.code AS leaveTypeCode,
                   e.firstName, e.lastName, e.employeeCode,
                   e.reportingManagerId
            FROM leave_requests lr
            LEFT JOIN leave_types lt ON lr.leaveTypeId = lt.id
            LEFT JOIN employees e ON lr.employeeId = e.id
            WHERE lr.status = ?
        `;
        const params = [status || "pending"];
        if (!admin) {
            query += " AND e.reportingManagerId = ?";
            params.push(emp.id);
        }
        query += " ORDER BY lr.requestedAt DESC, lr.id DESC";
        const [requests] = await pool.query(query, params);
        res.json({ requests, isAdmin: admin });
    } catch (error) {
        console.error("Error fetching approval queue:", error);
        res.status(500).json({ message: "Error fetching approval queue", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [requests] = await pool.query(
            `SELECT lr.*, lt.name AS leaveTypeName, lt.code AS leaveTypeCode,
                    e.firstName, e.lastName, e.employeeCode
             FROM leave_requests lr
             LEFT JOIN leave_types lt ON lr.leaveTypeId = lt.id
             LEFT JOIN employees e ON lr.employeeId = e.id
             WHERE lr.id = ?`,
            [req.params.id]
        );
        if (requests.length === 0) {
            return res.status(404).json({ message: "Leave request not found" });
        }
        res.json(requests[0]);
    } catch (error) {
        console.error("Error fetching leave request:", error);
        res.status(500).json({ message: "Error fetching leave request", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { employeeId, leaveTypeId, fromDate, toDate, durationType, halfDayPeriod, totalDays, reason } = req.body;

        let targetEmployeeId = employeeId;
        if (!targetEmployeeId) {
            const emp = await currentEmployee(req.user.id);
            targetEmployeeId = emp.id;
        } else {
            const admin = await isAdminUser(req.user.id);
            if (!admin) {
                throw forbidden("Only admins can create leave requests for other employees.");
            }
        }

        const fDate = parseDateKey(fromDate);
        const tDate = parseDateKey(toDate);
        if (!leaveTypeId) throw new Error("Leave type is required");
        if (!fDate || !tDate || new Date(`${tDate}T00:00:00`) < new Date(`${fDate}T00:00:00`)) {
            throw new Error("Invalid date range");
        }

        const dType = durationType || "full_day";
        const days = totalDays !== undefined ? Number(totalDays) : countDays(fDate, tDate, dType);
        if (await hasOverlap(targetEmployeeId, fDate, tDate)) {
            throw new Error("You already have a pending or approved leave covering these dates");
        }

        const year = Number(fDate.slice(0, 4));
        const balances = await getBalances(targetEmployeeId, year);
        const bal = balances.find((b) => b.leaveTypeId === Number(leaveTypeId));
        if (bal && bal.remainingDays !== null && days > bal.remainingDays) {
            throw new Error(`Insufficient balance. Only ${bal.remainingDays} day(s) left for ${bal.name}.`);
        }

        const [result] = await pool.query(
            `INSERT INTO leave_requests (employeeId, leaveTypeId, fromDate, toDate, durationType, halfDayPeriod, totalDays, reason)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                targetEmployeeId, leaveTypeId, fDate, tDate, dType,
                dType === "half_day" ? (halfDayPeriod || null) : null,
                days, reason || null
            ]
        );
        const [newRequest] = await pool.query("SELECT * FROM leave_requests WHERE id = ?", [result.insertId]);
        res.status(201).json(newRequest[0]);
    } catch (error) {
        console.error("Error creating leave request:", error);
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const admin = await isAdminUser(req.user.id);
        if (!admin) throw forbidden("Only admins can edit leave requests");
        const { leaveTypeId, fromDate, toDate, durationType, halfDayPeriod, totalDays, reason, status } = req.body;
        const [existing] = await pool.query("SELECT * FROM leave_requests WHERE id = ?", [req.params.id]);
        if (existing.length === 0) {
            return res.status(404).json({ message: "Leave request not found" });
        }
        const rec = existing[0];
        let fDate = fromDate ? parseDateKey(fromDate) : rec.fromDate;
        let tDate = toDate ? parseDateKey(toDate) : rec.toDate;
        const dType = durationType || rec.durationType || "full_day";
        const days = totalDays !== undefined
            ? Number(totalDays)
            : countDays(fDate, tDate, dType);
        if (dType === "full_day" && await hasOverlap(rec.employeeId, fDate, tDate, rec.id)) {
            throw new Error("Another pending or approved leave covers these dates");
        }
        const [result] = await pool.query(
            `UPDATE leave_requests SET leaveTypeId = ?, fromDate = ?, toDate = ?, durationType = ?,
             halfDayPeriod = ?, totalDays = ?, reason = ?, status = ? WHERE id = ?`,
            [
                leaveTypeId || rec.leaveTypeId, fDate, tDate, dType,
                dType === "half_day" ? (halfDayPeriod || rec.halfDayPeriod) : null,
                days, reason !== undefined ? reason : rec.reason, status || rec.status, req.params.id
            ]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Leave request not found" });
        }
        const [updatedRequest] = await pool.query("SELECT * FROM leave_requests WHERE id = ?", [req.params.id]);
        res.json(updatedRequest[0]);
    } catch (error) {
        console.error("Error updating leave request:", error);
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

router.patch("/:id/review", async (req, res) => {
    try {
        const emp = await currentEmployee(req.user.id);
        const admin = await isAdminUser(req.user.id);
        const { status, reviewRemarks } = req.body;
        if (!["approved", "rejected"].includes(status)) {
            throw new Error("Review status must be approved or rejected");
        }
        const [requests] = await pool.query("SELECT * FROM leave_requests WHERE id = ?", [req.params.id]);
        if (requests.length === 0) {
            return res.status(404).json({ message: "Leave request not found" });
        }
        const request = requests[0];
        if (request.status !== "pending") {
            throw new Error("Only pending requests can be reviewed");
        }
        const [employeeRows] = await pool.query(
            "SELECT reportingManagerId FROM employees WHERE id = ?",
            [request.employeeId]
        );
        const managerId = employeeRows.length > 0 ? Number(employeeRows[0].reportingManagerId) : null;
        if (!admin && managerId !== Number(emp.id)) {
            throw forbidden("You are not the reporting manager for this request.");
        }

        if (status === "approved") {
            const year = Number(String(request.fromDate).slice(0, 4));
            const balances = await getBalances(request.employeeId, year);
            const bal = balances.find((b) => b.leaveTypeId === Number(request.leaveTypeId));
            if (bal && bal.remainingDays !== null && Number(request.totalDays) > bal.remainingDays) {
                throw new Error(`Insufficient balance to approve (only ${bal.remainingDays} day(s) left).`);
            }
        }

        await pool.query(
            `UPDATE leave_requests SET status = ?, reviewRemarks = ?, reviewedBy = ?, reviewedAt = NOW() WHERE id = ?`,
            [status, reviewRemarks || null, emp.id, req.params.id]
        );
        const [updatedRequest] = await pool.query("SELECT * FROM leave_requests WHERE id = ?", [req.params.id]);
        res.json(updatedRequest[0]);
    } catch (error) {
        console.error("Error reviewing leave request:", error);
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const emp = await currentEmployee(req.user.id);
        const admin = await isAdminUser(req.user.id);
        const [requests] = await pool.query("SELECT * FROM leave_requests WHERE id = ?", [req.params.id]);
        if (requests.length === 0) {
            return res.status(404).json({ message: "Leave request not found" });
        }
        const request = requests[0];
        if (request.status !== "pending") {
            throw new Error("Only pending requests can be cancelled");
        }
        if (!admin && Number(request.employeeId) !== Number(emp.id)) {
            throw forbidden("You can only cancel your own leave requests.");
        }
        await pool.query(
            "UPDATE leave_requests SET status = 'cancelled' WHERE id = ?",
            [req.params.id]
        );
        res.json({ message: "Leave request cancelled successfully" });
    } catch (error) {
        console.error("Error cancelling leave request:", error);
        res.status(error.statusCode || 400).json({ message: error.message });
    }
});

export default router;