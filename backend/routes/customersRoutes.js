import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { isActive, search, city } = req.query;
        let query = "SELECT * FROM customers WHERE deletedAt IS NULL";
        const params = [];
        if (isActive !== undefined) { query += " AND isActive = ?"; params.push(Number(isActive)); }
        if (city) { query += " AND city = ?"; params.push(city); }
        if (search) {
            query += " AND (companyName LIKE ? OR customerCode LIKE ? OR contactPerson LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        query += " ORDER BY companyName";
        const [customers] = await pool.query(query, params);
        res.json(customers);
    } catch (error) {
        console.error("Error fetching customers:", error);
        res.status(500).json({ message: "Error fetching customers", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [customers] = await pool.query(
            "SELECT * FROM customers WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (customers.length === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }
        res.json(customers[0]);
    } catch (error) {
        console.error("Error fetching customer:", error);
        res.status(500).json({ message: "Error fetching customer", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { customerCode, companyName, contactPerson, phone, email, billingAddress, shippingAddress, city, state, country, pincode, gstNumber, isActive } = req.body;
        const [result] = await pool.query(
            `INSERT INTO customers (customerCode, companyName, contactPerson, phone, email, billingAddress, shippingAddress, city, state, country, pincode, gstNumber, isActive)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [customerCode, companyName, contactPerson || null, phone || null, email || null,
             billingAddress || null, shippingAddress || null, city || null, state || null,
             country || 'India', pincode || null, gstNumber || null, isActive !== undefined ? Number(isActive) : 1]
        );
        const [newCustomer] = await pool.query("SELECT * FROM customers WHERE id = ?", [result.insertId]);
        res.status(201).json(newCustomer[0]);
    } catch (error) {
        console.error("Error creating customer:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Customer code already exists" });
        }
        res.status(500).json({ message: "Error creating customer", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { customerCode, companyName, contactPerson, phone, email, billingAddress, shippingAddress, city, state, country, pincode, gstNumber, isActive } = req.body;
        const [result] = await pool.query(
            `UPDATE customers SET customerCode = ?, companyName = ?, contactPerson = ?, phone = ?, email = ?, billingAddress = ?, shippingAddress = ?, city = ?, state = ?, country = ?, pincode = ?, gstNumber = ?, isActive = ?
             WHERE id = ? AND deletedAt IS NULL`,
            [customerCode, companyName, contactPerson || null, phone || null, email || null,
             billingAddress || null, shippingAddress || null, city || null, state || null,
             country || 'India', pincode || null, gstNumber || null, isActive !== undefined ? Number(isActive) : 1, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }
        const [updatedCustomer] = await pool.query("SELECT * FROM customers WHERE id = ?", [req.params.id]);
        res.json(updatedCustomer[0]);
    } catch (error) {
        console.error("Error updating customer:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Customer code already exists" });
        }
        res.status(500).json({ message: "Error updating customer", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE customers SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Customer not found" });
        }
        res.json({ message: "Customer deleted successfully" });
    } catch (error) {
        console.error("Error deleting customer:", error);
        res.status(500).json({ message: "Error deleting customer", error: error.message });
    }
});

export default router;