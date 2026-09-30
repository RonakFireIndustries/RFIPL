-- ------------------------------------------------------------
-- LEAVE BALANCES (annual entitlement per employee / leave type)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_balances (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    leaveTypeId BIGINT UNSIGNED NOT NULL,
    year SMALLINT UNSIGNED NOT NULL,
    allocatedDays DECIMAL(6,1) NULL,
    usedDays DECIMAL(6,1) NOT NULL DEFAULT 0,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_emp_type_year (employeeId, leaveTypeId, year),
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (leaveTypeId) REFERENCES leave_types(id),
    INDEX idx_bal_emp_year (employeeId, year)
);