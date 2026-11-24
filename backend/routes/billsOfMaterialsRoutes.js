import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";
import {
    duplicateError,
    generateDocumentNumber,
    httpError,
    sendError,
    toNullable,
} from "../utils/production.js";

const router = express.Router();

router.use(authMiddleware);

const DETAIL_QUERY = `
    SELECT bom.*, fp.name AS finishedProductName, fp.sku AS finishedProductSku,
           u.name AS outputUnitName, u.symbol AS outputUnitSymbol
    FROM bills_of_materials bom
    JOIN finished_products fp ON bom.finishedProductId = fp.id
    LEFT JOIN inventory_units u ON bom.outputUnitId = u.id
`;

const ITEM_QUERY = `
    SELECT bi.*, rm.name AS rawMaterialName, rm.sku,
           u.name AS unitName, u.symbol AS unitSymbol
    FROM bom_items bi
    JOIN raw_materials rm ON bi.rawMaterialId = rm.id
    LEFT JOIN inventory_units u ON bi.unitId = u.id
`;

function normalizeItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        throw httpError(400, "At least one BOM item is required");
    }
    const seen = new Set();
    const normalized = items.map((item) => {
        if (!item.rawMaterialId || !item.requiredQuantity || !item.unitId) {
            throw httpError(400, "Every BOM item needs a material, quantity and unit");
        }
        if (seen.has(String(item.rawMaterialId))) {
            throw httpError(400, "A material can only appear once in a BOM");
        }
        seen.add(String(item.rawMaterialId));
        return {
            rawMaterialId: item.rawMaterialId,
            requiredQuantity: item.requiredQuantity,
            unitId: item.unitId,
            wastagePercentage: item.wastagePercentage === undefined || item.wastagePercentage === ""
                ? 0
                : item.wastagePercentage,
        };
    });
    return normalized;
}

async function insertItems(db, bomId, items) {
    for (const item of items) {
        await db.query(
            `INSERT INTO bom_items
                (bomId, rawMaterialId, requiredQuantity, unitId, wastagePercentage)
             VALUES (?, ?, ?, ?, ?)`,
            [bomId, item.rawMaterialId, item.requiredQuantity, item.unitId, item.wastagePercentage]
        );
    }
}

async function deactivateOtherVersions(db, finishedProductId, keepId = null) {
    if (keepId) {
        await db.query(
            `UPDATE bills_of_materials SET isActive = 0
             WHERE finishedProductId = ? AND isActive = 1 AND id <> ?`,
            [finishedProductId, keepId]
        );
    } else {
        await db.query(
            "UPDATE bills_of_materials SET isActive = 0 WHERE finishedProductId = ? AND isActive = 1",
            [finishedProductId]
        );
    }
}

router.get("/", async (req, res) => {
    try {
        const { finishedProductId, isActive, search } = req.query;
        let query = `${DETAIL_QUERY} WHERE bom.deletedAt IS NULL`;
        const params = [];
        if (finishedProductId) { query += " AND bom.finishedProductId = ?"; params.push(finishedProductId); }
        if (isActive !== undefined) { query += " AND bom.isActive = ?"; params.push(Number(isActive)); }
        if (search) {
            query += " AND (bom.name LIKE ? OR bom.bomNumber LIKE ? OR fp.name LIKE ?)";
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }
        query += " ORDER BY fp.name, bom.versionNumber DESC";
        const [boms] = await pool.query(query, params);
        res.json(boms);
    } catch (error) {
        sendError(res, "fetching bills of materials", error);
    }
});

router.get("/active/:finishedProductId", async (req, res) => {
    try {
        const [boms] = await pool.query(
            `${DETAIL_QUERY}
             WHERE bom.finishedProductId = ? AND bom.isActive = 1 AND bom.deletedAt IS NULL
             ORDER BY bom.versionNumber DESC LIMIT 1`,
            [req.params.finishedProductId]
        );
        if (boms.length === 0) {
            return res.status(404).json({ message: "No active BOM for this product" });
        }
        const [items] = await pool.query(
            `${ITEM_QUERY} WHERE bi.bomId = ? ORDER BY bi.id`,
            [boms[0].id]
        );
        boms[0].items = items;
        res.json(boms[0]);
    } catch (error) {
        sendError(res, "fetching active BOM", error);
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [boms] = await pool.query(
            `${DETAIL_QUERY} WHERE bom.id = ? AND bom.deletedAt IS NULL`,
            [req.params.id]
        );
        if (boms.length === 0) {
            return res.status(404).json({ message: "Bill of materials not found" });
        }
        const [items] = await pool.query(
            `${ITEM_QUERY} WHERE bi.bomId = ? ORDER BY bi.id`,
            [req.params.id]
        );
        boms[0].items = items;
        res.json(boms[0]);
    } catch (error) {
        sendError(res, "fetching bill of materials", error);
    }
});

