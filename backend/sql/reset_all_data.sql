-- ============================================================
-- RFIPL - FULL DATABASE RESET (DESTRUCTIVE)
-- ------------------------------------------------------------
-- Schema: a17590e4_rfipl
-- Wipes every row in every table (100 tables), then seeds only:
--   * Role : Super Admin
--   * User : admin@rfipl.com / Admin@12345 (bcrypt hash, cost 10)
--   * Link : admin user -> Super Admin role
--
-- WARNING: This deletes ALL data. No backup was taken.
-- Run only against the intended database.
--
-- Usage (phpMyAdmin: Import this file) or:
--   mysql -h <host> -u <user> -p <database> < reset_all_data.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE attendance_corrections;
TRUNCATE TABLE attendance_records;
TRUNCATE TABLE attendance_rules;
TRUNCATE TABLE audit_logs;
TRUNCATE TABLE bills_of_materials;
TRUNCATE TABLE bom_items;
TRUNCATE TABLE bonus_incentives;
TRUNCATE TABLE company_settings;
TRUNCATE TABLE customers;
TRUNCATE TABLE customer_payments;
TRUNCATE TABLE customer_returns;
TRUNCATE TABLE customer_return_items;
TRUNCATE TABLE daily_reports;
TRUNCATE TABLE daily_report_reviews;
TRUNCATE TABLE departments;
TRUNCATE TABLE designations;
TRUNCATE TABLE dispatches;
TRUNCATE TABLE dispatch_items;
TRUNCATE TABLE employees;
TRUNCATE TABLE employee_bank_details;
TRUNCATE TABLE employee_documents;
TRUNCATE TABLE employee_emergency_contacts;
TRUNCATE TABLE employee_kpis;
TRUNCATE TABLE employee_overtime_rates;
TRUNCATE TABLE employee_salary_structures;
TRUNCATE TABLE employee_shift_assignments;
TRUNCATE TABLE expense_approvals;
TRUNCATE TABLE expense_attachments;
TRUNCATE TABLE expense_categories;
TRUNCATE TABLE expense_claims;
TRUNCATE TABLE finished_products;
TRUNCATE TABLE finished_product_batches;
TRUNCATE TABLE finished_product_stock;
TRUNCATE TABLE finished_product_stock_ledger;
TRUNCATE TABLE goods_receipts;
TRUNCATE TABLE goods_receipt_items;
TRUNCATE TABLE holidays;
TRUNCATE TABLE inventory_categories;
TRUNCATE TABLE inventory_damage_loss_reports;
TRUNCATE TABLE inventory_notification_rules;
TRUNCATE TABLE inventory_units;
TRUNCATE TABLE invoices;
TRUNCATE TABLE invoice_items;
TRUNCATE TABLE kpis;
TRUNCATE TABLE leave_balances;
TRUNCATE TABLE leave_requests;
TRUNCATE TABLE leave_types;
TRUNCATE TABLE machines;
TRUNCATE TABLE machine_breakdowns;
TRUNCATE TABLE notifications;
TRUNCATE TABLE overtime_records;
TRUNCATE TABLE password_reset_tokens;
TRUNCATE TABLE payrolls;
TRUNCATE TABLE payroll_approvals;
TRUNCATE TABLE payroll_items;
TRUNCATE TABLE payroll_periods;
TRUNCATE TABLE payslips;
TRUNCATE TABLE performance_reviews;
TRUNCATE TABLE performance_review_cycles;
TRUNCATE TABLE permissions;
TRUNCATE TABLE production_consumptions;
TRUNCATE TABLE production_orders;
TRUNCATE TABLE production_outputs;
TRUNCATE TABLE production_wastage;
TRUNCATE TABLE purchase_orders;
TRUNCATE TABLE purchase_order_items;
TRUNCATE TABLE purchase_requests;
TRUNCATE TABLE purchase_request_items;
TRUNCATE TABLE quality_inspections;
TRUNCATE TABLE rating_scales;
TRUNCATE TABLE raw_materials;
TRUNCATE TABLE raw_material_batches;
TRUNCATE TABLE raw_material_stock;
TRUNCATE TABLE raw_material_stock_ledger;
TRUNCATE TABLE raw_material_suppliers;
TRUNCATE TABLE refresh_tokens;
TRUNCATE TABLE roles;
TRUNCATE TABLE role_permissions;
TRUNCATE TABLE salary_components;
TRUNCATE TABLE salary_structures;
TRUNCATE TABLE salary_structure_components;
TRUNCATE TABLE sales_orders;
TRUNCATE TABLE sales_order_items;
TRUNCATE TABLE shifts;
TRUNCATE TABLE shift_week_offs;
TRUNCATE TABLE statutory_configurations;
TRUNCATE TABLE stock_adjustments;
TRUNCATE TABLE stock_adjustment_items;
TRUNCATE TABLE stock_locations;
TRUNCATE TABLE stock_transfers;
TRUNCATE TABLE stock_transfer_items;
TRUNCATE TABLE suppliers;
TRUNCATE TABLE tools;
TRUNCATE TABLE tool_assignments;
TRUNCATE TABLE tool_returns;
TRUNCATE TABLE tool_stock;
TRUNCATE TABLE unit_conversions;
TRUNCATE TABLE users;
TRUNCATE TABLE user_roles;
TRUNCATE TABLE work_locations;

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- MINIMAL ADMIN SEED
-- ------------------------------------------------------------
START TRANSACTION;

INSERT INTO roles (name, description, isSystemRole)
VALUES ('Super Admin', 'Full system access', TRUE);

INSERT INTO users (email, passwordHash, isActive)
VALUES ('admin@rfipl.com', '$2b$10$.swYelGOTQXZAPh2wdXI5uBOlwXm3dlwPLg5/oLle6Dall0O/XIiK', TRUE);

INSERT INTO user_roles (userId, roleId)
SELECT u.id, r.id
FROM users u
JOIN roles r ON r.name = 'Super Admin'
WHERE u.email = 'admin@rfipl.com';

COMMIT;
