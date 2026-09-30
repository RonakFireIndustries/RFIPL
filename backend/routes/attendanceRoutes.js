import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";
import {
    haversineMeters, toDateKey, minutesBetween, resolveEmployeeByUser
} from "../utils/geo.js";

const CLOCK_SKEW_MS = 5 * 60 * 1000;

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { employeeId, fromDate, toDate, status } = req.query;
        let query = `
            SELECT ar.*, ar.STATUS AS status, e.firstName, e.lastName, e.employeeCode, s.name AS shiftName
            FROM attendance_records ar
            LEFT JOIN employees e ON ar.employeeId = e.id
            LEFT JOIN shifts s ON ar.shiftId = s.id
            WHERE 1=1
        `;
        const params = [];
        if (employeeId) {
            query += " AND ar.employeeId = ?";
            params.push(employeeId);
        }
        if (fromDate) {
            query += " AND ar.attendanceDate >= ?";
            params.push(fromDate);
        }
        if (toDate) {
            query += " AND ar.attendanceDate <= ?";
            params.push(toDate);
        }
        if (status) {
            query += " AND ar.status = ?";
            params.push(status);
        }
        query += " ORDER BY ar.attendanceDate DESC, ar.employeeId";
        const [records] = await pool.query(query, params);
        res.json(records);
    } catch (error) {
        console.error("Error fetching attendance records:", error);
        res.status(500).json({ message: "Error fetching attendance records", error: error.message });
    }
});

