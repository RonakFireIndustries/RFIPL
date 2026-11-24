// Shared helpers for the purchasing and quality-control routes.

export function toNullable(value) {
    return value === undefined || value === "" ? null : value;
}

export function httpError(statusCode, message) {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
}

export function sendError(res, label, error) {
    console.error(`Error ${label}:`, error);
    res.status(error.statusCode || 500).json({
        message: `Error ${label}`,
        error: error.message,
    });
}

export function today() {
    return new Date().toISOString().slice(0, 10);
}

// Generates PR-0001, PO-0001, GRN-0001, ... using the highest existing
// number in the table. Pass a connection/transaction so the number and the
// insert are part of the same transaction.
export async function generateDocumentNumber(db, { table, column, prefix }) {
    const [rows] = await db.query(
        `SELECT COALESCE(MAX(CAST(SUBSTRING(${column}, ?) AS UNSIGNED)), 0) + 1 AS nextNumber
         FROM ${table}
         WHERE ${column} REGEXP ?`,
        [prefix.length + 1, `^${prefix}[0-9]+$`]
    );
    return `${prefix}${String(rows[0].nextNumber).padStart(4, "0")}`;
}
