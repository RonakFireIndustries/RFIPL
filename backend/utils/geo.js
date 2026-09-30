import { pool } from "../config/db.js";

export function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

export function toDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function minutesBetween(a, b) {
    return Math.round(Math.abs(a.getTime() - b.getTime()) / 60000);
}

export async function resolveEmployeeByUser(userId) {
    const [emps] = await pool.query(
        "SELECT id, firstName, lastName, employeeCode, designationId FROM employees WHERE userId = ? AND deletedAt IS NULL",
        [userId]
    );
    return emps.length > 0 ? emps[0] : null;
}