import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { categoryId, isActive, search } = req.query;
        let query = `SELECT rm.*, c.name AS categoryName, u.name AS unitName, u.symbol AS unitSymbol
                     FROM raw_materials rm
                     LEFT JOIN inventory_categories c ON rm.categoryId = c.id
                     LEFT JOIN inventory_units u ON rm.unitId = u.id
                     WHERE rm.deletedAt IS NULL`;
        const params = [];
        if (categoryId) { query += " AND rm.categoryId = ?"; params.push(categoryId); }
        if (isActive !== undefined) { query += " AND rm.isActive = ?"; params.push(Number(isActive)); }
        if (search) { query += " AND (rm.name LIKE ? OR rm.sku LIKE ?)"; params.push(`%${search}%`, `%${search}%`); }
        query += " ORDER BY rm.name";
        const [materials] = await pool.query(query, params);
        res.json(materials);
    } catch (error) {
        console.error("Error fetching raw materials:", error);
        res.status(500).json({ message: "Error fetching raw materials", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [materials] = await pool.query(
            `SELECT rm.*, c.name AS categoryName, u.name AS unitName, u.symbol AS unitSymbol
             FROM raw_materials rm
             LEFT JOIN inventory_categories c ON rm.categoryId = c.id
             LEFT JOIN inventory_units u ON rm.unitId = u.id
             WHERE rm.id = ? AND rm.deletedAt IS NULL`,
            [req.params.id]
        );
        if (materials.length === 0) {
            return res.status(404).json({ message: "Raw material not found" });
        }
        const [suppliers] = await pool.query(
            `SELECT rms.*, s.companyName, s.supplierCode
             FROM raw_material_suppliers rms
             JOIN suppliers s ON rms.supplierId = s.id
             WHERE rms.rawMaterialId = ?`,
            [req.params.id]
        );
        materials[0].suppliers = suppliers;
        res.json(materials[0]);
    } catch (error) {
        console.error("Error fetching raw material:", error);
        res.status(500).json({ message: "Error fetching raw material", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { sku, name, categoryId, unitId, description, minimumStockLevel, reorderLevel, defaultPurchasePrice, isActive, suppliers } = req.body;
        const [result] = await pool.query(
            `INSERT INTO raw_materials (sku, name, categoryId, unitId, description, minimumStockLevel, reorderLevel, defaultPurchasePrice, isActive)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sku, name, categoryId || null, unitId, description || null,
             minimumStockLevel !== undefined ? minimumStockLevel : 0,
             reorderLevel !== undefined ? reorderLevel : 0,
             defaultPurchasePrice || null,
             isActive !== undefined ? Number(isActive) : 1]
        );
        if (Array.isArray(suppliers)) {
            for (const s of suppliers) {
                await pool.query(
                    "INSERT INTO raw_material_suppliers (rawMaterialId, supplierId, supplierItemCode, purchasePrice, isPreferred) VALUES (?, ?, ?, ?, ?)",
                    [result.insertId, s.supplierId, s.supplierItemCode || null, s.purchasePrice || null, s.isPreferred ? 1 : 0]
                );
            }
        }
        const [newMaterial] = await pool.query("SELECT * FROM raw_materials WHERE id = ?", [result.insertId]);
        res.status(201).json(newMaterial[0]);
    } catch (error) {
        console.error("Error creating raw material:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Raw material SKU already exists" });
        }
        res.status(500).json({ message: "Error creating raw material", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { sku, name, categoryId, unitId, description, minimumStockLevel, reorderLevel, defaultPurchasePrice, isActive } = req.body;
        const [result] = await pool.query(
            `UPDATE raw_materials SET sku = ?, name = ?, categoryId = ?, unitId = ?, description = ?, minimumStockLevel = ?, reorderLevel = ?, defaultPurchasePrice = ?, isActive = ?
             WHERE id = ? AND deletedAt IS NULL`,
            [sku, name, categoryId || null, unitId, description || null,
             minimumStockLevel !== undefined ? minimumStockLevel : 0,
             reorderLevel !== undefined ? reorderLevel : 0,
             defaultPurchasePrice || null,
             isActive !== undefined ? Number(isActive) : 1,
             req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Raw material not found" });
        }
        const [updatedMaterial] = await pool.query("SELECT * FROM raw_materials WHERE id = ?", [req.params.id]);
        res.json(updatedMaterial[0]);
    } catch (error) {
        console.error("Error updating raw material:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Raw material SKU already exists" });
        }
        res.status(500).json({ message: "Error updating raw material", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE raw_materials SET deletedAt = NOW() WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Raw material not found" });
        }
        res.json({ message: "Raw material deleted successfully" });
    } catch (error) {
        console.error("Error deleting raw material:", error);
        res.status(500).json({ message: "Error deleting raw material", error: error.message });
    }
});

router.get("/:id/suppliers", async (req, res) => {
    try {
        const [suppliers] = await pool.query(
            `SELECT rms.*, s.companyName, s.supplierCode, s.contactPerson, s.phone
             FROM raw_material_suppliers rms
             JOIN suppliers s ON rms.supplierId = s.id
             WHERE rms.rawMaterialId = ?`,
            [req.params.id]
        );
        res.json(suppliers);
    } catch (error) {
        console.error("Error fetching material suppliers:", error);
        res.status(500).json({ message: "Error fetching material suppliers", error: error.message });
    }
});

router.post("/:id/suppliers", async (req, res) => {
    try {
        const { supplierId, supplierItemCode, purchasePrice, isPreferred } = req.body;
        const [result] = await pool.query(
            "INSERT INTO raw_material_suppliers (rawMaterialId, supplierId, supplierItemCode, purchasePrice, isPreferred) VALUES (?, ?, ?, ?, ?)",
            [req.params.id, supplierId, supplierItemCode || null, purchasePrice || null, isPreferred ? 1 : 0]
        );
        if (isPreferred) {
            await pool.query("UPDATE raw_material_suppliers SET isPreferred = 0 WHERE rawMaterialId = ? AND id != ?", [req.params.id, result.insertId]);
        }
        const [newLink] = await pool.query("SELECT * FROM raw_material_suppliers WHERE id = ?", [result.insertId]);
        res.status(201).json(newLink[0]);
    } catch (error) {
        console.error("Error linking supplier:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Supplier already linked to this material" });
        }
        res.status(500).json({ message: "Error linking supplier", error: error.message });
    }
});

router.put("/:id/suppliers/:linkId", async (req, res) => {
    try {
        const { supplierItemCode, purchasePrice, isPreferred } = req.body;
        const [result] = await pool.query(
            "UPDATE raw_material_suppliers SET supplierItemCode = ?, purchasePrice = ?, isPreferred = ? WHERE id = ? AND rawMaterialId = ?",
            [supplierItemCode || null, purchasePrice || null, isPreferred ? 1 : 0, req.params.linkId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Supplier link not found" });
        }
        if (isPreferred) {
            await pool.query("UPDATE raw_material_suppliers SET isPreferred = 0 WHERE rawMaterialId = ? AND id != ?", [req.params.id, req.params.linkId]);
        }
        const [updatedLink] = await pool.query("SELECT * FROM raw_material_suppliers WHERE id = ?", [req.params.linkId]);
        res.json(updatedLink[0]);
    } catch (error) {
        console.error("Error updating supplier link:", error);
        res.status(500).json({ message: "Error updating supplier link", error: error.message });
    }
});

router.delete("/:id/suppliers/:linkId", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM raw_material_suppliers WHERE id = ? AND rawMaterialId = ?",
            [req.params.linkId, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Supplier link not found" });
        }
        res.json({ message: "Supplier link removed successfully" });
    } catch (error) {
        console.error("Error removing supplier link:", error);
        res.status(500).json({ message: "Error removing supplier link", error: error.message });
    }
});

export default router;