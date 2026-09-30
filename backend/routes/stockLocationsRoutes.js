import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { departmentId, isActive, search } = req.query;
        let query = `SELECT sl.*, d.name AS departmentName
                     FROM stock_locations sl
                     LEFT JOIN departments d ON sl.departmentId = d.id
                     WHERE sl.deletedAt IS NULL`;
        const params = [];
        if (departmentId) { query += " AND sl.departmentId = ?"; params.push(departmentId); }
        if (isActive !== undefined) { query += " AND sl.isActive = ?"; params.push(Number(isActive)); }
        if (search) { query += " AND (sl.name LIKE ? OR sl.code LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
        query += " ORDER BY sl.name";
        const [locations] = await pool.query(query, params);
        res.json(locations);
    } catch (error) {
        console.error("Error fetching stock locations:", error);
        res.status(500).json({ message: "Error fetching stock locations", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [locations] = await pool.query(
            `SELECT sl.*, d.name AS departmentName
             FROM stock_locations sl
             LEFT JOIN departments d ON sl.departmentId = d.id
             WHERE sl.id = ? AND sl.deletedAt IS NULL`,
            [req.params.id]
        );
        if (locations.length === 0) {
            return res.status(404).json({ message: "Stock location not found" });
        }
        res.json(locations[0]);
    } catch (error) {
        console.error("Error fetching stock location:", error);
        res.status(500).json({ message: "Error fetching stock location", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { name, code, departmentId, description, isActive } = req.body;
        const [result] = await pool.query(
            "INSERT INTO stock_locations (name, code, departmentId, description, isActive) VALUES (?, ?, ?, ?, ?)",
            [name, code, departmentId || null, description || null, isActive !== undefined ? Number(isActive) : 1]
        );
        const [newLocation] = await pool.query("SELECT * FROM stock_locations WHERE id = ?", [result.insertId]);
        res.status(201).json(newLocation[0]);
    } catch (error) {
        console.error("Error creating stock location:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Location code already exists" });
        }
        res.status(500).json({ message: "Error creating stock location", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, code, departmentId, description, isActive } = req.body;
        const [result] = await pool.query(
            "UPDATE stock_locations SET name = ?, code = ?, departmentId = ?, description = ?, isActive = ? WHERE id = ? AND deletedAt IS NULL",
            [name, code, departmentId || null, description || null, isActive !== undefined ? Number(isActive) : 1, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Stock location not found" });
        }
        const [updatedLocation] = await pool.query("SELECT * FROM stock_locations WHERE id = ?", [req.params.id]);
        res.json(updatedLocation[0]);
    } catch (error) {
        console.error("Error updating stock location:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Location code already exists" });
        }
        res.status(500).json({ message: "Error updating stock location", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE stock_locations SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Stock location not found" });
        }
        res.json({ message: "Stock location deleted successfully" });
    } catch (error) {
        console.error("Error deleting stock location:", error);
        res.status(500).json({ message: "Error deleting stock location", error: error.message });
    }
});

export default router;