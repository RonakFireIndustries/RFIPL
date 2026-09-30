import express from "express";
import { pool } from "../config/db.js";
import { authMiddleware } from "../config/auth.js";

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
    try {
        const { payrollPeriodId, employeeId, status } = req.query;
        let query = `SELECT p.*, pp.name AS periodName, e.firstName, e.lastName, e.employeeCode
                     FROM payrolls p
                     LEFT JOIN payroll_periods pp ON p.payrollPeriodId = pp.id
                     LEFT JOIN employees e ON p.employeeId = e.id
                     WHERE 1=1`;
        const params = [];
        if (payrollPeriodId) { query += " AND p.payrollPeriodId = ?"; params.push(payrollPeriodId); }
        if (employeeId) { query += " AND p.employeeId = ?"; params.push(employeeId); }
        if (status) { query += " AND p.status = ?"; params.push(status); }
        query += " ORDER BY p.createdAt DESC";
        const [payrolls] = await pool.query(query, params);
        res.json(payrolls);
    } catch (error) {
        console.error("Error fetching payrolls:", error);
        res.status(500).json({ message: "Error fetching payrolls", error: error.message });
    }
});

router.post("/generate", async (req, res) => {
    try {
        const { payrollPeriodId, employeeId } = req.body;
        if (!payrollPeriodId || !employeeId) {
            return res.status(400).json({ message: "payrollPeriodId and employeeId are required" });
        }

        const [periods] = await pool.query("SELECT * FROM payroll_periods WHERE id = ?", [payrollPeriodId]);
        if (periods.length === 0) {
            return res.status(404).json({ message: "Payroll period not found" });
        }
        const period = periods[0];

        const [existing] = await pool.query(
            "SELECT id FROM payrolls WHERE payrollPeriodId = ? AND employeeId = ?",
            [payrollPeriodId, employeeId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ message: "Payroll already exists for this employee in this period" });
        }

        const [assignments] = await pool.query(
            `SELECT ess.salaryStructureId FROM employee_salary_structures ess
             WHERE ess.employeeId = ? AND ess.status = 'active'
               AND ess.effectiveFrom <= ? AND (ess.effectiveTo IS NULL OR ess.effectiveTo >= ?)
             ORDER BY ess.effectiveFrom DESC LIMIT 1`,
            [employeeId, period.endDate, period.endDate]
        );
        if (assignments.length === 0) {
            return res.status(400).json({ message: "No active salary structure assigned to this employee for this period." });
        }
        const salaryStructureId = assignments[0].salaryStructureId;

        const [components] = await pool.query(
            `SELECT ssc.calculationType AS structureCalcType, ssc.amount, ssc.percentage, ssc.formulaExpression, ssc.sortOrder,
                    sc.id AS salaryComponentId, sc.name AS componentName, sc.code AS componentCode, sc.componentType
             FROM salary_structure_components ssc
             JOIN salary_components sc ON ssc.salaryComponentId = sc.id
             WHERE ssc.salaryStructureId = ? AND sc.isActive = 1
             ORDER BY ssc.sortOrder, sc.id`,
            [salaryStructureId]
        );
        if (components.length === 0) {
            return res.status(400).json({ message: "Salary structure has no components configured." });
        }

        const computed = [];
        const computedByCode = {};

        const fixedEarnings = components
            .filter((c) => c.componentType === "earning")
            .reduce((sum, c) => {
                if (c.structureCalcType === "fixed") {
                    if (!isNaN(Number(c.amount))) {
                        const val = Math.round(Number(c.amount) * 100) / 100;
                        computedByCode[c.componentCode] = val;
                        computed.push({ ...c, calculatedAmount: val });
                        return sum + val;
                    }
                }
                if (c.structureCalcType === "manual") {
                    const val = !isNaN(Number(c.amount)) ? Math.round(Number(c.amount) * 100) / 100 : 0;
                    computedByCode[c.componentCode] = val;
                    computed.push({ ...c, calculatedAmount: val });
                    return sum + val;
                }
                return sum;
            }, 0);

        for (const comp of components) {
            if (computed.find((x) => x.salaryComponentId === comp.salaryComponentId)) continue;
            if (comp.structureCalcType === "percentage") {
                const pct = Number(comp.percentage);
                const val = !isNaN(pct) ? Math.round((pct / 100) * fixedEarnings * 100) / 100 : 0;
                computedByCode[comp.componentCode] = val;
                computed.push({ ...comp, calculatedAmount: val, calcBase: fixedEarnings });
            } else if (comp.structureCalcType === "formula") {
                const val = evaluateSalaryFormula(comp.formulaExpression, computedByCode);
                computedByCode[comp.componentCode] = val;
                computed.push({ ...comp, calculatedAmount: val });
            }
        }

        let grossEarnings = 0;
        let totalDeductions = 0;
        for (const comp of computed) {
            if (comp.componentType === "earning") grossEarnings += comp.calculatedAmount;
            else totalDeductions += comp.calculatedAmount;
        }
        grossEarnings = Math.round(grossEarnings * 100) / 100;
        totalDeductions = Math.round(totalDeductions * 100) / 100;

        let bonusIncentiveAmount = 0;
        const [bonuses] = await pool.query(
            `SELECT id, amount FROM bonus_incentives
             WHERE employeeId = ? AND status = 'approved'
               AND applicableMonth BETWEEN ? AND ?`,
            [employeeId, period.startDate, period.endDate]
        );
        bonusIncentiveAmount = bonuses.reduce((sum, b) => sum + Number(b.amount), 0);

        let overtimeMinutes = 0;
        let overtimeAmount = 0;
        const [overtimes] = await pool.query(
            `SELECT id, overtimeMinutes, amount FROM overtime_records
             WHERE employeeId = ? AND status = 'approved'
               AND overtimeDate BETWEEN ? AND ?`,
            [employeeId, period.startDate, period.endDate]
        );
        for (const ot of overtimes) {
            overtimeMinutes += Number(ot.overtimeMinutes || 0);
            overtimeAmount += Number(ot.amount || 0);
        }

        const totalCalendarDays = daysInPeriod(period.startDate, period.endDate);
        const netSalary = Math.round((grossEarnings + overtimeAmount + bonusIncentiveAmount - totalDeductions) * 100) / 100;

        const [result] = await pool.query(
            `INSERT INTO payrolls (payrollPeriodId, employeeId, totalCalendarDays, payableDays, overtimeMinutes,
                grossEarnings, totalDeductions, overtimeAmount, bonusIncentiveAmount, netSalary, status, generatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated', NOW())`,
            [payrollPeriodId, employeeId, totalCalendarDays, totalCalendarDays, overtimeMinutes,
                grossEarnings, totalDeductions, overtimeAmount, bonusIncentiveAmount, netSalary]
        );
        const payrollId = result.insertId;

        for (const comp of computed) {
            const details = comp.calcBase !== undefined ? { baseFixedEarnings: comp.calcBase, percentage: comp.percentage } : null;
            await pool.query(
                `INSERT INTO payroll_items (payrollId, salaryComponentId, componentName, componentCode, componentType, calculatedAmount, calculationDetails)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [payrollId, comp.salaryComponentId, comp.componentName, comp.componentCode, comp.componentType, comp.calculatedAmount,
                    details ? JSON.stringify(details) : null]
            );
        }

        if (bonuses.length > 0) {
            await pool.query(
                "UPDATE bonus_incentives SET status = 'included_in_payroll', payrollId = ? WHERE id IN (?)",
                [payrollId, bonuses.map((b) => b.id)]
            );
        }
        if (overtimes.length > 0) {
            await pool.query(
                "UPDATE overtime_records SET status = 'included_in_payroll', payrollId = ? WHERE id IN (?)",
                [payrollId, overtimes.map((o) => o.id)]
            );
        }

        const [payrolls] = await pool.query(
            `SELECT p.*, pp.name AS periodName, e.firstName, e.lastName, e.employeeCode
             FROM payrolls p
             LEFT JOIN payroll_periods pp ON p.payrollPeriodId = pp.id
             LEFT JOIN employees e ON p.employeeId = e.id
             WHERE p.id = ?`,
            [payrollId]
        );
        const [items] = await pool.query(
            "SELECT * FROM payroll_items WHERE payrollId = ? ORDER BY componentType, componentName",
            [payrollId]
        );
        if (payrolls.length > 0) payrolls[0].items = items;

        res.status(201).json(payrolls[0]);
    } catch (error) {
        console.error("Error generating payroll:", error);
        res.status(500).json({ message: "Error generating payroll", error: error.message });
    }
});

router.get("/:id", async (req, res) => {
    try {
        const [payrolls] = await pool.query(
            `SELECT p.*, pp.name AS periodName, e.firstName, e.lastName, e.employeeCode
             FROM payrolls p
             LEFT JOIN payroll_periods pp ON p.payrollPeriodId = pp.id
             LEFT JOIN employees e ON p.employeeId = e.id
             WHERE p.id = ?`,
            [req.params.id]
        );
        if (payrolls.length === 0) {
            return res.status(404).json({ message: "Payroll not found" });
        }
        const [items] = await pool.query(
            "SELECT * FROM payroll_items WHERE payrollId = ? ORDER BY componentType, componentName",
            [req.params.id]
        );
        payrolls[0].items = items;
        res.json(payrolls[0]);
    } catch (error) {
        console.error("Error fetching payroll:", error);
        res.status(500).json({ message: "Error fetching payroll", error: error.message });
    }
});

router.post("/", async (req, res) => {
    try {
        const { payrollPeriodId, employeeId, totalCalendarDays, payableDays, absentDays, halfDays, paidLeaveDays, lateHalfDayDeductions, lateFullDayDeductions, overtimeMinutes, grossEarnings, totalDeductions, overtimeAmount, bonusIncentiveAmount, netSalary } = req.body;
        const [result] = await pool.query(
            `INSERT INTO payrolls (payrollPeriodId, employeeId, totalCalendarDays, payableDays, absentDays, halfDays, paidLeaveDays, lateHalfDayDeductions, lateFullDayDeductions, overtimeMinutes, grossEarnings, totalDeductions, overtimeAmount, bonusIncentiveAmount, netSalary)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [payrollPeriodId, employeeId, totalCalendarDays, payableDays, absentDays || 0, halfDays || 0, paidLeaveDays || 0, lateHalfDayDeductions || 0, lateFullDayDeductions || 0, overtimeMinutes || 0, grossEarnings || 0, totalDeductions || 0, overtimeAmount || 0, bonusIncentiveAmount || 0, netSalary || 0]
        );
        const [newPayroll] = await pool.query("SELECT * FROM payrolls WHERE id = ?", [result.insertId]);
        res.status(201).json(newPayroll[0]);
    } catch (error) {
        console.error("Error creating payroll:", error);
        if (error.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Payroll already exists for this employee in this period" });
        }
        res.status(500).json({ message: "Error creating payroll", error: error.message });
    }
});

