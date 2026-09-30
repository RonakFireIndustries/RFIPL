-- ============================================================
-- RFIPL ERP - INVENTORY MANAGEMENT MODULE
-- MySQL 8+
-- phpMyAdmin Safe Import
--
-- MODULES:
-- 1. Raw Material Inventory
-- 2. Purchasing & Quality Control
-- 3. Production & BOM
-- 4. Finished Product Inventory
-- 5. Sales, Dispatch & Customer Returns
-- 6. Machines & Tools
-- 7. Stock Transfers
-- 8. Stock Adjustments
-- 9. Damage & Loss
-- 10. Notifications Configuration
--
-- EXISTING HRMS TABLES EXPECTED:
-- users
-- employees
-- departments
--
-- CONVENTIONS:
-- Tables      : snake_case
-- Columns     : camelCase
-- Primary Key : id
-- Foreign Key : entityId
-- Timestamps  : createdAt, updatedAt
-- Soft Delete : deletedAt
-- ============================================================


SET FOREIGN_KEY_CHECKS = 0;


-- ============================================================
-- 1. INVENTORY UNITS
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_units (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(20) NOT NULL,

    unitType ENUM(
        'weight',
        'length',
        'volume',
        'quantity',
        'other'
    ) NOT NULL,

    isBaseUnit TINYINT(1) NOT NULL DEFAULT 0,
    isActive TINYINT(1) NOT NULL DEFAULT 1,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_inventory_units_name (name),
    UNIQUE KEY uq_inventory_units_symbol (symbol)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 2. UNIT CONVERSIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS unit_conversions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    fromUnitId BIGINT UNSIGNED NOT NULL,
    toUnitId BIGINT UNSIGNED NOT NULL,

    conversionFactor DECIMAL(18,6) NOT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_unit_conversion (
        fromUnitId,
        toUnitId
    ),

    CONSTRAINT fk_unit_conversion_from
        FOREIGN KEY (fromUnitId)
        REFERENCES inventory_units(id),

    CONSTRAINT fk_unit_conversion_to
        FOREIGN KEY (toUnitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 3. INVENTORY CATEGORIES
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_categories (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    name VARCHAR(150) NOT NULL,

    inventoryType ENUM(
        'raw_material',
        'finished_product',
        'tool'
    ) NOT NULL,

    description TEXT NULL,

    isActive TINYINT(1) NOT NULL DEFAULT 1,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_inventory_category (
        inventoryType,
        name
    )

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 4. STOCK LOCATIONS
-- Dynamic locations
-- Can optionally belong to a department
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_locations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    name VARCHAR(150) NOT NULL,
    code VARCHAR(50) NOT NULL,

    departmentId BIGINT UNSIGNED NULL,

    description TEXT NULL,

    isActive TINYINT(1) NOT NULL DEFAULT 1,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_stock_location_code (code),

    KEY idx_stock_location_department (departmentId),

    CONSTRAINT fk_stock_location_department
        FOREIGN KEY (departmentId)
        REFERENCES departments(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 5. SUPPLIERS
-- ============================================================

CREATE TABLE IF NOT EXISTS suppliers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    supplierCode VARCHAR(50) NOT NULL,

    companyName VARCHAR(200) NOT NULL,
    contactPerson VARCHAR(150) NULL,

    phone VARCHAR(30) NULL,
    email VARCHAR(150) NULL,

    address TEXT NULL,

    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,

    country VARCHAR(100) NOT NULL DEFAULT 'India',
    pincode VARCHAR(20) NULL,

    gstNumber VARCHAR(50) NULL,
    panNumber VARCHAR(50) NULL,

    isActive TINYINT(1) NOT NULL DEFAULT 1,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_supplier_code (supplierCode)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 6. RAW MATERIALS
-- ============================================================

CREATE TABLE IF NOT EXISTS raw_materials (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    sku VARCHAR(100) NOT NULL,

    name VARCHAR(200) NOT NULL,

    categoryId BIGINT UNSIGNED NULL,
    unitId BIGINT UNSIGNED NOT NULL,

    description TEXT NULL,

    minimumStockLevel DECIMAL(18,4) NOT NULL DEFAULT 0,
    reorderLevel DECIMAL(18,4) NOT NULL DEFAULT 0,

    defaultPurchasePrice DECIMAL(14,2) NULL,

    isActive TINYINT(1) NOT NULL DEFAULT 1,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_raw_material_sku (sku),

    KEY idx_raw_material_category (categoryId),

    CONSTRAINT fk_raw_material_category
        FOREIGN KEY (categoryId)
        REFERENCES inventory_categories(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_raw_material_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 7. RAW MATERIAL SUPPLIERS
-- Multiple suppliers per material
-- ============================================================

CREATE TABLE IF NOT EXISTS raw_material_suppliers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    rawMaterialId BIGINT UNSIGNED NOT NULL,
    supplierId BIGINT UNSIGNED NOT NULL,

    supplierItemCode VARCHAR(100) NULL,

    purchasePrice DECIMAL(14,2) NULL,

    isPreferred TINYINT(1) NOT NULL DEFAULT 0,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_material_supplier (
        rawMaterialId,
        supplierId
    ),

    CONSTRAINT fk_material_supplier_material
        FOREIGN KEY (rawMaterialId)
        REFERENCES raw_materials(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_material_supplier_supplier
        FOREIGN KEY (supplierId)
        REFERENCES suppliers(id)
        ON DELETE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 8. PURCHASE REQUESTS
--
-- Workflow:
-- Draft
-- → Pending Manager
-- → Manager Approved
-- → Purchase Order
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_requests (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    requestNumber VARCHAR(50) NOT NULL,

    departmentId BIGINT UNSIGNED NULL,

    requestedBy BIGINT UNSIGNED NOT NULL,

    requestDate DATE NOT NULL,
    requiredDate DATE NULL,

    purpose TEXT NULL,

    status ENUM(
        'draft',
        'pending_manager',
        'manager_approved',
        'rejected',
        'converted_to_po',
        'cancelled'
    ) NOT NULL DEFAULT 'draft',

    managerApprovedBy BIGINT UNSIGNED NULL,
    managerApprovedAt DATETIME NULL,

    managerRemarks TEXT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_purchase_request_number (requestNumber),

    KEY idx_purchase_request_status (status),

    CONSTRAINT fk_purchase_request_department
        FOREIGN KEY (departmentId)
        REFERENCES departments(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_purchase_request_requested_by
        FOREIGN KEY (requestedBy)
        REFERENCES employees(id),

    CONSTRAINT fk_purchase_request_manager
        FOREIGN KEY (managerApprovedBy)
        REFERENCES employees(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS purchase_request_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    purchaseRequestId BIGINT UNSIGNED NOT NULL,

    rawMaterialId BIGINT UNSIGNED NOT NULL,

    quantity DECIMAL(18,4) NOT NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    remarks TEXT NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_pr_item_request
        FOREIGN KEY (purchaseRequestId)
        REFERENCES purchase_requests(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_pr_item_material
        FOREIGN KEY (rawMaterialId)
        REFERENCES raw_materials(id),

    CONSTRAINT fk_pr_item_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 9. PURCHASE ORDERS
--
-- Workflow:
-- Purchase Request
-- → Manager Approval
-- → PO Creation
-- → Admin Approval
-- → Supplier
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    poNumber VARCHAR(50) NOT NULL,

    purchaseRequestId BIGINT UNSIGNED NULL,

    supplierId BIGINT UNSIGNED NOT NULL,

    orderDate DATE NOT NULL,
    expectedDeliveryDate DATE NULL,

    totalAmount DECIMAL(14,2) NOT NULL DEFAULT 0,

    status ENUM(
        'draft',
        'pending_admin',
        'approved',
        'rejected',
        'partially_received',
        'received',
        'cancelled'
    ) NOT NULL DEFAULT 'draft',

    createdBy BIGINT UNSIGNED NOT NULL,

    adminApprovedBy BIGINT UNSIGNED NULL,
    adminApprovedAt DATETIME NULL,

    adminRemarks TEXT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_purchase_order_number (poNumber),

    KEY idx_purchase_order_status (status),

    CONSTRAINT fk_purchase_order_request
        FOREIGN KEY (purchaseRequestId)
        REFERENCES purchase_requests(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_purchase_order_supplier
        FOREIGN KEY (supplierId)
        REFERENCES suppliers(id),

    CONSTRAINT fk_purchase_order_created_by
        FOREIGN KEY (createdBy)
        REFERENCES users(id),

    CONSTRAINT fk_purchase_order_admin
        FOREIGN KEY (adminApprovedBy)
        REFERENCES users(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS purchase_order_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    purchaseOrderId BIGINT UNSIGNED NOT NULL,

    rawMaterialId BIGINT UNSIGNED NOT NULL,

    orderedQuantity DECIMAL(18,4) NOT NULL,

    receivedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,

    unitId BIGINT UNSIGNED NOT NULL,

    unitPrice DECIMAL(14,2) NOT NULL,

    totalAmount DECIMAL(14,2) NOT NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_po_item_order
        FOREIGN KEY (purchaseOrderId)
        REFERENCES purchase_orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_po_item_material
        FOREIGN KEY (rawMaterialId)
        REFERENCES raw_materials(id),

    CONSTRAINT fk_po_item_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 10. GOODS RECEIPT NOTE (GRN)
-- Supports partial receiving
-- ============================================================

CREATE TABLE IF NOT EXISTS goods_receipts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    grnNumber VARCHAR(50) NOT NULL,

    purchaseOrderId BIGINT UNSIGNED NOT NULL,

    supplierId BIGINT UNSIGNED NOT NULL,

    receivedDate DATE NOT NULL,

    receivedBy BIGINT UNSIGNED NOT NULL,

    status ENUM(
        'received',
        'partially_qc',
        'qc_completed',
        'cancelled'
    ) NOT NULL DEFAULT 'received',

    remarks TEXT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_grn_number (grnNumber),

    CONSTRAINT fk_grn_purchase_order
        FOREIGN KEY (purchaseOrderId)
        REFERENCES purchase_orders(id),

    CONSTRAINT fk_grn_supplier
        FOREIGN KEY (supplierId)
        REFERENCES suppliers(id),

    CONSTRAINT fk_grn_received_by
        FOREIGN KEY (receivedBy)
        REFERENCES employees(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS goods_receipt_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    goodsReceiptId BIGINT UNSIGNED NOT NULL,

    purchaseOrderItemId BIGINT UNSIGNED NOT NULL,

    rawMaterialId BIGINT UNSIGNED NOT NULL,

    batchNumber VARCHAR(100) NOT NULL,

    receivedQuantity DECIMAL(18,4) NOT NULL,

    approvedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,

    rejectedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,

    unitId BIGINT UNSIGNED NOT NULL,

    purchasePrice DECIMAL(14,2) NOT NULL,

    locationId BIGINT UNSIGNED NULL,

    qcStatus ENUM(
        'pending',
        'approved',
        'partially_approved',
        'rejected'
    ) NOT NULL DEFAULT 'pending',

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_grn_material_batch (
        rawMaterialId,
        batchNumber
    ),

    CONSTRAINT fk_grn_item_grn
        FOREIGN KEY (goodsReceiptId)
        REFERENCES goods_receipts(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_grn_item_po
        FOREIGN KEY (purchaseOrderItemId)
        REFERENCES purchase_order_items(id),

    CONSTRAINT fk_grn_item_material
        FOREIGN KEY (rawMaterialId)
        REFERENCES raw_materials(id),

    CONSTRAINT fk_grn_item_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id),

    CONSTRAINT fk_grn_item_location
        FOREIGN KEY (locationId)
        REFERENCES stock_locations(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 11. QUALITY CONTROL
--
-- Option C:
-- Approved → Available Stock
-- Rejected → Supplier Return / Rejected Stock
-- ============================================================

CREATE TABLE IF NOT EXISTS quality_inspections (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    goodsReceiptItemId BIGINT UNSIGNED NOT NULL,

    inspectedBy BIGINT UNSIGNED NOT NULL,

    inspectedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    approvedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,

    rejectedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,

    status ENUM(
        'approved',
        'partially_approved',
        'rejected'
    ) NOT NULL,

    remarks TEXT NULL,

    rejectionAction ENUM(
        'return_supplier',
        'rejected_stock'
    ) NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_qc_grn_item
        FOREIGN KEY (goodsReceiptItemId)
        REFERENCES goods_receipt_items(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_qc_inspected_by
        FOREIGN KEY (inspectedBy)
        REFERENCES employees(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 12. RAW MATERIAL BATCHES
-- ============================================================

CREATE TABLE IF NOT EXISTS raw_material_batches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    rawMaterialId BIGINT UNSIGNED NOT NULL,

    supplierId BIGINT UNSIGNED NULL,

    batchNumber VARCHAR(100) NOT NULL,

    receivedDate DATE NOT NULL,

    purchasePrice DECIMAL(14,2) NOT NULL,

    originalQuantity DECIMAL(18,4) NOT NULL,

    currentQuantity DECIMAL(18,4) NOT NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    qcStatus ENUM(
        'approved',
        'rejected',
        'partial'
    ) NOT NULL DEFAULT 'approved',

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_raw_material_batch (
        rawMaterialId,
        batchNumber
    ),

    CONSTRAINT fk_raw_batch_material
        FOREIGN KEY (rawMaterialId)
        REFERENCES raw_materials(id),

    CONSTRAINT fk_raw_batch_supplier
        FOREIGN KEY (supplierId)
        REFERENCES suppliers(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_raw_batch_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 13. RAW MATERIAL STOCK
-- ============================================================

CREATE TABLE IF NOT EXISTS raw_material_stock (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    rawMaterialId BIGINT UNSIGNED NOT NULL,

    batchId BIGINT UNSIGNED NULL,

    locationId BIGINT UNSIGNED NOT NULL,

    quantity DECIMAL(18,4) NOT NULL DEFAULT 0,

    unitId BIGINT UNSIGNED NOT NULL,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_raw_stock (
        rawMaterialId,
        batchId,
        locationId
    ),

    CONSTRAINT fk_raw_stock_material
        FOREIGN KEY (rawMaterialId)
        REFERENCES raw_materials(id),

    CONSTRAINT fk_raw_stock_batch
        FOREIGN KEY (batchId)
        REFERENCES raw_material_batches(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_raw_stock_location
        FOREIGN KEY (locationId)
        REFERENCES stock_locations(id),

    CONSTRAINT fk_raw_stock_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 14. RAW MATERIAL STOCK LEDGER
-- ============================================================

CREATE TABLE IF NOT EXISTS raw_material_stock_ledger (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    rawMaterialId BIGINT UNSIGNED NOT NULL,

    batchId BIGINT UNSIGNED NULL,

    locationId BIGINT UNSIGNED NULL,

    transactionType ENUM(
        'purchase_receipt',
        'qc_approved',
        'qc_rejected',
        'production_consumption',
        'transfer_out',
        'transfer_in',
        'adjustment',
        'damage',
        'loss',
        'return_supplier'
    ) NOT NULL,

    referenceType VARCHAR(100) NULL,

    referenceId BIGINT UNSIGNED NULL,

    quantityIn DECIMAL(18,4) NOT NULL DEFAULT 0,

    quantityOut DECIMAL(18,4) NOT NULL DEFAULT 0,

    unitCost DECIMAL(14,2) NULL,

    remarks TEXT NULL,

    createdBy BIGINT UNSIGNED NULL,

    transactionAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_raw_material_ledger (
        rawMaterialId,
        transactionAt
    ),

    CONSTRAINT fk_raw_ledger_material
        FOREIGN KEY (rawMaterialId)
        REFERENCES raw_materials(id),

    CONSTRAINT fk_raw_ledger_batch
        FOREIGN KEY (batchId)
        REFERENCES raw_material_batches(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_raw_ledger_location
        FOREIGN KEY (locationId)
        REFERENCES stock_locations(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_raw_ledger_user
        FOREIGN KEY (createdBy)
        REFERENCES users(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 15. FINISHED PRODUCTS
-- ============================================================

CREATE TABLE IF NOT EXISTS finished_products (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    sku VARCHAR(100) NOT NULL,

    name VARCHAR(200) NOT NULL,

    categoryId BIGINT UNSIGNED NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    description TEXT NULL,

    minimumStockLevel DECIMAL(18,4) NOT NULL DEFAULT 0,

    sellingPrice DECIMAL(14,2) NULL,

    isActive TINYINT(1) NOT NULL DEFAULT 1,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_finished_product_sku (sku),

    CONSTRAINT fk_finished_product_category
        FOREIGN KEY (categoryId)
        REFERENCES inventory_categories(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_finished_product_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 16. BILL OF MATERIALS
-- ============================================================

CREATE TABLE IF NOT EXISTS bills_of_materials (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    bomNumber VARCHAR(50) NOT NULL,

    finishedProductId BIGINT UNSIGNED NOT NULL,

    name VARCHAR(200) NOT NULL,

    outputQuantity DECIMAL(18,4) NOT NULL DEFAULT 1,

    outputUnitId BIGINT UNSIGNED NOT NULL,

    versionNumber INT UNSIGNED NOT NULL DEFAULT 1,

    isActive TINYINT(1) NOT NULL DEFAULT 1,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_bom_number (bomNumber),

    CONSTRAINT fk_bom_finished_product
        FOREIGN KEY (finishedProductId)
        REFERENCES finished_products(id),

    CONSTRAINT fk_bom_output_unit
        FOREIGN KEY (outputUnitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS bom_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    bomId BIGINT UNSIGNED NOT NULL,

    rawMaterialId BIGINT UNSIGNED NOT NULL,

    requiredQuantity DECIMAL(18,4) NOT NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    wastagePercentage DECIMAL(8,4) NOT NULL DEFAULT 0,

    PRIMARY KEY (id),

    UNIQUE KEY uq_bom_material (
        bomId,
        rawMaterialId
    ),

    CONSTRAINT fk_bom_item_bom
        FOREIGN KEY (bomId)
        REFERENCES bills_of_materials(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_bom_item_material
        FOREIGN KEY (rawMaterialId)
        REFERENCES raw_materials(id),

    CONSTRAINT fk_bom_item_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 17. PRODUCTION ORDERS
-- ============================================================

CREATE TABLE IF NOT EXISTS production_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    productionNumber VARCHAR(50) NOT NULL,

    departmentId BIGINT UNSIGNED NULL,

    bomId BIGINT UNSIGNED NULL,

    plannedStartDate DATE NULL,

    plannedCompletionDate DATE NULL,

    actualStartAt DATETIME NULL,

    actualCompletedAt DATETIME NULL,

    status ENUM(
        'draft',
        'planned',
        'in_progress',
        'completed',
        'cancelled'
    ) NOT NULL DEFAULT 'draft',

    createdBy BIGINT UNSIGNED NOT NULL,

    remarks TEXT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_production_number (productionNumber),

    KEY idx_production_status (status),

    CONSTRAINT fk_production_department
        FOREIGN KEY (departmentId)
        REFERENCES departments(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_production_bom
        FOREIGN KEY (bomId)
        REFERENCES bills_of_materials(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_production_created_by
        FOREIGN KEY (createdBy)
        REFERENCES employees(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 18. PRODUCTION MATERIAL CONSUMPTION
-- Automatic + Manual
-- ============================================================

CREATE TABLE IF NOT EXISTS production_consumptions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    productionOrderId BIGINT UNSIGNED NOT NULL,

    rawMaterialId BIGINT UNSIGNED NOT NULL,

    batchId BIGINT UNSIGNED NULL,

    locationId BIGINT UNSIGNED NOT NULL,

    consumptionMode ENUM(
        'automatic',
        'manual'
    ) NOT NULL,

    plannedQuantity DECIMAL(18,4) NULL,

    consumedQuantity DECIMAL(18,4) NOT NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    consumedBy BIGINT UNSIGNED NULL,

    consumedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    remarks TEXT NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_consumption_production
        FOREIGN KEY (productionOrderId)
        REFERENCES production_orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_consumption_material
        FOREIGN KEY (rawMaterialId)
        REFERENCES raw_materials(id),

    CONSTRAINT fk_consumption_batch
        FOREIGN KEY (batchId)
        REFERENCES raw_material_batches(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_consumption_location
        FOREIGN KEY (locationId)
        REFERENCES stock_locations(id),

    CONSTRAINT fk_consumption_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id),

    CONSTRAINT fk_consumption_employee
        FOREIGN KEY (consumedBy)
        REFERENCES employees(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 19. PRODUCTION WASTAGE
-- ============================================================

CREATE TABLE IF NOT EXISTS production_wastage (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    productionOrderId BIGINT UNSIGNED NOT NULL,

    rawMaterialId BIGINT UNSIGNED NULL,

    wastageType ENUM(
        'normal',
        'excess',
        'damaged',
        'scrap'
    ) NOT NULL,

    quantity DECIMAL(18,4) NOT NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    description TEXT NULL,

    recordedBy BIGINT UNSIGNED NULL,

    recordedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_wastage_production
        FOREIGN KEY (productionOrderId)
        REFERENCES production_orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_wastage_material
        FOREIGN KEY (rawMaterialId)
        REFERENCES raw_materials(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_wastage_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id),

    CONSTRAINT fk_wastage_employee
        FOREIGN KEY (recordedBy)
        REFERENCES employees(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 20. FINISHED PRODUCT BATCHES
-- ============================================================

CREATE TABLE IF NOT EXISTS finished_product_batches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    finishedProductId BIGINT UNSIGNED NOT NULL,

    batchNumber VARCHAR(100) NOT NULL,

    productionOrderId BIGINT UNSIGNED NULL,

    manufacturingDate DATE NOT NULL,

    originalQuantity DECIMAL(18,4) NOT NULL,

    currentQuantity DECIMAL(18,4) NOT NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    manualCost DECIMAL(14,2) NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_finished_batch_number (batchNumber),

    CONSTRAINT fk_finished_batch_product
        FOREIGN KEY (finishedProductId)
        REFERENCES finished_products(id),

    CONSTRAINT fk_finished_batch_production
        FOREIGN KEY (productionOrderId)
        REFERENCES production_orders(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_finished_batch_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 21. PRODUCTION OUTPUT
-- Supports multiple finished products
-- ============================================================

CREATE TABLE IF NOT EXISTS production_outputs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    productionOrderId BIGINT UNSIGNED NOT NULL,

    finishedProductId BIGINT UNSIGNED NOT NULL,

    batchId BIGINT UNSIGNED NULL,

    outputQuantity DECIMAL(18,4) NOT NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    locationId BIGINT UNSIGNED NOT NULL,

    manufacturingDate DATE NOT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    CONSTRAINT fk_output_production
        FOREIGN KEY (productionOrderId)
        REFERENCES production_orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_output_product
        FOREIGN KEY (finishedProductId)
        REFERENCES finished_products(id),

    CONSTRAINT fk_output_batch
        FOREIGN KEY (batchId)
        REFERENCES finished_product_batches(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_output_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id),

    CONSTRAINT fk_output_location
        FOREIGN KEY (locationId)
        REFERENCES stock_locations(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 22. FINISHED PRODUCT STOCK
-- ============================================================

CREATE TABLE IF NOT EXISTS finished_product_stock (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    finishedProductId BIGINT UNSIGNED NOT NULL,

    batchId BIGINT UNSIGNED NULL,

    locationId BIGINT UNSIGNED NOT NULL,

    quantity DECIMAL(18,4) NOT NULL DEFAULT 0,

    unitId BIGINT UNSIGNED NOT NULL,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_finished_stock (
        finishedProductId,
        batchId,
        locationId
    ),

    CONSTRAINT fk_finished_stock_product
        FOREIGN KEY (finishedProductId)
        REFERENCES finished_products(id),

    CONSTRAINT fk_finished_stock_batch
        FOREIGN KEY (batchId)
        REFERENCES finished_product_batches(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_finished_stock_location
        FOREIGN KEY (locationId)
        REFERENCES stock_locations(id),

    CONSTRAINT fk_finished_stock_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 23. FINISHED PRODUCT STOCK LEDGER
-- ============================================================

CREATE TABLE IF NOT EXISTS finished_product_stock_ledger (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    finishedProductId BIGINT UNSIGNED NOT NULL,

    batchId BIGINT UNSIGNED NULL,

    locationId BIGINT UNSIGNED NULL,

    transactionType ENUM(
        'production_output',
        'transfer_out',
        'transfer_in',
        'dispatch',
        'customer_return',
        'adjustment',
        'damage',
        'loss'
    ) NOT NULL,

    referenceType VARCHAR(100) NULL,

    referenceId BIGINT UNSIGNED NULL,

    quantityIn DECIMAL(18,4) NOT NULL DEFAULT 0,

    quantityOut DECIMAL(18,4) NOT NULL DEFAULT 0,

    unitCost DECIMAL(14,2) NULL,

    remarks TEXT NULL,

    createdBy BIGINT UNSIGNED NULL,

    transactionAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_finished_ledger (
        finishedProductId,
        transactionAt
    ),

    CONSTRAINT fk_finished_ledger_product
        FOREIGN KEY (finishedProductId)
        REFERENCES finished_products(id),

    CONSTRAINT fk_finished_ledger_batch
        FOREIGN KEY (batchId)
        REFERENCES finished_product_batches(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_finished_ledger_location
        FOREIGN KEY (locationId)
        REFERENCES stock_locations(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_finished_ledger_user
        FOREIGN KEY (createdBy)
        REFERENCES users(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 24. CUSTOMERS
-- ============================================================

CREATE TABLE IF NOT EXISTS customers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    customerCode VARCHAR(50) NOT NULL,

    companyName VARCHAR(200) NOT NULL,

    contactPerson VARCHAR(150) NULL,

    phone VARCHAR(30) NULL,
    email VARCHAR(150) NULL,

    billingAddress TEXT NULL,

    shippingAddress TEXT NULL,

    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,

    country VARCHAR(100) NOT NULL DEFAULT 'India',

    pincode VARCHAR(20) NULL,

    gstNumber VARCHAR(50) NULL,

    isActive TINYINT(1) NOT NULL DEFAULT 1,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_customer_code (customerCode)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 25. SALES ORDERS
--
-- Workflow:
-- Sales Executive
-- → Department Manager Approval
-- → Dispatch
-- → Invoice
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    salesOrderNumber VARCHAR(50) NOT NULL,

    customerId BIGINT UNSIGNED NOT NULL,

    orderDate DATE NOT NULL,

    expectedDispatchDate DATE NULL,

    totalAmount DECIMAL(14,2) NOT NULL DEFAULT 0,

    status ENUM(
        'draft',
        'pending_manager',
        'approved',
        'rejected',
        'partially_dispatched',
        'completed',
        'cancelled'
    ) NOT NULL DEFAULT 'draft',

    createdBy BIGINT UNSIGNED NOT NULL,

    managerApprovedBy BIGINT UNSIGNED NULL,

    managerApprovedAt DATETIME NULL,

    managerRemarks TEXT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_sales_order_number (salesOrderNumber),

    KEY idx_sales_order_status (status),

    CONSTRAINT fk_sales_order_customer
        FOREIGN KEY (customerId)
        REFERENCES customers(id),

    CONSTRAINT fk_sales_order_created_by
        FOREIGN KEY (createdBy)
        REFERENCES employees(id),

    CONSTRAINT fk_sales_order_manager
        FOREIGN KEY (managerApprovedBy)
        REFERENCES employees(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS sales_order_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    salesOrderId BIGINT UNSIGNED NOT NULL,

    finishedProductId BIGINT UNSIGNED NOT NULL,

    orderedQuantity DECIMAL(18,4) NOT NULL,

    dispatchedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,

    unitId BIGINT UNSIGNED NOT NULL,

    unitPrice DECIMAL(14,2) NOT NULL,

    totalAmount DECIMAL(14,2) NOT NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_sales_item_order
        FOREIGN KEY (salesOrderId)
        REFERENCES sales_orders(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sales_item_product
        FOREIGN KEY (finishedProductId)
        REFERENCES finished_products(id),

    CONSTRAINT fk_sales_item_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 26. DISPATCHES
-- Supports partial dispatch
-- ============================================================

CREATE TABLE IF NOT EXISTS dispatches (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    dispatchNumber VARCHAR(50) NOT NULL,

    salesOrderId BIGINT UNSIGNED NOT NULL,

    customerId BIGINT UNSIGNED NOT NULL,

    dispatchDate DATE NOT NULL,

    fromLocationId BIGINT UNSIGNED NOT NULL,

    dispatchedBy BIGINT UNSIGNED NOT NULL,

    status ENUM(
        'draft',
        'dispatched',
        'cancelled'
    ) NOT NULL DEFAULT 'draft',

    remarks TEXT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_dispatch_number (dispatchNumber),

    CONSTRAINT fk_dispatch_sales_order
        FOREIGN KEY (salesOrderId)
        REFERENCES sales_orders(id),

    CONSTRAINT fk_dispatch_customer
        FOREIGN KEY (customerId)
        REFERENCES customers(id),

    CONSTRAINT fk_dispatch_location
        FOREIGN KEY (fromLocationId)
        REFERENCES stock_locations(id),

    CONSTRAINT fk_dispatch_employee
        FOREIGN KEY (dispatchedBy)
        REFERENCES employees(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS dispatch_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    dispatchId BIGINT UNSIGNED NOT NULL,

    salesOrderItemId BIGINT UNSIGNED NOT NULL,

    finishedProductId BIGINT UNSIGNED NOT NULL,

    batchId BIGINT UNSIGNED NULL,

    dispatchedQuantity DECIMAL(18,4) NOT NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_dispatch_item_dispatch
        FOREIGN KEY (dispatchId)
        REFERENCES dispatches(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_dispatch_item_sales_item
        FOREIGN KEY (salesOrderItemId)
        REFERENCES sales_order_items(id),

    CONSTRAINT fk_dispatch_item_product
        FOREIGN KEY (finishedProductId)
        REFERENCES finished_products(id),

    CONSTRAINT fk_dispatch_item_batch
        FOREIGN KEY (batchId)
        REFERENCES finished_product_batches(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_dispatch_item_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 27. INVOICES
-- ============================================================

CREATE TABLE IF NOT EXISTS invoices (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    invoiceNumber VARCHAR(50) NOT NULL,

    salesOrderId BIGINT UNSIGNED NOT NULL,

    dispatchId BIGINT UNSIGNED NULL,

    customerId BIGINT UNSIGNED NOT NULL,

    invoiceDate DATE NOT NULL,

    totalAmount DECIMAL(14,2) NOT NULL,

    paidAmount DECIMAL(14,2) NOT NULL DEFAULT 0,

    balanceAmount DECIMAL(14,2) NOT NULL,

    status ENUM(
        'unpaid',
        'partially_paid',
        'paid',
        'cancelled'
    ) NOT NULL DEFAULT 'unpaid',

    createdBy BIGINT UNSIGNED NOT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_invoice_number (invoiceNumber),

    CONSTRAINT fk_invoice_sales_order
        FOREIGN KEY (salesOrderId)
        REFERENCES sales_orders(id),

    CONSTRAINT fk_invoice_dispatch
        FOREIGN KEY (dispatchId)
        REFERENCES dispatches(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_invoice_customer
        FOREIGN KEY (customerId)
        REFERENCES customers(id),

    CONSTRAINT fk_invoice_user
        FOREIGN KEY (createdBy)
        REFERENCES users(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS invoice_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    invoiceId BIGINT UNSIGNED NOT NULL,

    finishedProductId BIGINT UNSIGNED NOT NULL,

    quantity DECIMAL(18,4) NOT NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    unitPrice DECIMAL(14,2) NOT NULL,

    totalAmount DECIMAL(14,2) NOT NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_invoice_item_invoice
        FOREIGN KEY (invoiceId)
        REFERENCES invoices(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_invoice_item_product
        FOREIGN KEY (finishedProductId)
        REFERENCES finished_products(id),

    CONSTRAINT fk_invoice_item_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 28. CUSTOMER PAYMENTS
-- Supports partial payment
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_payments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    paymentNumber VARCHAR(50) NOT NULL,

    invoiceId BIGINT UNSIGNED NOT NULL,

    customerId BIGINT UNSIGNED NOT NULL,

    paymentDate DATE NOT NULL,

    amount DECIMAL(14,2) NOT NULL,

    paymentMethod ENUM(
        'cash',
        'bank_transfer',
        'upi',
        'cheque',
        'other'
    ) NOT NULL,

    referenceNumber VARCHAR(150) NULL,

    remarks TEXT NULL,

    receivedBy BIGINT UNSIGNED NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_payment_number (paymentNumber),

    CONSTRAINT fk_customer_payment_invoice
        FOREIGN KEY (invoiceId)
        REFERENCES invoices(id),

    CONSTRAINT fk_customer_payment_customer
        FOREIGN KEY (customerId)
        REFERENCES customers(id),

    CONSTRAINT fk_customer_payment_user
        FOREIGN KEY (receivedBy)
        REFERENCES users(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 29. CUSTOMER RETURNS
-- ============================================================

CREATE TABLE IF NOT EXISTS customer_returns (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    returnNumber VARCHAR(50) NOT NULL,

    customerId BIGINT UNSIGNED NOT NULL,

    salesOrderId BIGINT UNSIGNED NULL,

    invoiceId BIGINT UNSIGNED NULL,

    returnDate DATE NOT NULL,

    receivedLocationId BIGINT UNSIGNED NOT NULL,

    status ENUM(
        'received',
        'pending_qc',
        'approved_restock',
        'damaged',
        'rejected'
    ) NOT NULL DEFAULT 'received',

    reason TEXT NULL,

    receivedBy BIGINT UNSIGNED NOT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_customer_return_number (returnNumber),

    CONSTRAINT fk_customer_return_customer
        FOREIGN KEY (customerId)
        REFERENCES customers(id),

    CONSTRAINT fk_customer_return_sales_order
        FOREIGN KEY (salesOrderId)
        REFERENCES sales_orders(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_customer_return_invoice
        FOREIGN KEY (invoiceId)
        REFERENCES invoices(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_customer_return_location
        FOREIGN KEY (receivedLocationId)
        REFERENCES stock_locations(id),

    CONSTRAINT fk_customer_return_employee
        FOREIGN KEY (receivedBy)
        REFERENCES employees(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS customer_return_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    customerReturnId BIGINT UNSIGNED NOT NULL,

    finishedProductId BIGINT UNSIGNED NOT NULL,

    batchId BIGINT UNSIGNED NULL,

    quantity DECIMAL(18,4) NOT NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    qcResult ENUM(
        'pending',
        'restock',
        'damaged',
        'rejected'
    ) NOT NULL DEFAULT 'pending',

    remarks TEXT NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_return_item_return
        FOREIGN KEY (customerReturnId)
        REFERENCES customer_returns(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_return_item_product
        FOREIGN KEY (finishedProductId)
        REFERENCES finished_products(id),

    CONSTRAINT fk_return_item_batch
        FOREIGN KEY (batchId)
        REFERENCES finished_product_batches(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_return_item_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 30. STOCK TRANSFERS
-- No approval required
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_transfers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    transferNumber VARCHAR(50) NOT NULL,

    inventoryType ENUM(
        'raw_material',
        'finished_product',
        'tool'
    ) NOT NULL,

    fromLocationId BIGINT UNSIGNED NOT NULL,

    toLocationId BIGINT UNSIGNED NOT NULL,

    transferDate DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    transferredBy BIGINT UNSIGNED NOT NULL,

    remarks TEXT NULL,

    status ENUM(
        'completed',
        'cancelled'
    ) NOT NULL DEFAULT 'completed',

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_transfer_number (transferNumber),

    CONSTRAINT fk_transfer_from_location
        FOREIGN KEY (fromLocationId)
        REFERENCES stock_locations(id),

    CONSTRAINT fk_transfer_to_location
        FOREIGN KEY (toLocationId)
        REFERENCES stock_locations(id),

    CONSTRAINT fk_transfer_employee
        FOREIGN KEY (transferredBy)
        REFERENCES employees(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS stock_transfer_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    stockTransferId BIGINT UNSIGNED NOT NULL,

    itemType ENUM(
        'raw_material',
        'finished_product',
        'tool'
    ) NOT NULL,

    itemId BIGINT UNSIGNED NOT NULL,

    batchNumber VARCHAR(100) NULL,

    quantity DECIMAL(18,4) NOT NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_transfer_item_transfer
        FOREIGN KEY (stockTransferId)
        REFERENCES stock_transfers(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_transfer_item_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 31. STOCK ADJUSTMENTS
-- Approval required
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_adjustments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    adjustmentNumber VARCHAR(50) NOT NULL,

    inventoryType ENUM(
        'raw_material',
        'finished_product',
        'tool'
    ) NOT NULL,

    requestedBy BIGINT UNSIGNED NOT NULL,

    requestedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    reason ENUM(
        'physical_count_difference',
        'damage',
        'loss',
        'expired',
        'data_entry_error',
        'other'
    ) NOT NULL,

    description TEXT NULL,

    status ENUM(
        'pending',
        'approved',
        'rejected',
        'applied'
    ) NOT NULL DEFAULT 'pending',

    approvedBy BIGINT UNSIGNED NULL,

    approvedAt DATETIME NULL,

    approvalRemarks TEXT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_adjustment_number (adjustmentNumber),

    KEY idx_adjustment_status (status),

    CONSTRAINT fk_adjustment_requested_by
        FOREIGN KEY (requestedBy)
        REFERENCES employees(id),

    CONSTRAINT fk_adjustment_approved_by
        FOREIGN KEY (approvedBy)
        REFERENCES employees(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


CREATE TABLE IF NOT EXISTS stock_adjustment_items (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    stockAdjustmentId BIGINT UNSIGNED NOT NULL,

    itemType ENUM(
        'raw_material',
        'finished_product',
        'tool'
    ) NOT NULL,

    itemId BIGINT UNSIGNED NOT NULL,

    batchNumber VARCHAR(100) NULL,

    locationId BIGINT UNSIGNED NOT NULL,

    systemQuantity DECIMAL(18,4) NOT NULL,

    physicalQuantity DECIMAL(18,4) NOT NULL,

    adjustmentQuantity DECIMAL(18,4) NOT NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_adjustment_item_adjustment
        FOREIGN KEY (stockAdjustmentId)
        REFERENCES stock_adjustments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_adjustment_item_location
        FOREIGN KEY (locationId)
        REFERENCES stock_locations(id),

    CONSTRAINT fk_adjustment_item_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 32. MACHINES
-- ============================================================

CREATE TABLE IF NOT EXISTS machines (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    machineCode VARCHAR(50) NOT NULL,

    machineName VARCHAR(200) NOT NULL,

    departmentId BIGINT UNSIGNED NOT NULL,

    locationId BIGINT UNSIGNED NULL,

    maintenanceDueDate DATE NULL,

    status ENUM(
        'active',
        'under_maintenance',
        'inactive',
        'breakdown'
    ) NOT NULL DEFAULT 'active',

    description TEXT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_machine_code (machineCode),

    KEY idx_machine_department (departmentId),

    KEY idx_machine_status (status),

    CONSTRAINT fk_machine_department
        FOREIGN KEY (departmentId)
        REFERENCES departments(id),

    CONSTRAINT fk_machine_location
        FOREIGN KEY (locationId)
        REFERENCES stock_locations(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 33. MACHINE BREAKDOWNS
-- ============================================================

CREATE TABLE IF NOT EXISTS machine_breakdowns (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    machineId BIGINT UNSIGNED NOT NULL,

    breakdownDateTime DATETIME NOT NULL,

    problemDescription TEXT NOT NULL,

    severity ENUM(
        'low',
        'medium',
        'high',
        'critical'
    ) NOT NULL DEFAULT 'medium',

    reportedBy BIGINT UNSIGNED NOT NULL,

    downtimeMinutes INT UNSIGNED NULL,

    status ENUM(
        'open',
        'resolved'
    ) NOT NULL DEFAULT 'open',

    resolutionDetails TEXT NULL,

    resolvedBy BIGINT UNSIGNED NULL,

    resolvedAt DATETIME NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    KEY idx_machine_breakdown (
        machineId,
        status
    ),

    CONSTRAINT fk_breakdown_machine
        FOREIGN KEY (machineId)
        REFERENCES machines(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_breakdown_reported_by
        FOREIGN KEY (reportedBy)
        REFERENCES employees(id),

    CONSTRAINT fk_breakdown_resolved_by
        FOREIGN KEY (resolvedBy)
        REFERENCES employees(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 34. TOOLS
-- Reusable + Consumable
-- ============================================================

CREATE TABLE IF NOT EXISTS tools (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    toolCode VARCHAR(100) NOT NULL,

    name VARCHAR(200) NOT NULL,

    categoryId BIGINT UNSIGNED NULL,

    unitId BIGINT UNSIGNED NOT NULL,

    toolType ENUM(
        'reusable',
        'consumable'
    ) NOT NULL,

    minimumStockLevel DECIMAL(18,4) NOT NULL DEFAULT 0,

    description TEXT NULL,

    isActive TINYINT(1) NOT NULL DEFAULT 1,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    deletedAt DATETIME NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_tool_code (toolCode),

    CONSTRAINT fk_tool_category
        FOREIGN KEY (categoryId)
        REFERENCES inventory_categories(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_tool_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 35. TOOL STOCK
-- ============================================================

CREATE TABLE IF NOT EXISTS tool_stock (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    toolId BIGINT UNSIGNED NOT NULL,

    locationId BIGINT UNSIGNED NOT NULL,

    availableQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,

    assignedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,

    damagedQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,

    lostQuantity DECIMAL(18,4) NOT NULL DEFAULT 0,

    unitId BIGINT UNSIGNED NOT NULL,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_tool_stock (
        toolId,
        locationId
    ),

    CONSTRAINT fk_tool_stock_tool
        FOREIGN KEY (toolId)
        REFERENCES tools(id),

    CONSTRAINT fk_tool_stock_location
        FOREIGN KEY (locationId)
        REFERENCES stock_locations(id),

    CONSTRAINT fk_tool_stock_unit
        FOREIGN KEY (unitId)
        REFERENCES inventory_units(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 36. TOOL ASSIGNMENTS
-- ============================================================

CREATE TABLE IF NOT EXISTS tool_assignments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    assignmentNumber VARCHAR(50) NOT NULL,

    toolId BIGINT UNSIGNED NOT NULL,

    employeeId BIGINT UNSIGNED NOT NULL,

    locationId BIGINT UNSIGNED NULL,

    quantity DECIMAL(18,4) NOT NULL,

    assignedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    assignedBy BIGINT UNSIGNED NOT NULL,

    expectedReturnDate DATE NULL,

    status ENUM(
        'assigned',
        'partially_returned',
        'returned',
        'lost',
        'damaged'
    ) NOT NULL DEFAULT 'assigned',

    remarks TEXT NULL,

    PRIMARY KEY (id),

    UNIQUE KEY uq_assignment_number (assignmentNumber),

    CONSTRAINT fk_tool_assignment_tool
        FOREIGN KEY (toolId)
        REFERENCES tools(id),

    CONSTRAINT fk_tool_assignment_employee
        FOREIGN KEY (employeeId)
        REFERENCES employees(id),

    CONSTRAINT fk_tool_assignment_location
        FOREIGN KEY (locationId)
        REFERENCES stock_locations(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_tool_assignment_by
        FOREIGN KEY (assignedBy)
        REFERENCES employees(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 37. TOOL RETURNS
-- ============================================================

CREATE TABLE IF NOT EXISTS tool_returns (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    toolAssignmentId BIGINT UNSIGNED NOT NULL,

    returnedQuantity DECIMAL(18,4) NOT NULL,

    returnCondition ENUM(
        'good',
        'damaged',
        'needs_repair',
        'lost'
    ) NOT NULL,

    returnedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    receivedBy BIGINT UNSIGNED NOT NULL,

    remarks TEXT NULL,

    PRIMARY KEY (id),

    CONSTRAINT fk_tool_return_assignment
        FOREIGN KEY (toolAssignmentId)
        REFERENCES tool_assignments(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_tool_return_received_by
        FOREIGN KEY (receivedBy)
        REFERENCES employees(id)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 38. DAMAGE AND LOSS REPORTS
--
-- Workflow:
-- Report
-- → Approval
-- → Stock Reduction
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_damage_loss_reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    reportNumber VARCHAR(50) NOT NULL,

    inventoryType ENUM(
        'raw_material',
        'finished_product',
        'tool',
        'machine'
    ) NOT NULL,

    itemId BIGINT UNSIGNED NOT NULL,

    locationId BIGINT UNSIGNED NULL,

    reportType ENUM(
        'damage',
        'loss'
    ) NOT NULL,

    quantity DECIMAL(18,4) NULL,

    incidentDate DATETIME NOT NULL,

    description TEXT NOT NULL,

    reportedBy BIGINT UNSIGNED NOT NULL,

    responsibleEmployeeId BIGINT UNSIGNED NULL,

    status ENUM(
        'pending',
        'approved',
        'rejected',
        'applied'
    ) NOT NULL DEFAULT 'pending',

    approvedBy BIGINT UNSIGNED NULL,

    approvedAt DATETIME NULL,

    approvalRemarks TEXT NULL,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_damage_loss_number (reportNumber),

    KEY idx_damage_loss_status (
        inventoryType,
        status
    ),

    CONSTRAINT fk_damage_loss_location
        FOREIGN KEY (locationId)
        REFERENCES stock_locations(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_damage_loss_reported_by
        FOREIGN KEY (reportedBy)
        REFERENCES employees(id),

    CONSTRAINT fk_damage_loss_responsible
        FOREIGN KEY (responsibleEmployeeId)
        REFERENCES employees(id)
        ON DELETE SET NULL,

    CONSTRAINT fk_damage_loss_approved_by
        FOREIGN KEY (approvedBy)
        REFERENCES employees(id)
        ON DELETE SET NULL

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- 39. INVENTORY NOTIFICATION RULES
--
-- Actual notifications should use your existing
-- notifications table.
-- ============================================================

CREATE TABLE IF NOT EXISTS inventory_notification_rules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,

    notificationType ENUM(
        'low_stock',
        'reorder_level',
        'purchase_pending',
        'sales_pending',
        'qc_pending',
        'production_update',
        'finished_product_low_stock',
        'dispatch_pending',
        'payment_pending',
        'tool_return_due',
        'tool_damage_loss',
        'machine_breakdown',
        'stock_adjustment_pending'
    ) NOT NULL,

    isEnabled TINYINT(1) NOT NULL DEFAULT 1,

    createdAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    updatedAt TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        ON UPDATE CURRENT_TIMESTAMP,

    PRIMARY KEY (id),

    UNIQUE KEY uq_notification_type (notificationType)

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- DEFAULT INVENTORY UNITS
-- ============================================================

INSERT IGNORE INTO inventory_units
(name, symbol, unitType, isBaseUnit)
VALUES

('Kilogram', 'KG', 'weight', 1),
('Gram', 'G', 'weight', 0),
('Metric Ton', 'TON', 'weight', 0),

('Liter', 'L', 'volume', 1),
('Milliliter', 'ML', 'volume', 0),

('Meter', 'M', 'length', 1),
('Centimeter', 'CM', 'length', 0),

('Piece', 'PCS', 'quantity', 1),
('Number', 'NOS', 'quantity', 0),

('Box', 'BOX', 'quantity', 0),
('Bag', 'BAG', 'quantity', 0);


-- ============================================================
-- DEFAULT UNIT CONVERSIONS
-- ============================================================

INSERT IGNORE INTO unit_conversions
(fromUnitId, toUnitId, conversionFactor)

SELECT
    u1.id,
    u2.id,
    0.001
FROM inventory_units u1
JOIN inventory_units u2
WHERE u1.symbol = 'G'
AND u2.symbol = 'KG';


INSERT IGNORE INTO unit_conversions
(fromUnitId, toUnitId, conversionFactor)

SELECT
    u1.id,
    u2.id,
    1000
FROM inventory_units u1
JOIN inventory_units u2
WHERE u1.symbol = 'KG'
AND u2.symbol = 'G';


INSERT IGNORE INTO unit_conversions
(fromUnitId, toUnitId, conversionFactor)

SELECT
    u1.id,
    u2.id,
    0.001
FROM inventory_units u1
JOIN inventory_units u2
WHERE u1.symbol = 'ML'
AND u2.symbol = 'L';


INSERT IGNORE INTO unit_conversions
(fromUnitId, toUnitId, conversionFactor)

SELECT
    u1.id,
    u2.id,
    1000
FROM inventory_units u1
JOIN inventory_units u2
WHERE u1.symbol = 'L'
AND u2.symbol = 'ML';


INSERT IGNORE INTO unit_conversions
(fromUnitId, toUnitId, conversionFactor)

SELECT
    u1.id,
    u2.id,
    0.01
FROM inventory_units u1
JOIN inventory_units u2
WHERE u1.symbol = 'CM'
AND u2.symbol = 'M';


INSERT IGNORE INTO unit_conversions
(fromUnitId, toUnitId, conversionFactor)

SELECT
    u1.id,
    u2.id,
    100
FROM inventory_units u1
JOIN inventory_units u2
WHERE u1.symbol = 'M'
AND u2.symbol = 'CM';


-- ============================================================
-- DEFAULT NOTIFICATION RULES
-- ============================================================

INSERT IGNORE INTO inventory_notification_rules
(notificationType, isEnabled)
VALUES

('low_stock', 1),
('reorder_level', 1),
('purchase_pending', 1),
('sales_pending', 1),
('qc_pending', 1),
('production_update', 1),
('finished_product_low_stock', 1),
('dispatch_pending', 1),
('payment_pending', 1),
('tool_return_due', 1),
('tool_damage_loss', 1),
('machine_breakdown', 1),
('stock_adjustment_pending', 1);


SET FOREIGN_KEY_CHECKS = 1;