router.post("/", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const {
            finishedProductId, name, outputQuantity, outputUnitId, items,
        } = req.body;
        if (!finishedProductId || !name || !outputUnitId) {
            throw httpError(400, "finishedProductId, name and outputUnitId are required");
        }
        const normalizedItems = normalizeItems(items);

        await connection.beginTransaction();

        const [[versionRow]] = await connection.query(
            `SELECT COALESCE(MAX(versionNumber), 0) + 1 AS nextVersion
             FROM bills_of_materials WHERE finishedProductId = ?`,
            [finishedProductId]
        );

        const bomNumber = await generateDocumentNumber(connection, {
            table: "bills_of_materials",
            column: "bomNumber",
            prefix: "BOM-",
        });

        await deactivateOtherVersions(connection, finishedProductId);

        const [result] = await connection.query(
            `INSERT INTO bills_of_materials
                (bomNumber, finishedProductId, name, outputQuantity, outputUnitId, versionNumber, isActive)
             VALUES (?, ?, ?, ?, ?, ?, 1)`,
            [
                bomNumber,
                finishedProductId,
                name,
                outputQuantity === undefined || outputQuantity === "" ? 1 : outputQuantity,
                outputUnitId,
                versionRow.nextVersion,
            ]
        );
        await insertItems(connection, result.insertId, normalizedItems);
        await connection.commit();

        const [created] = await pool.query(`${DETAIL_QUERY} WHERE bom.id = ?`, [result.insertId]);
        const [createdItems] = await pool.query(`${ITEM_QUERY} WHERE bi.bomId = ? ORDER BY bi.id`, [result.insertId]);
        created[0].items = createdItems;
        res.status(201).json(created[0]);
    } catch (error) {
        await connection.rollback();
        duplicateError(res, error, "BOM number already exists");
    } finally {
        connection.release();
    }
});

router.put("/:id", async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { name, outputQuantity, outputUnitId, isActive, items } = req.body;
        const [existing] = await connection.query(
            "SELECT finishedProductId FROM bills_of_materials WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (existing.length === 0) {
            throw httpError(404, "Bill of materials not found");
        }
        const normalizedItems = items === undefined ? null : normalizeItems(items);

        await connection.beginTransaction();

        await connection.query(
            `UPDATE bills_of_materials
             SET name = ?, outputQuantity = ?, outputUnitId = ?, isActive = ?
             WHERE id = ?`,
            [
                name,
                outputQuantity === undefined || outputQuantity === "" ? 1 : outputQuantity,
                outputUnitId,
                isActive === undefined ? 1 : Number(isActive),
                req.params.id,
            ]
        );

        if (Number(isActive) === 1) {
            await deactivateOtherVersions(connection, existing[0].finishedProductId, req.params.id);
        }

        if (normalizedItems) {
            await connection.query("DELETE FROM bom_items WHERE bomId = ?", [req.params.id]);
            await insertItems(connection, req.params.id, normalizedItems);
        }

        await connection.commit();

        const [updated] = await pool.query(`${DETAIL_QUERY} WHERE bom.id = ?`, [req.params.id]);
        const [updatedItems] = await pool.query(`${ITEM_QUERY} WHERE bi.bomId = ? ORDER BY bi.id`, [req.params.id]);
        updated[0].items = updatedItems;
        res.json(updated[0]);
    } catch (error) {
        await connection.rollback();
        duplicateError(res, error, "BOM could not be updated");
    } finally {
        connection.release();
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "UPDATE bills_of_materials SET deletedAt = NOW(), isActive = 0 WHERE id = ? AND deletedAt IS NULL",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(404, "Bill of materials not found");
        }
        res.json({ message: "Bill of materials deleted successfully" });
    } catch (error) {
        sendError(res, "deleting bill of materials", error);
    }
});

router.post("/:id/items", async (req, res) => {
    try {
        const { rawMaterialId, requiredQuantity, unitId, wastagePercentage } = req.body;
        if (!rawMaterialId || !requiredQuantity || !unitId) {
            throw httpError(400, "rawMaterialId, requiredQuantity and unitId are required");
        }
        const [result] = await pool.query(
            `INSERT INTO bom_items (bomId, rawMaterialId, requiredQuantity, unitId, wastagePercentage)
             VALUES (?, ?, ?, ?, ?)`,
            [req.params.id, rawMaterialId, requiredQuantity, unitId, wastagePercentage || 0]
        );
        const [created] = await pool.query(`${ITEM_QUERY} WHERE bi.id = ?`, [result.insertId]);
        res.status(201).json(created[0]);
    } catch (error) {
        duplicateError(res, error, "This material is already in the BOM");
    }
});

router.put("/:id/items/:itemId", async (req, res) => {
    try {
        const { rawMaterialId, requiredQuantity, unitId, wastagePercentage } = req.body;
        const [result] = await pool.query(
            `UPDATE bom_items
             SET rawMaterialId = ?, requiredQuantity = ?, unitId = ?, wastagePercentage = ?
             WHERE id = ? AND bomId = ?`,
            [rawMaterialId, requiredQuantity, unitId, wastagePercentage || 0, req.params.itemId, req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(404, "BOM item not found");
        }
        const [updated] = await pool.query(`${ITEM_QUERY} WHERE bi.id = ?`, [req.params.itemId]);
        res.json(updated[0]);
    } catch (error) {
        duplicateError(res, error, "This material is already in the BOM");
    }
});

router.delete("/:id/items/:itemId", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM bom_items WHERE id = ? AND bomId = ?",
            [req.params.itemId, req.params.id]
        );
        if (result.affectedRows === 0) {
            throw httpError(404, "BOM item not found");
        }
        res.json({ message: "BOM item deleted successfully" });
    } catch (error) {
        sendError(res, "deleting BOM item", error);
    }
});

export default router;