router.post("/:id/items", async (req, res) => {
    try {
        const { componentName, componentCode, componentType, calculatedAmount } = req.body;
        const [result] = await pool.query(
            `INSERT INTO payroll_items (payrollId, componentName, componentCode, componentType, calculatedAmount)
             VALUES (?, ?, ?, ?, ?)`,
            [req.params.id, componentName, componentCode || null, componentType, calculatedAmount]
        );
        const [newItem] = await pool.query("SELECT * FROM payroll_items WHERE id = ?", [result.insertId]);
        res.status(201).json(newItem[0]);
    } catch (error) {
        console.error("Error adding payroll item:", error);
        res.status(500).json({ message: "Error adding payroll item", error: error.message });
    }
});

router.get("/:id/items", async (req, res) => {
    try {
        const [items] = await pool.query(
            "SELECT * FROM payroll_items WHERE payrollId = ?",
            [req.params.id]
        );
        res.json(items);
    } catch (error) {
        console.error("Error fetching payroll items:", error);
        res.status(500).json({ message: "Error fetching payroll items", error: error.message });
    }
});

router.delete("/:id/items/:itemId", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM payroll_items WHERE payrollId = ? AND id = ?",
            [req.params.id, req.params.itemId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Payroll item not found" });
        }
        res.json({ message: "Payroll item deleted successfully" });
    } catch (error) {
        console.error("Error deleting payroll item:", error);
        res.status(500).json({ message: "Error deleting payroll item", error: error.message });
    }
});

