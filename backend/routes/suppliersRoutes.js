import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { isActive, search, city, state } = req.query;
        let query = "SELECT * FROM suppliers WHERE deletedAt IS NULL";
        const params = [];
        if (isActive !== undefined) { query += " AND isActive = ?"; params.push(Number(isActive)); }
        if (city) { query += " AND city = ?"; params.push(city); }
        if (state) { query += " AND state = ?"; params.push(state); }
        if (search) {
            query += " AND (companyName LIKE ? OR supplierCode LIKE ? OR contactPerson LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        query += " ORDER BY companyName";
        const [suppliers] = await pool.query(query, params);
        res.json(suppliers);
    } catch (error) {
        console.error("Error fetching suppliers:", error);
        res.status(500).json({ message: "Error fetching suppliers", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [suppliers] = await pool.query(
            "SELECT * FROM suppliers WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (suppliers.length === 0) {
            return res.status(404).json({ message: "Supplier not found" });
        }
        res.json(suppliers[0]);
    } catch (error) {
        console.error("Error fetching supplier:", error);
        res.status(500).json({ message: "Error fetching supplier", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { supplierCode, companyName, contactPerson, phone, email, address, city, state, country, pincode, gstNumber, panNumber, isActive } = req.body;
        const [result] = await pool.query(
            `INSERT INTO suppliers (supplierCode, companyName, contactPerson, phone, email, address, city, state, country, pincode, gstNumber, panNumber, isActive)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [supplierCode, companyName, contactPerson || null, phone || null, email || null, address || null,
             city || null, state || null, country || 'India', pincode || null, gstNumber || null, panNumber || null,
             isActive !== undefined ? Number(isActive) : 1]
        );
        const [newSupplier] = await pool.query("SELECT * FROM suppliers WHERE id = ?", [result.insertId]);
        res.status(201).json(newSupplier[0]);
    } catch (error) {
        console.error("Error creating supplier:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Supplier code already exists" });
        }
        res.status(500).json({ message: "Error creating supplier", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { supplierCode, companyName, contactPerson, phone, email, address, city, state, country, pincode, gstNumber, panNumber, isActive } = req.body;
        const [result] = await pool.query(
            `UPDATE suppliers SET supplierCode = ?, companyName = ?, contactPerson = ?, phone = ?, email = ?, address = ?, city = ?, state = ?, country = ?, pincode = ?, gstNumber = ?, panNumber = ?, isActive = ?
             WHERE id = ? AND deletedAt IS NULL`,
            [supplierCode, companyName, contactPerson || null, phone || null, email || null, address || null,
             city || null, state || null, country || 'India', pincode || null, gstNumber || null, panNumber || null,
             isActive !== undefined ? Number(isActive) : 1, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Supplier not found" });
        }
        const [updatedSupplier] = await pool.query("SELECT * FROM suppliers WHERE id = ?", [req.params.id]);
        res.json(updatedSupplier[0]);
    } catch (error) {
        console.error("Error updating supplier:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Supplier code already exists" });
        }
        res.status(500).json({ message: "Error updating supplier", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE suppliers SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Supplier not found" });
        }
        res.json({ message: "Supplier deleted successfully" });
    } catch (error) {
        console.error("Error deleting supplier:", error);
        res.status(500).json({ message: "Error deleting supplier", error: error.message });
    }
});

export default router;