router.post("/punch", async (req, res) => {
    try {
        const { type, latitude, longitude, accuracy, deviceTimestamp } = req.body;
        if (!type || (type !== "in" && type !== "out")) {
            return res.status(400).json({ message: "Invalid punch type" });
        }

        const employee = await resolveEmployeeByUser(req.user.id);
        if (!employee) {
            return res.status(400).json({ message: "No employee is linked to your account. Contact admin." });
        }

        const [locations] = await pool.query(
            "SELECT * FROM work_locations WHERE isActive = 1 ORDER BY id DESC LIMIT 1"
        );
        if (locations.length === 0) {
            return res.status(400).json({ message: "No active work location configured. Contact admin." });
        }
        const location = locations[0];

        const lat = Number(latitude);
        const lng = Number(longitude);
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ message: "Invalid GPS coordinates received" });
        }

        const deviceMs = Number(deviceTimestamp);
        if (!deviceMs || Math.abs(Date.now() - deviceMs) > CLOCK_SKEW_MS) {
            return res.status(400).json({ message: "Your device clock appears out of sync. Check your time and try again." });
        }

        if (accuracy === undefined || accuracy === null || Number(accuracy) < 0) {
            return res.status(400).json({ message: "GPS accuracy could not be determined. Move outdoors and try again." });
        }
        if (Number(accuracy) > Number(location.accuracyThresholdMeters)) {
            return res.status(400).json({ message: `GPS accuracy too low (${Math.round(Number(accuracy))}m). Required within ${Number(location.accuracyThresholdMeters)}m.` });
        }

        const distance = Math.round(haversineMeters(
            Number(location.latitude), Number(location.longitude), lat, lng
        ));

        const geofenceEnabled = !!location.geofenceEnabled;
        const withinRadius = distance <= Number(location.radiusMeters);
        if (geofenceEnabled && !withinRadius) {
            return res.status(400).json({
                message: `You are outside the attendance area (${distance}m from site, radius ${Number(location.radiusMeters)}m).`,
                distance, withinRadius: false
            });
        }

        const now = new Date();
        const attendanceDate = type === "in" ? await resolveAttendanceDate(employee.id, now) : null;

        if (type === "in") {
            const [existing] = await pool.query(
                "SELECT * FROM attendance_records WHERE employeeId = ? AND attendanceDate = ?",
                [employee.id, attendanceDate]
            );
            if (existing.length > 0 && existing[0].checkInAt) {
                return res.status(409).json({ message: "You have already checked in for this shift." });
            }

            const shift = await resolveAssignedShift(employee.id, attendanceDate);

            const checkInAt = formatForDb(now);
            let lateMinutes = 0;
            let earlyMinutes = 0;
            let status = "present";

            if (shift) {
                const [shiftRows] = await pool.query("SELECT *, NAME AS name FROM shifts WHERE id = ?", [shift.shiftId]);
                const shiftDef = shiftRows[0];
                const graceEnd = new Date(`${attendanceDate}T${(shiftDef.startTime).slice(0, 5)}`);
                graceEnd.setMinutes(graceEnd.getMinutes() + Number(shiftDef.gracePeriodMinutes || 0));
                const startRef = new Date(`${attendanceDate}T${(shiftDef.startTime).slice(0, 5)}`);
                if (now < startRef) earlyMinutes = Math.round((startRef - now) / 60000);
                if (now > graceEnd) {
                    lateMinutes = Math.round((now - graceEnd) / 60000);
                    status = lateMinutes >= Number(shiftDef.halfDayThresholdMinutes || 240) ? "half_day" : "late";
                }
            }

            if (status === "late") {
                const { lateSequenceNumber, lateDeductionType } = await computeLateAccumulation(employee.id, attendanceDate);
                await saveInRecord(employee.id, attendanceDate, shift ? shift.shiftId : null, checkInAt, lat, lng, Number(accuracy), status, lateMinutes, earlyMinutes, lateSequenceNumber, lateDeductionType);
            } else {
                await saveInRecord(employee.id, attendanceDate, shift ? shift.shiftId : null, checkInAt, lat, lng, Number(accuracy), status, lateMinutes, earlyMinutes, null, "none");
            }

            const [record] = await pool.query(
                `SELECT ar.*, ar.STATUS AS status FROM attendance_records ar
                 WHERE ar.employeeId = ? AND ar.attendanceDate = ?`,
                [employee.id, attendanceDate]
            );
            return res.status(201).json({ record: record[0], distance, withinRadius });
        }

        const [opens] = await pool.query(
            `SELECT ar.*, ar.STATUS AS status FROM attendance_records ar
             WHERE ar.employeeId = ? AND ar.checkInAt IS NOT NULL AND ar.checkOutAt IS NULL
             ORDER BY ar.attendanceDate DESC, ar.checkInAt DESC LIMIT 1`,
            [employee.id]
        );
        if (opens.length === 0) {
            return res.status(404).json({ message: "No open check-in found. Please check in first." });
        }
        const open = opens[0];

        const checkOutAt = now;
        const checkInDt = new Date(open.checkInAt);
        const workingMinutes = minutesBetween(checkInDt, checkOutAt);
        let earlyMinutes = Number(open.earlyMinutes || 0);
        let overtimeMinutes = 0;
        let status = open.status;

        if (open.shiftId) {
            const [shiftRows] = await pool.query("SELECT *, NAME AS name FROM shifts WHERE id = ?", [open.shiftId]);
            const shiftDef = shiftRows[0];
            if (shiftDef) {
                const ad = dateKeyOf(open.attendanceDate);
                const startTime = String(shiftDef.startTime).slice(0, 5);
                const endTime = String(shiftDef.endTime).slice(0, 5);
                let endDateTime = new Date(`${ad}T${endTime}`);
                if (endTime < startTime) {
                    const next = new Date(`${ad}T00:00:00`);
                    next.setDate(next.getDate() + 1);
                    endDateTime = new Date(`${toDateKey(next)}T${endTime}`);
                }
                const diffMs = checkOutAt.getTime() - endDateTime.getTime();
                if (diffMs < 0) earlyMinutes = Math.round(-diffMs / 60000);
                else if (shiftDef.overtimeAfterEndTime) overtimeMinutes = Math.round(diffMs / 60000);

                if ((status === "present" || status === "late") && workingMinutes < Number(shiftDef.halfDayThresholdMinutes || 240)) {
                    status = "half_day";
                }
            }
        }

        await pool.query(
            `UPDATE attendance_records SET
                checkOutAt = ?, checkOutLatitude = ?, checkOutLongitude = ?, checkOutAccuracy = ?,
                earlyMinutes = ?, workingMinutes = ?, overtimeMinutes = ?, status = ?,
                lateSequenceNumber = ?, lateDeductionType = ?
             WHERE id = ?`,
            [
                formatForDb(checkOutAt), lat, lng, Number(accuracy),
                earlyMinutes, workingMinutes, overtimeMinutes, status,
                open.lateSequenceNumber || null, open.lateDeductionType || "none", open.id
            ]
        );
        const [record] = await pool.query(
                `SELECT ar.*, ar.STATUS AS status FROM attendance_records ar WHERE ar.id = ?`,
                [open.id]
            );
        res.json({ record: record[0], distance, withinRadius });
    } catch (error) {
        console.error("Error processing attendance punch:", error);
        res.status(500).json({ message: "Error processing attendance punch", error: error.message });
    }
});

