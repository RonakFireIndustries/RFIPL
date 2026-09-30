import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM work_locations ORDER BY id DESC"
        );
        res.json(rows);
    } catch (error) {
        console.error("Error fetching work locations:", error);
        res.status(500).json({ message: "Error fetching work locations", error: error.message });
    }
});

router.get("/active", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM work_locations WHERE isActive = 1 AND geofenceEnabled = 1 ORDER BY id DESC LIMIT 1"
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: "No active geofenced work location found" });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error("Error fetching active work location:", error);
        res.status(500).json({ message: "Error fetching active work location", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [rows] = await pool.query(
            "SELECT * FROM work_locations WHERE id = ?",
            [req.params.id]
        );
        if (rows.length === 0) {
            return res.status(404).json({ message: "Work location not found" });
        }
        res.json(rows[0]);
    } catch (error) {
        console.error("Error fetching work location:", error);
        res.status(500).json({ message: "Error fetching work location", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const {
            name, address, latitude, longitude,
            radiusMeters, accuracyThresholdMeters, geofenceEnabled, isActive
        } = req.body;
        if (!name || latitude === undefined || longitude === undefined) {
            return res.status(400).json({ message: "Name and coordinates are required" });
        }
        const lat = Number(latitude);
        const lng = Number(longitude);
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ message: "Invalid coordinates" });
        }
        const radius = Math.max(10, Number(radiusMeters) || 100);
        const [result] = await pool.query(
            `INSERT INTO work_locations
                (name, address, latitude, longitude, radiusMeters, accuracyThresholdMeters, geofenceEnabled, isActive)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, address || null, lat, lng, radius,
                Number(accuracyThresholdMeters) || 50,
                geofenceEnabled !== undefined ? geofenceEnabled : true,
                isActive !== undefined ? isActive : true
            ]
        );
        const [rows] = await pool.query("SELECT * FROM work_locations WHERE id = ?", [result.insertId]);
        if (isActive !== undefined && !!isActive) {
            await pool.query("UPDATE work_locations SET isActive = 0 WHERE id <> ?", [result.insertId]);
        }
        const [finalRows] = await pool.query("SELECT * FROM work_locations WHERE id = ?", [result.insertId]);
        res.status(201).json(finalRows[0]);
    } catch (error) {
        console.error("Error creating work location:", error);
        res.status(500).json({ message: "Error creating work location", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const {
            name, address, latitude, longitude,
            radiusMeters, accuracyThresholdMeters, geofenceEnabled, isActive
        } = req.body;
        const [existing] = await pool.query(
            "SELECT * FROM work_locations WHERE id = ?",
            [req.params.id]
        );
        if (existing.length === 0) {
            return res.status(404).json({ message: "Work location not found" });
        }
        const lat = latitude !== undefined ? Number(latitude) : Number(existing[0].latitude);
        const lng = longitude !== undefined ? Number(longitude) : Number(existing[0].longitude);
        if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return res.status(400).json({ message: "Invalid coordinates" });
        }
        await pool.query(
            `UPDATE work_locations SET
                name = ?, address = ?, latitude = ?, longitude = ?,
                radiusMeters = ?, accuracyThresholdMeters = ?, geofenceEnabled = ?, isActive = ?
             WHERE id = ?`,
            [
                name !== undefined ? name : existing[0].name,
                address !== undefined ? address : existing[0].address,
                lat, lng,
                radiusMeters !== undefined ? Math.max(10, Number(radiusMeters)) : existing[0].radiusMeters,
                accuracyThresholdMeters !== undefined ? Number(accuracyThresholdMeters) : existing[0].accuracyThresholdMeters,
                geofenceEnabled !== undefined ? geofenceEnabled : existing[0].geofenceEnabled,
                isActive !== undefined ? isActive : existing[0].isActive,
                req.params.id
            ]
        );
        if (isActive !== undefined && !!isActive) {
            await pool.query("UPDATE work_locations SET isActive = 0 WHERE id <> ?", [req.params.id]);
        }
        const [rows] = await pool.query("SELECT * FROM work_locations WHERE id = ?", [req.params.id]);
        res.json(rows[0]);
    } catch (error) {
        console.error("Error updating work location:", error);
        res.status(500).json({ message: "Error updating work location", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM work_locations WHERE id = ?",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Work location not found" });
        }
        res.json({ message: "Work location deleted successfully" });
    } catch (error) {
        console.error("Error deleting work location:", error);
        res.status(500).json({ message: "Error deleting work location", error: error.message });
    }
});

export default router;