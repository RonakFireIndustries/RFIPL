-- ============================================================
-- RFIPL INVENTORY - CORE MASTER DATA
-- MySQL 5.7+ (compatible with 5.7.23)
-- ------------------------------------------------------------
-- Step 1 of the inventory rebuild. Creates only:
--   1. inventory_units
--   2. unit_conversions
--   3. inventory_categories
--   4. suppliers
--
-- Depends on: nothing (unit_conversions -> inventory_units).
-- Does NOT touch HRMS tables. No seed rows.
--
-- Usage (phpMyAdmin: Import) or:
--   mysql -h <host> -u <user> -p <database> < inventory_core.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

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

SET FOREIGN_KEY_CHECKS = 1;