router.patch("/:id/status", async (req, res) => {
    try {
        const { status } = req.body;
        let extra = "";
        if (status === "locked") {
            extra = ", lockedAt = NOW()";
        }
        const [result] = await pool.query(
            `UPDATE payrolls SET status = ?${extra} WHERE id = ?`,
            [status, req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Payroll not found" });
        }
        const [updatedPayroll] = await pool.query("SELECT * FROM payrolls WHERE id = ?", [req.params.id]);
        res.json(updatedPayroll[0]);
    } catch (error) {
        console.error("Error updating payroll status:", error);
        res.status(500).json({ message: "Error updating payroll status", error: error.message });
    }
});

router.delete("/:id", async (req, res) => {
    try {
        const [result] = await pool.query(
            "DELETE FROM payrolls WHERE id = ? AND status = 'generated'",
            [req.params.id]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: "Payroll not found or cannot be deleted" });
        }
        res.json({ message: "Payroll deleted successfully" });
    } catch (error) {
        console.error("Error deleting payroll:", error);
        res.status(500).json({ message: "Error deleting payroll", error: error.message });
    }
});

function daysInPeriod(startDate, endDate) {
    const start = new Date(`${String(startDate).slice(0, 10)}T00:00:00`);
    const end = new Date(`${String(endDate).slice(0, 10)}T00:00:00`);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 30;
    return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function evaluateSalaryFormula(expression, lookup) {
    if (!expression) return 0;
    let expr = String(expression);
    expr = expr.replace(/\b[A-Za-z_][A-Za-z0-9_]*\b/g, (token) => {
        const val = lookup[token];
        return `(${Number(val) || 0})`;
    });
    expr = expr.replace(/[^0-9+\-*/().\s]/g, "");
    if (!expr.trim()) return 0;
    try {
        const result = new Function(`return (${expr})`)();
        return isFinite(result) ? Math.round(result * 100) / 100 : 0;
    } catch {
        return 0;
    }
}

export default router;
