import express from "express";
import { pool } from "../config/db.js";

const router = express.Router();

router.get("/employee/:employeeId", async (req, res) => {
    try {
        const [contacts] = await pool.query(
            "SELECT * FROM employee_emergency_contacts WHERE employeeId = ?",
            [req.params.employeeId]
        );
        res.json(contacts);
    } catch (error) {
        console.error("Error fetching emergency contacts:", error);
        res.status(500).json({ message: "Error fetching emergency contacts", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [contacts] = await pool.query(
            "SELECT * FROM employee_emergency_contacts WHERE id = ?",
            [req.params.id]
        );
        if (contacts.length === 0) {
            return res.status(404).json({ message: "Emergency contact not found" });
        }
        res.json(contacts[0]);
    } catch (error) {
        console.error("Error fetching emergency contact:", error);
        res.status(500).json({ message: "Error fetching emergency contact", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { employeeId, name, relationship, phone } = req.body;
        const [result] = await pool.query(
            "INSERT INTO employee_emergency_contacts (employeeId, name, relationship, phone) VALUES (?, ?, ?, ?)",
            [employeeId, name, relationship, phone]
        );
        const [newContact] = await pool.query("SELECT * FROM employee_emergency_contacts WHERE id = ?", [result.insertId]);
        res.status(201).json(newContact[0]);
    } catch (error) {
        console.error("Error creating emergency contact:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Emergency contact already exists for this employee" });
        }
        res.status(500).json({ message: "Error creating emergency contact", error: error.message });
    }
});

router.put("/:id", async (req, res) => {
    try {
        const { name, relationship, phone } = req.body;
        const [result] = await pool.query(
            "UPDATE employee_emergency_contacts SET name = ?, relationship = ?, phone = ? WHERE id = ?",
            [name, relationship, phone, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Emergency contact not found" });
        }
        const [updatedContact] = await pool.query("SELECT * FROM employee_emergency_contacts WHERE id = ?", [req.params.id]);
        res.json(updatedContact[0]);
    } catch (error) {
        console.error("Error updating emergency contact:", error);
        res.status(500).json({ message: "Error updating emergency contact", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM employee_emergency_contacts WHERE id = ?",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Emergency contact not found" });
        }
        res.json({ message: "Emergency contact deleted successfully" });
    } catch (error) {
        console.error("Error deleting emergency contact:", error);
        res.status(500).json({ message: "Error deleting emergency contact", error: error.message });
    }
});

export default router;