router.get("/self", async (req, res) => {
    try {
        const employee = await resolveEmployeeByUser(req.user.id);
        if (!employee) {
            return res.status(400).json({ message: "No employee is linked to your account. Contact admin." });
        }

        const [locations] = await pool.query(
            "SELECT * FROM work_locations WHERE isActive = 1 ORDER BY id DESC LIMIT 1"
        );
        const location = locations.length > 0 ? locations[0] : null;

        const now = new Date();
        const attendanceDate = location ? await resolveAttendanceDate(employee.id, now) : toDateKey(now);

        const [opens] = await pool.query(
            `SELECT ar.*, ar.STATUS AS status FROM attendance_records ar
             WHERE ar.employeeId = ? AND ar.checkInAt IS NOT NULL AND ar.checkOutAt IS NULL
             ORDER BY ar.attendanceDate DESC, ar.checkInAt DESC LIMIT 1`,
            [employee.id]
        );
        const openRecord = opens.length > 0 ? opens[0] : null;

        const [todays] = await pool.query(
            `SELECT ar.*, ar.STATUS AS status FROM attendance_records ar
             WHERE ar.employeeId = ? AND ar.attendanceDate = ?`,
            [employee.id, attendanceDate]
        );
        const todayRecord = todays.length > 0 ? todays[0] : null;

        const [recent] = await pool.query(
            `SELECT ar.*, ar.STATUS AS status FROM attendance_records ar
             WHERE ar.employeeId = ? ORDER BY ar.attendanceDate DESC, ar.checkInAt DESC LIMIT 15`,
            [employee.id]
        );

        const shift = await resolveAssignedShift(employee.id, attendanceDate);
        let shiftDef = null;
        if (shift) {
            const [rows] = await pool.query("SELECT *, NAME AS name FROM shifts WHERE id = ?", [shift.shiftId]);
            shiftDef = rows.length > 0 ? rows[0] : null;
        }

        res.json({ employee, location, openRecord, todayRecord, shift, shiftDef, recent });
    } catch (error) {
        console.error("Error fetching self attendance:", error);
        res.status(500).json({ message: "Error fetching self attendance", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [records] = await pool.query(
            `SELECT ar.*, ar.STATUS AS status, e.firstName, e.lastName, e.employeeCode, s.name AS shiftName
             FROM attendance_records ar
             LEFT JOIN employees e ON ar.employeeId = e.id
             LEFT JOIN shifts s ON ar.shiftId = s.id
             WHERE ar.id = ?`,
            [req.params.id]
        );
        if (records.length === 0) {
            return res.status(404).json({ message: "Attendance record not found" });
        }
        res.json(records[0]);
    } catch (error) {
        console.error("Error fetching attendance record:", error);
        res.status(500).json({ message: "Error fetching attendance record", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const {
            employeeId, shiftId, attendanceDate, status, checkInAt, checkOutAt,
            checkInLatitude, checkInLongitude, checkInAccuracy,
            checkOutLatitude, checkOutLongitude, checkOutAccuracy, notes
        } = req.body;
        const [result] = await pool.query(
            `INSERT INTO attendance_records (
                employeeId, shiftId, attendanceDate, checkInAt, checkOutAt,
                checkInLatitude, checkInLongitude, checkInAccuracy,
                checkOutLatitude, checkOutLongitude, checkOutAccuracy,
                status, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                employeeId, shiftId || null, attendanceDate, checkInAt || null, checkOutAt || null,
                checkInLatitude || null, checkInLongitude || null, checkInAccuracy || null,
                checkOutLatitude || null, checkOutLongitude || null, checkOutAccuracy || null,
                status || "present", notes || null
            ]
        );
        const [newRecord] = await pool.query("SELECT * FROM attendance_records WHERE id = ?", [result.insertId]);
        res.status(201).json(newRecord[0]);
    } catch (error) {
        console.error("Error creating attendance record:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Attendance record already exists for this day" });
        }
        res.status(500).json({ message: "Error creating attendance record", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const {
            shiftId, status, checkInAt, checkOutAt, earlyMinutes, lateMinutes,
            workingMinutes, overtimeMinutes, lateSequenceNumber, lateDeductionType, notes
        } = req.body;
        const [result] = await pool.query(
            `UPDATE attendance_records SET
                shiftId = ?, status = ?, checkInAt = ?, checkOutAt = ?,
                earlyMinutes = ?, lateMinutes = ?, workingMinutes = ?, overtimeMinutes = ?,
                lateSequenceNumber = ?, lateDeductionType = ?, notes = ?
            WHERE id = ?`,
            [
                shiftId || null, status, checkInAt, checkOutAt,
                earlyMinutes || 0, lateMinutes || 0, workingMinutes || 0, overtimeMinutes || 0,
                lateSequenceNumber || null, lateDeductionType || "none", notes || null, req.params.id
            ]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Attendance record not found" });
        }
        const [updatedRecord] = await pool.query("SELECT * FROM attendance_records WHERE id = ?", [req.params.id]);
        res.json(updatedRecord[0]);
    } catch (error) {
        console.error("Error updating attendance record:", error);
        res.status(500).json({ message: "Error updating attendance record", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query("DELETE FROM attendance_records WHERE id = ?", [req.params.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Attendance record not found" });
        }
        res.json({ message: "Attendance record deleted successfully" });
    } catch (error) {
        console.error("Error deleting attendance record:", error);
        res.status(500).json({ message: "Error deleting attendance record", error: error.message });
    }
});

export default router;

async function resolveAttendanceDate(employeeId, now) {
    const shift = await resolveAssignedShift(employeeId, toDateKey(now));
    if (!shift) return toDateKey(now);
    const [rows] = await pool.query("SELECT * FROM shifts WHERE id = ?", [shift.shiftId]);
    if (rows.length === 0) return toDateKey(now);
    const startTime = String(rows[0].startTime).slice(0, 5);
    const endTime = String(rows[0].endTime).slice(0, 5);
    const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const isNightShift = endTime < startTime;
    if (isNightShift && currentTime < endTime) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return toDateKey(yesterday);
    }
    return toDateKey(now);
}

async function resolveAssignedShift(employeeId, date) {
    const [rows] = await pool.query(
        `SELECT es.shiftId FROM employee_shift_assignments es
         WHERE es.employeeId = ? AND es.isActive = 1
           AND es.effectiveFrom <= ? AND (es.effectiveTo IS NULL OR es.effectiveTo >= ?)
         ORDER BY es.effectiveFrom DESC LIMIT 1`,
        [employeeId, date, date]
    );
    return rows.length > 0 ? rows[0] : null;
}

async function computeLateAccumulation(employeeId, attendanceDate) {
    const monthStart = `${attendanceDate.slice(0, 7)}-01`;
    const [ruleRows] = await pool.query(
        "SELECT lateHalfDayThreshold, lateFullDayThreshold FROM attendance_rules ORDER BY id DESC LIMIT 1"
    );
    const lateHalfDayThreshold = ruleRows.length > 0 ? Number(ruleRows[0].lateHalfDayThreshold) : 3;
    const lateFullDayThreshold = ruleRows.length > 0 ? Number(ruleRows[0].lateFullDayThreshold) : 5;

    const [countRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM attendance_records
         WHERE employeeId = ? AND status = 'late' AND attendanceDate >= ?`,
        [employeeId, monthStart]
    );
    const lateSequenceNumber = Number(countRows[0]?.cnt || 0);
    const lateDeductionType =
        lateSequenceNumber >= lateFullDayThreshold ? "full_day" :
        lateSequenceNumber >= lateHalfDayThreshold ? "half_day" : "none";
    return { lateSequenceNumber, lateDeductionType };
}

async function saveInRecord(employeeId, attendanceDate, shiftId, checkInAt, lat, lng, accuracy, status, lateMinutes, earlyMinutes, lateSequenceNumber, lateDeductionType) {
    await pool.query(
        `INSERT INTO attendance_records
            (employeeId, shiftId, attendanceDate, checkInAt, checkInLatitude, checkInLongitude, checkInAccuracy,
             status, lateMinutes, earlyMinutes, lateSequenceNumber, lateDeductionType)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            shiftId = VALUES(shiftId), checkInAt = VALUES(checkInAt),
            checkInLatitude = VALUES(checkInLatitude), checkInLongitude = VALUES(checkInLongitude),
            checkInAccuracy = VALUES(checkInAccuracy), status = VALUES(status),
            lateMinutes = VALUES(lateMinutes), earlyMinutes = VALUES(earlyMinutes),
            lateSequenceNumber = VALUES(lateSequenceNumber), lateDeductionType = VALUES(lateDeductionType)`,
        [employeeId, shiftId, attendanceDate, checkInAt, lat, lng, accuracy,
         status, lateMinutes, earlyMinutes, lateSequenceNumber, lateDeductionType]
    );
}

function formatForDb(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const hh = String(date.getHours()).padStart(2, "0");
    const mm = String(date.getMinutes()).padStart(2, "0");
    const ss = String(date.getSeconds()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

function dateKeyOf(value) {
    if (value instanceof Date) return toDateKey(value);
    return String(value).slice(0, 10);
}
