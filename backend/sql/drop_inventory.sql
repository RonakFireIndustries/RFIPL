-- ============================================================
-- RFIPL - DROP INVENTORY MODULE TABLES (DESTRUCTIVE)
-- ------------------------------------------------------------
-- Schema: a17590e4_rfipl
-- Drops all 49 tables defined in backend/sql/inventory.sql,
-- including inventory master data, purchasing, production,
-- stock, sales/dispatch/invoicing, machines, and tools.
--
-- WARNING: This removes the tables and all their data.
-- No backup was taken. Run only against the intended database.
--
-- Usage (phpMyAdmin: Import this file) or:
--   mysql -h <host> -u <user> -p <database> < drop_inventory.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS inventory_units;
DROP TABLE IF EXISTS unit_conversions;
DROP TABLE IF EXISTS inventory_categories;
DROP TABLE IF EXISTS stock_locations;
DROP TABLE IF EXISTS suppliers;
DROP TABLE IF EXISTS raw_materials;
DROP TABLE IF EXISTS raw_material_suppliers;
DROP TABLE IF EXISTS purchase_requests;
DROP TABLE IF EXISTS purchase_request_items;
DROP TABLE IF EXISTS purchase_orders;
DROP TABLE IF EXISTS purchase_order_items;
DROP TABLE IF EXISTS goods_receipts;
DROP TABLE IF EXISTS goods_receipt_items;
DROP TABLE IF EXISTS quality_inspections;
DROP TABLE IF EXISTS raw_material_batches;
DROP TABLE IF EXISTS raw_material_stock;
DROP TABLE IF EXISTS raw_material_stock_ledger;
DROP TABLE IF EXISTS finished_products;
DROP TABLE IF EXISTS bills_of_materials;
DROP TABLE IF EXISTS bom_items;
DROP TABLE IF EXISTS production_orders;
DROP TABLE IF EXISTS production_consumptions;
DROP TABLE IF EXISTS production_wastage;
DROP TABLE IF EXISTS finished_product_batches;
DROP TABLE IF EXISTS production_outputs;
DROP TABLE IF EXISTS finished_product_stock;
DROP TABLE IF EXISTS finished_product_stock_ledger;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS sales_orders;
DROP TABLE IF EXISTS sales_order_items;
DROP TABLE IF EXISTS dispatches;
DROP TABLE IF EXISTS dispatch_items;
DROP TABLE IF EXISTS invoices;
DROP TABLE IF EXISTS invoice_items;
DROP TABLE IF EXISTS customer_payments;
DROP TABLE IF EXISTS customer_returns;
DROP TABLE IF EXISTS customer_return_items;
DROP TABLE IF EXISTS stock_transfers;
DROP TABLE IF EXISTS stock_transfer_items;
DROP TABLE IF EXISTS stock_adjustments;
DROP TABLE IF EXISTS stock_adjustment_items;
DROP TABLE IF EXISTS machines;
DROP TABLE IF EXISTS machine_breakdowns;
DROP TABLE IF EXISTS tools;
DROP TABLE IF EXISTS tool_stock;
DROP TABLE IF EXISTS tool_assignments;
DROP TABLE IF EXISTS tool_returns;
DROP TABLE IF EXISTS inventory_damage_loss_reports;
DROP TABLE IF EXISTS inventory_notification_rules;

SET FOREIGN_KEY_CHECKS = 1;
