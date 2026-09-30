import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const [settings] = await pool.query(
            "SELECT * FROM company_settings ORDER BY id DESC LIMIT 1"
        );
        if (settings.length === 0) {
            return res.status(404).json({ message: "Company settings not found" });
        }
        res.json(settings[0]);
    } catch (error) {
        console.error("Error fetching company settings:", error);
        res.status(500).json({ message: "Error fetching company settings", error: error.message });
    }
});

router.put("/", async (req, res) => {
    try {
        const {
            companyName, logoPath, email, phone, address, gstNumber, panNumber,
            pfRegistrationNumber, esiRegistrationNumber, officeLatitude, officeLongitude,
            attendanceRadiusMeters, currencyCode, currencySymbol, timezone,
            storageProvider, storageConfig
        } = req.body;

        const [existing] = await pool.query(
            "SELECT * FROM company_settings ORDER BY id DESC LIMIT 1"
        );

        if (existing.length === 0) {
            const [result] = await pool.query(
                `INSERT INTO company_settings (
                    companyName, logoPath, email, phone, address, gstNumber, panNumber,
                    pfRegistrationNumber, esiRegistrationNumber, officeLatitude, officeLongitude,
                    attendanceRadiusMeters, currencyCode, currencySymbol, timezone,
                    storageProvider, storageConfig
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    companyName, logoPath || null, email || null, phone || null, address || null,
                    gstNumber || null, panNumber || null, pfRegistrationNumber || null,
                    esiRegistrationNumber || null, officeLatitude || null, officeLongitude || null,
                    attendanceRadiusMeters || 100, currencyCode || "INR", currencySymbol || "₹",
                    timezone || "Asia/Kolkata", storageProvider || "local",
                    storageConfig ? JSON.stringify(storageConfig) : null
                ]
            );
            const [created] = await pool.query("SELECT * FROM company_settings WHERE id = ?", [result.insertId]);
            return res.status(201).json(created[0]);
        }

        const id = existing[0].id;
        await pool.query(
            `UPDATE company_settings SET
                companyName = ?, logoPath = ?, email = ?, phone = ?, address = ?, gstNumber = ?,
                panNumber = ?, pfRegistrationNumber = ?, esiRegistrationNumber = ?,
                officeLatitude = ?, officeLongitude = ?, attendanceRadiusMeters = ?,
                currencyCode = ?, currencySymbol = ?, timezone = ?, storageProvider = ?, storageConfig = ?
            WHERE id = ?`,
            [
                companyName, logoPath || null, email || null, phone || null, address || null,
                gstNumber || null, panNumber || null, pfRegistrationNumber || null,
                esiRegistrationNumber || null, officeLatitude || null, officeLongitude || null,
                attendanceRadiusMeters || 100, currencyCode || "INR", currencySymbol || "₹",
                timezone || "Asia/Kolkata", storageProvider || "local",
                storageConfig ? JSON.stringify(storageConfig) : null, id
            ]
        );
        const [updated] = await pool.query("SELECT * FROM company_settings WHERE id = ?", [id]);
        res.json(updated[0]);
    } catch (error) {
        console.error("Error updating company settings:", error);
        res.status(500).json({ message: "Error updating company settings", error: error.message });
    }
});

export default router;
