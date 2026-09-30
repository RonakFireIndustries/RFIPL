import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { categoryId, toolType, isActive, search } = req.query;
        let query = `SELECT t.*, c.name AS categoryName, u.symbol AS unitSymbol
                     FROM tools t
                     LEFT JOIN inventory_categories c ON t.categoryId = c.id
                     LEFT JOIN inventory_units u ON t.unitId = u.id
                     WHERE t.deletedAt IS NULL`;
        const params = [];
        if (categoryId) { query += " AND t.categoryId = ?"; params.push(categoryId); }
        if (toolType) { query += " AND t.toolType = ?"; params.push(toolType); }
        if (isActive !== undefined) { query += " AND t.isActive = ?"; params.push(Number(isActive)); }
        if (search) { query += " AND (t.name LIKE ? OR t.toolCode LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
        query += " ORDER BY t.name";
        const [tools] = await pool.query(query, params);
        res.json(tools);
    } catch (error) {
        console.error("Error fetching tools:", error);
        res.status(500).json({ message: "Error fetching tools", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [tools] = await pool.query(
            `SELECT t.*, c.name AS categoryName, u.symbol AS unitSymbol,
                    COALESCE((SELECT SUM(availableQuantity) FROM tool_stock ts WHERE ts.toolId = t.id), 0) AS totalAvailable,
                    COALESCE((SELECT SUM(assignedQuantity) FROM tool_stock ts WHERE ts.toolId = t.id), 0) AS totalAssigned
             FROM tools t
             LEFT JOIN inventory_categories c ON t.categoryId = c.id
             LEFT JOIN inventory_units u ON t.unitId = u.id
             WHERE t.id = ? AND t.deletedAt IS NULL`,
            [req.params.id]
        );
        if (tools.length === 0) {
            return res.status(404).json({ message: "Tool not found" });
        }
        const [stock] = await pool.query(
            `SELECT ts.*, sl.name AS locationName, u.symbol AS unitSymbol
             FROM tool_stock ts
             LEFT JOIN stock_locations sl ON ts.locationId = sl.id
             LEFT JOIN inventory_units u ON ts.unitId = u.id
             WHERE ts.toolId = ?`,
            [req.params.id]
        );
        tools[0].stock = stock;
        res.json(tools[0]);
    } catch (error) {
        console.error("Error fetching tool:", error);
        res.status(500).json({ message: "Error fetching tool", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { toolCode, name, categoryId, unitId, toolType, minimumStockLevel, description, isActive } = req.body;
        const [result] = await pool.query(
            `INSERT INTO tools (toolCode, name, categoryId, unitId, toolType, minimumStockLevel, description, isActive)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [toolCode, name, categoryId || null, unitId, toolType, minimumStockLevel !== undefined ? minimumStockLevel : 0, description || null, isActive !== undefined ? Number(isActive) : 1]
        );
        const [newTool] = await pool.query("SELECT * FROM tools WHERE id = ?", [result.insertId]);
        res.status(201).json(newTool[0]);
    } catch (error) {
        console.error("Error creating tool:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Tool code already exists" });
        }
        res.status(500).json({ message: "Error creating tool", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { toolCode, name, categoryId, unitId, toolType, minimumStockLevel, description, isActive } = req.body;
        const [result] = await pool.query(
            `UPDATE tools SET toolCode = ?, name = ?, categoryId = ?, unitId = ?, toolType = ?, minimumStockLevel = ?, description = ?, isActive = ?
             WHERE id = ? AND deletedAt IS NULL`,
            [toolCode, name, categoryId || null, unitId, toolType, minimumStockLevel !== undefined ? minimumStockLevel : 0, description || null, isActive !== undefined ? Number(isActive) : 1, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Tool not found" });
        }
        const [updatedTool] = await pool.query("SELECT * FROM tools WHERE id = ?", [req.params.id]);
        res.json(updatedTool[0]);
    } catch (error) {
        console.error("Error updating tool:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Tool code already exists" });
        }
        res.status(500).json({ message: "Error updating tool", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE tools SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Tool not found" });
        }
        res.json({ message: "Tool deleted successfully" });
    } catch (error) {
        console.error("Error deleting tool:", error);
        res.status(500).json({ message: "Error deleting tool", error: error.message });
    }
});

router.get("/:id/stock", async (req, res) => {
    try {
        const [stock] = await pool.query(
            `SELECT ts.*, sl.name AS locationName, u.symbol AS unitSymbol
             FROM tool_stock ts
             LEFT JOIN stock_locations sl ON ts.locationId = sl.id
             LEFT JOIN inventory_units u ON ts.unitId = u.id
             WHERE ts.toolId = ?`,
            [req.params.id]
        );
        res.json(stock);
    } catch (error) {
        console.error("Error fetching tool stock:", error);
        res.status(500).json({ message: "Error fetching tool stock", error: error.message });
    }
});

router.post("/stock", async (req, res) => {
    try {
        const { toolId, locationId, availableQuantity, assignedQuantity, damagedQuantity, lostQuantity, unitId } = req.body;
        const [existing] = await pool.query(
            "SELECT * FROM tool_stock WHERE toolId = ? AND locationId = ?",
            [toolId, locationId]
        );
        if (existing.length > 0) {
            await pool.query(
                `UPDATE tool_stock SET availableQuantity = availableQuantity + ?, assignedQuantity = assignedQuantity + ?, damagedQuantity = damagedQuantity + ?, lostQuantity = lostQuantity + ?, unitId = ? WHERE id = ?`,
                [availableQuantity || 0, assignedQuantity || 0, damagedQuantity || 0, lostQuantity || 0, unitId, existing[0].id]
            );
            const [updated] = await pool.query("SELECT * FROM tool_stock WHERE id = ?", [existing[0].id]);
            return res.json(updated[0]);
        }
        const [result] = await pool.query(
            `INSERT INTO tool_stock (toolId, locationId, availableQuantity, assignedQuantity, damagedQuantity, lostQuantity, unitId)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [toolId, locationId, availableQuantity || 0, assignedQuantity || 0, damagedQuantity || 0, lostQuantity || 0, unitId]
        );
        const [newStock] = await pool.query("SELECT * FROM tool_stock WHERE id = ?", [result.insertId]);
        res.status(201).json(newStock[0]);
    } catch (error) {
        console.error("Error updating tool stock:", error);
        res.status(500).json({ message: "Error updating tool stock", error: error.message });
    }
});

router.put("/stock/:id", async (req, res) => {
    try {
        const { availableQuantity, assignedQuantity, damagedQuantity, lostQuantity, unitId } = req.body;
        const [result] = await pool.query(
            "UPDATE tool_stock SET availableQuantity = ?, assignedQuantity = ?, damagedQuantity = ?, lostQuantity = ?, unitId = ? WHERE id = ?",
            [availableQuantity !== undefined ? availableQuantity : 0, assignedQuantity !== undefined ? assignedQuantity : 0,
             damagedQuantity !== undefined ? damagedQuantity : 0, lostQuantity !== undefined ? lostQuantity : 0, unitId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Tool stock row not found" });
        }
        const [updatedStock] = await pool.query("SELECT * FROM tool_stock WHERE id = ?", [req.params.id]);
        res.json(updatedStock[0]);
    } catch (error) {
        console.error("Error updating tool stock row:", error);
        res.status(500).json({ message: "Error updating tool stock row", error: error.message });
    }
});

export default router;