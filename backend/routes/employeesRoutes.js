import express from "express";
import { pool } from "../config/db.js";
import { hashPassword } from "../config/auth.js";

const slugify = (s) =>
    String(s || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .replace(/^_+|_+$/g, "");

const router = express.Router();

router.get("/", async (req, res) => {
    try {
        const { departmentId, designationId, employmentStatus, search } = req.query;
        let query = `
            SELECT e.*, d.name AS departmentName, des.name AS designationName,
                   CONCAT(m.firstName, ' ', COALESCE(m.lastName, '')) AS reportingManagerName
            FROM employees e
            LEFT JOIN departments d ON e.departmentId = d.id
            LEFT JOIN designations des ON e.designationId = des.id
            LEFT JOIN employees m ON e.reportingManagerId = m.id
            WHERE e.deletedAt IS NULL
        `;
        const params = [];

        if (departmentId) {
            query += " AND e.departmentId = ?";
            params.push(departmentId);
        }
        if (designationId) {
            query += " AND e.designationId = ?";
            params.push(designationId);
        }
        if (employmentStatus) {
            query += " AND e.employmentStatus = ?";
            params.push(employmentStatus);
        }
        if (search) {
            query += " AND (e.firstName LIKE ? OR e.lastName LIKE ? OR e.employeeCode LIKE ? OR e.phone LIKE ?)";
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        query += " ORDER BY e.firstName, e.lastName";
        const [employees] = await pool.query(query, params);
        res.json(employees);
    } catch (error) {
        console.error("Error fetching employees:", error);
        res.status(500).json({ message: "Error fetching employees", error: error.message });
    }
});

router.get("/stats", async (req, res) => {
    try {
        const [stats] = await pool.query(`
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN employmentStatus = 'active' THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN employmentStatus = 'inactive' THEN 1 ELSE 0 END) AS inactive,
                SUM(CASE WHEN employmentStatus = 'resigned' THEN 1 ELSE 0 END) AS resigned,
                SUM(CASE WHEN employmentStatus = 'terminated' THEN 1 ELSE 0 END) AS "terminated",
                SUM(CASE WHEN employmentStatus = 'on_notice' THEN 1 ELSE 0 END) AS onNotice
            FROM employees WHERE deletedAt IS NULL
        `);
        res.json(stats[0]);
    } catch (error) {
        console.error("Error fetching employee stats:", error);
        res.status(500).json({ message: "Error fetching employee stats", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [employees] = await pool.query(`
            SELECT e.*, d.name AS departmentName, des.name AS designationName,
                   CONCAT(m.firstName, ' ', COALESCE(m.lastName, '')) AS reportingManagerName
            FROM employees e
            LEFT JOIN departments d ON e.departmentId = d.id
            LEFT JOIN designations des ON e.designationId = des.id
            LEFT JOIN employees m ON e.reportingManagerId = m.id
            WHERE e.id = ? AND e.deletedAt IS NULL
        `, [req.params.id]);
        if (employees.length === 0) {
            return res.status(404).json({ message: "Employee not found" });
        }
        res.json(employees[0]);
    } catch (error) {
        console.error("Error fetching employee:", error);
        res.status(500).json({ message: "Error fetching employee", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const {
            userId, employeeCode, firstName, lastName, dateOfBirth, gender, profilePhotoPath,
            personalEmail, phone, currentAddress, permanentAddress, city, state, country, pincode,
            departmentId, designationId, reportingManagerId,
            joiningDate, employmentType, employmentStatus
        } = req.body;

        // ---- Auto-provision a login account when none is linked ----
        // rule: system login id = firstname.lastname@rfipl.com (uniquified on collision)
        let resolvedUserId = userId || null;
        let autoLoginEmail = null;
        let autoLoginPassword = null;
        if (!resolvedUserId && firstName) {
            const base = `${slugify(firstName)}.${slugify(lastName) || "user"}`.toLowerCase();
            let candidate = `${base}@rfipl.com`;
            let n = 2;
            const emailTaken = async (e) => {
                const [rows] = await pool.query("SELECT id FROM users WHERE email = ?", [e]);
                return rows.length > 0;
            };
            while (await emailTaken(candidate)) {
                candidate = `${base}${n}@rfipl.com`;
                n++;
            }
            autoLoginEmail = candidate;
            autoLoginPassword = `Rfipl@${Math.random().toString(36).slice(2, 10)}`;
            const passwordHash = await hashPassword(autoLoginPassword);
            const [userResult] = await pool.query(
                "INSERT INTO users (email, passwordHash, isActive) VALUES (?, ?, 1)",
                [autoLoginEmail, passwordHash]
            );
            resolvedUserId = userResult.insertId;
        }

        const [result] = await pool.query(
            `INSERT INTO employees (
                userId, employeeCode, firstName, lastName, dateOfBirth, gender, profilePhotoPath,
                personalEmail, phone, currentAddress, permanentAddress, city, state, country, pincode,
                departmentId, designationId, reportingManagerId,
                joiningDate, employmentType, employmentStatus
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                resolvedUserId, employeeCode, firstName, lastName || null, dateOfBirth || null,
                gender || null, profilePhotoPath || null, personalEmail || null, phone || null,
                currentAddress || null, permanentAddress || null, city || null, state || null,
                country || "India", pincode || null, departmentId, designationId,
                reportingManagerId || null, joiningDate, employmentType,
                employmentStatus || "active"
            ]
        );

        const [newEmployee] = await pool.query("SELECT * FROM employees WHERE id = ?", [result.insertId]);
        res.status(201).json({
            ...newEmployee[0],
            autoLoginEmail,
            autoLoginPassword,
        });
    } catch (error) {
        console.error("Error creating employee:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Employee code or user already exists" });
        }
        res.status(500).json({ message: "Error creating employee", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const {
            userId, employeeCode, firstName, lastName, dateOfBirth, gender, profilePhotoPath,
            personalEmail, phone, currentAddress, permanentAddress, city, state, country, pincode,
            departmentId, designationId, reportingManagerId,
            joiningDate, employmentType, employmentStatus
        } = req.body;

        const [result] = await pool.query(
            `UPDATE employees SET
                userId = ?, employeeCode = ?, firstName = ?, lastName = ?, dateOfBirth = ?,
                gender = ?, profilePhotoPath = ?, personalEmail = ?, phone = ?,
                currentAddress = ?, permanentAddress = ?, city = ?, state = ?, country = ?, pincode = ?,
                departmentId = ?, designationId = ?, reportingManagerId = ?,
                joiningDate = ?, employmentType = ?, employmentStatus = ?
            WHERE id = ? AND deletedAt IS NULL`,
            [
                userId || null, employeeCode, firstName, lastName || null, dateOfBirth || null,
                gender || null, profilePhotoPath || null, personalEmail || null, phone || null,
                currentAddress || null, permanentAddress || null, city || null, state || null,
                country || "India", pincode || null, departmentId, designationId,
                reportingManagerId || null, joiningDate, employmentType,
                employmentStatus || "active", req.params.id
            ]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const [updatedEmployee] = await pool.query("SELECT * FROM employees WHERE id = ?", [req.params.id]);
        res.json(updatedEmployee[0]);
    } catch (error) {
        console.error("Error updating employee:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Employee code or user already exists" });
        }
        res.status(500).json({ message: "Error updating employee", error: error.message });
    }
});

router.patch("/:id/status", async (req, res) => {
    try {
        const { employmentStatus } = req.body;
        const [result] = await pool.query(
            "UPDATE employees SET employmentStatus = ? WHERE id = ? AND deletedAt IS NULL",
            [employmentStatus, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Employee not found" });
        }
        const [updatedEmployee] = await pool.query("SELECT * FROM employees WHERE id = ?", [req.params.id]);
        res.json(updatedEmployee[0]);
    } catch (error) {
        console.error("Error updating employee status:", error);
        res.status(500).json({ message: "Error updating employee status", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE employees SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Employee not found" });
        }
        res.json({ message: "Employee deleted successfully" });
    } catch (error) {
        console.error("Error deleting employee:", error);
        res.status(500).json({ message: "Error deleting employee", error: error.message });
    }
});

export default router;
