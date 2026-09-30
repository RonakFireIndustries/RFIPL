create database if not exist rfipl_db;
use rfipl_db;

-- ------------------------------------------------------------
-- COMPANY SETTINGS
-- ------------------------------------------------------------
CREATE TABLE company_settings (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    companyName VARCHAR(150) NOT NULL,
    logoPath VARCHAR(500) NULL,
    email VARCHAR(150) NULL,
    phone VARCHAR(30) NULL,
    address TEXT NULL,
    gstNumber VARCHAR(50) NULL,
    panNumber VARCHAR(50) NULL,
    pfRegistrationNumber VARCHAR(100) NULL,
    esiRegistrationNumber VARCHAR(100) NULL,
    officeLatitude DECIMAL(10,7) NULL,
    officeLongitude DECIMAL(10,7) NULL,
    attendanceRadiusMeters INT UNSIGNED NOT NULL DEFAULT 100,
    currencyCode VARCHAR(10) NOT NULL DEFAULT 'INR',
    currencySymbol VARCHAR(10) NOT NULL DEFAULT '₹',
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata',
    storageProvider ENUM('local','s3','cloud') NOT NULL DEFAULT 'local',
    storageConfig JSON NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------
-- RBAC + AUTHENTICATION
-- ------------------------------------------------------------
CREATE TABLE users (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(150) NOT NULL UNIQUE,
    passwordHash VARCHAR(255) NOT NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    lastLoginAt DATETIME NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL
);

CREATE TABLE roles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description VARCHAR(255) NULL,
    isSystemRole BOOLEAN NOT NULL DEFAULT FALSE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL
);

CREATE TABLE permissions (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    module VARCHAR(100) NOT NULL,
    description VARCHAR(255) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL
);

CREATE TABLE user_roles (
    userId BIGINT UNSIGNED NOT NULL,
    roleId BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (userId, roleId),
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE
);

CREATE TABLE role_permissions (
    roleId BIGINT UNSIGNED NOT NULL,
    permissionId BIGINT UNSIGNED NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (roleId, permissionId),
    FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE
);

CREATE TABLE refresh_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT UNSIGNED NOT NULL,
    tokenHash VARCHAR(255) NOT NULL UNIQUE,
    expiresAt DATETIME NOT NULL,
    revokedAt DATETIME NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_refresh_tokens_user (userId),
    INDEX idx_refresh_tokens_expiry (expiresAt)
);

CREATE TABLE password_reset_tokens (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT UNSIGNED NOT NULL,
    tokenHash VARCHAR(255) NOT NULL UNIQUE,
    expiresAt DATETIME NOT NULL,
    usedAt DATETIME NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_password_reset_user (userId)
);

-- ------------------------------------------------------------
-- ORGANIZATION
-- ------------------------------------------------------------
CREATE TABLE departments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    code VARCHAR(30) NOT NULL UNIQUE,
    description TEXT NULL,
    hodEmployeeId BIGINT UNSIGNED NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL
);

CREATE TABLE designations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    code VARCHAR(30) NOT NULL UNIQUE,
    description TEXT NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL
);

-- ------------------------------------------------------------
-- EMPLOYEES
-- ------------------------------------------------------------
CREATE TABLE employees (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT UNSIGNED NULL UNIQUE,
    employeeCode VARCHAR(20) NOT NULL UNIQUE,
    firstName VARCHAR(100) NOT NULL,
    lastName VARCHAR(100) NULL,
    dateOfBirth DATE NULL,
    gender ENUM('male','female','other','prefer_not_to_say') NULL,
    profilePhotoPath VARCHAR(500) NULL,

    personalEmail VARCHAR(150) NULL,
    phone VARCHAR(30) NULL,

    currentAddress TEXT NULL,
    permanentAddress TEXT NULL,
    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'India',
    pincode VARCHAR(20) NULL,

    departmentId BIGINT UNSIGNED NOT NULL,
    designationId BIGINT UNSIGNED NOT NULL,
    reportingManagerId BIGINT UNSIGNED NULL,

    joiningDate DATE NOT NULL,
    employmentType ENUM('permanent','probation','temporary','intern') NOT NULL,
    employmentStatus ENUM('active','inactive','resigned','terminated','on_notice') NOT NULL DEFAULT 'active',

    aadhaarNumberEncrypted VARBINARY(512) NULL,
    panNumberEncrypted VARBINARY(512) NULL,

    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,

    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (departmentId) REFERENCES departments(id),
    FOREIGN KEY (designationId) REFERENCES designations(id),
    FOREIGN KEY (reportingManagerId) REFERENCES employees(id) ON DELETE SET NULL,

    INDEX idx_employees_department (departmentId),
    INDEX idx_employees_manager (reportingManagerId),
    INDEX idx_employees_status (employmentStatus)
);

ALTER TABLE departments
ADD CONSTRAINT fk_departments_hod
FOREIGN KEY (hodEmployeeId) REFERENCES employees(id) ON DELETE SET NULL;

CREATE TABLE employee_emergency_contacts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    relationship VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE employee_documents (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    documentType ENUM('aadhaar','pan','resume','offer_letter','other') NOT NULL,
    documentName VARCHAR(255) NOT NULL,
    documentNumberEncrypted VARBINARY(512) NULL,
    filePath VARCHAR(500) NOT NULL,
    storageProvider VARCHAR(50) NOT NULL DEFAULT 'local',
    issuedDate DATE NULL,
    expiryDate DATE NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee_documents_employee (employeeId)
);

CREATE TABLE employee_bank_details (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL UNIQUE,
    accountHolderName VARCHAR(150) NOT NULL,
    bankName VARCHAR(150) NOT NULL,
    accountNumberEncrypted VARBINARY(512) NOT NULL,
    ifscCode VARCHAR(20) NOT NULL,
    branchName VARCHAR(150) NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- SHIFTS + ATTENDANCE RULES
-- ------------------------------------------------------------
CREATE TABLE shifts (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    startTime TIME NOT NULL,
    endTime TIME NOT NULL,
    gracePeriodMinutes INT UNSIGNED NOT NULL DEFAULT 0,
    halfDayThresholdMinutes INT UNSIGNED NOT NULL DEFAULT 240,
    overtimeAfterEndTime BOOLEAN NOT NULL DEFAULT TRUE,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL
);

CREATE TABLE shift_week_offs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    shiftId BIGINT UNSIGNED NOT NULL,
    dayOfWeek TINYINT UNSIGNED NOT NULL COMMENT '0=Sunday ... 6=Saturday',
    FOREIGN KEY (shiftId) REFERENCES shifts(id) ON DELETE CASCADE,
    UNIQUE KEY uq_shift_weekoff (shiftId, dayOfWeek)
);

CREATE TABLE employee_shift_assignments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    shiftId BIGINT UNSIGNED NOT NULL,
    effectiveFrom DATE NOT NULL,
    effectiveTo DATE NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdBy BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (shiftId) REFERENCES shifts(id),
    FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_shift_assignment_employee_date (employeeId, effectiveFrom, effectiveTo)
);

CREATE TABLE attendance_rules (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    lateHalfDayThreshold INT UNSIGNED NOT NULL DEFAULT 3,
    lateFullDayThreshold INT UNSIGNED NOT NULL DEFAULT 5,
    resetPeriod ENUM('monthly') NOT NULL DEFAULT 'monthly',
    autoAbsentEnabled BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE holidays (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    holidayDate DATE NOT NULL UNIQUE,
    description TEXT NULL,
    category ENUM('national') NOT NULL DEFAULT 'national',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL
);

CREATE TABLE attendance_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    shiftId BIGINT UNSIGNED NULL,
    attendanceDate DATE NOT NULL,

    checkInAt DATETIME NULL,
    checkOutAt DATETIME NULL,

    checkInLatitude DECIMAL(10,7) NULL,
    checkInLongitude DECIMAL(10,7) NULL,
    checkInAccuracy DECIMAL(10,2) NULL,

    checkOutLatitude DECIMAL(10,7) NULL,
    checkOutLongitude DECIMAL(10,7) NULL,
    checkOutAccuracy DECIMAL(10,2) NULL,

    earlyMinutes INT NOT NULL DEFAULT 0,
    lateMinutes INT NOT NULL DEFAULT 0,
    workingMinutes INT NOT NULL DEFAULT 0,
    overtimeMinutes INT NOT NULL DEFAULT 0,

    status ENUM('present','late','half_day','leave','holiday','week_off','absent','incomplete') NOT NULL,
    lateSequenceNumber INT UNSIGNED NULL,
    lateDeductionType ENUM('none','half_day','full_day') NOT NULL DEFAULT 'none',
    notes TEXT NULL,

    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (shiftId) REFERENCES shifts(id) ON DELETE SET NULL,

    UNIQUE KEY uq_employee_attendance_day (employeeId, attendanceDate),
    INDEX idx_attendance_date_status (attendanceDate, status)
);

CREATE TABLE attendance_corrections (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    attendanceId BIGINT UNSIGNED NULL,
    correctionType ENUM(
        'wrong_checkin',
        'wrong_checkout',
        'forgot_checkin',
        'forgot_checkout'
    ) NOT NULL,
    requestedCheckInAt DATETIME NULL,
    requestedCheckOutAt DATETIME NULL,
    reason TEXT NOT NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    requestedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewedBy BIGINT UNSIGNED NULL,
    reviewedAt DATETIME NULL,
    reviewRemarks TEXT NULL,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (attendanceId) REFERENCES attendance_records(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewedBy) REFERENCES employees(id) ON DELETE SET NULL,
    INDEX idx_attendance_correction_employee (employeeId, status)
);

CREATE TABLE overtime_records (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    attendanceId BIGINT UNSIGNED NULL,
    overtimeDate DATE NOT NULL,
    overtimeMinutes INT UNSIGNED NOT NULL,
    hourlyRate DECIMAL(12,2) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    source ENUM('early_arrival','after_shift','manual') NOT NULL,
    status ENUM('pending','approved','rejected','included_in_payroll') NOT NULL DEFAULT 'pending',
    approvedBy BIGINT UNSIGNED NULL,
    approvedAt DATETIME NULL,
    remarks TEXT NULL,
    payrollId BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (attendanceId) REFERENCES attendance_records(id) ON DELETE SET NULL,
    FOREIGN KEY (approvedBy) REFERENCES employees(id) ON DELETE SET NULL,
    INDEX idx_overtime_employee_date (employeeId, overtimeDate, status)
);

-- ------------------------------------------------------------
-- LEAVE MANAGEMENT
-- ------------------------------------------------------------
CREATE TABLE leave_types (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(30) NOT NULL UNIQUE,
    annualLimit DECIMAL(5,1) NULL,
    isPaid BOOLEAN NOT NULL DEFAULT TRUE,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL
);

CREATE TABLE leave_requests (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    leaveTypeId BIGINT UNSIGNED NOT NULL,
    fromDate DATE NOT NULL,
    toDate DATE NOT NULL,
    durationType ENUM('full_day','half_day') NOT NULL DEFAULT 'full_day',
    halfDayPeriod ENUM('first_half','second_half') NULL,
    totalDays DECIMAL(6,1) NOT NULL,
    reason TEXT NOT NULL,
    status ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
    requestedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    reviewedBy BIGINT UNSIGNED NULL,
    reviewedAt DATETIME NULL,
    reviewRemarks TEXT NULL,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (leaveTypeId) REFERENCES leave_types(id),
    FOREIGN KEY (reviewedBy) REFERENCES employees(id) ON DELETE SET NULL,
    INDEX idx_leave_employee_dates (employeeId, fromDate, toDate),
    INDEX idx_leave_status (status)
);

-- ------------------------------------------------------------
-- SALARY COMPONENTS + STATUTORY SETTINGS
-- ------------------------------------------------------------
CREATE TABLE salary_components (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL UNIQUE,
    code VARCHAR(50) NOT NULL UNIQUE,
    componentType ENUM('earning','deduction') NOT NULL,
    calculationType ENUM('fixed','percentage','formula','manual') NOT NULL,
    formulaExpression TEXT NULL,
    isTaxable BOOLEAN NOT NULL DEFAULT FALSE,
    pfApplicable BOOLEAN NOT NULL DEFAULT FALSE,
    esiApplicable BOOLEAN NOT NULL DEFAULT FALSE,
    isStatutory BOOLEAN NOT NULL DEFAULT FALSE,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL
);

CREATE TABLE statutory_configurations (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    componentCode VARCHAR(50) NOT NULL,
    calculationType ENUM('fixed','percentage','formula') NOT NULL,
    rate DECIMAL(10,4) NULL,
    formulaExpression TEXT NULL,
    effectiveFrom DATE NOT NULL,
    effectiveTo DATE NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_statutory_effective (componentCode, effectiveFrom, effectiveTo)
);

CREATE TABLE salary_structures (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL
);

CREATE TABLE salary_structure_components (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    salaryStructureId BIGINT UNSIGNED NOT NULL,
    salaryComponentId BIGINT UNSIGNED NOT NULL,
    calculationType ENUM('fixed','percentage','formula','manual') NOT NULL,
    amount DECIMAL(14,2) NULL,
    percentage DECIMAL(10,4) NULL,
    formulaExpression TEXT NULL,
    sortOrder INT NOT NULL DEFAULT 0,
    FOREIGN KEY (salaryStructureId) REFERENCES salary_structures(id) ON DELETE CASCADE,
    FOREIGN KEY (salaryComponentId) REFERENCES salary_components(id),
    UNIQUE KEY uq_structure_component (salaryStructureId, salaryComponentId)
);

CREATE TABLE employee_salary_structures (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    salaryStructureId BIGINT UNSIGNED NOT NULL,
    effectiveFrom DATE NOT NULL,
    effectiveTo DATE NULL,
    status ENUM('active','inactive') NOT NULL DEFAULT 'active',
    revisionReason TEXT NULL,
    createdBy BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (salaryStructureId) REFERENCES salary_structures(id),
    FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_employee_salary_effective (employeeId, effectiveFrom, effectiveTo)
);

CREATE TABLE employee_overtime_rates (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    hourlyRate DECIMAL(12,2) NOT NULL,
    effectiveFrom DATE NOT NULL,
    effectiveTo DATE NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    INDEX idx_employee_ot_rate (employeeId, effectiveFrom)
);

-- ------------------------------------------------------------
-- BONUS / INCENTIVES
-- ------------------------------------------------------------
CREATE TABLE bonus_incentives (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    type ENUM('bonus','incentive') NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    reason TEXT NULL,
    applicableMonth DATE NOT NULL,
    status ENUM('pending','approved','rejected','included_in_payroll') NOT NULL DEFAULT 'pending',
    createdBy BIGINT UNSIGNED NULL,
    approvedBy BIGINT UNSIGNED NULL,
    approvedAt DATETIME NULL,
    payrollId BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (createdBy) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approvedBy) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_bonus_employee_month (employeeId, applicableMonth, status)
);

-- ------------------------------------------------------------
-- PAYROLL
-- ------------------------------------------------------------
CREATE TABLE payroll_periods (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    monthNumber TINYINT UNSIGNED NOT NULL,
    yearNumber SMALLINT UNSIGNED NOT NULL,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL,
    status ENUM('open','processing','locked') NOT NULL DEFAULT 'open',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_payroll_period (monthNumber, yearNumber)
);

CREATE TABLE payrolls (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payrollPeriodId BIGINT UNSIGNED NOT NULL,
    employeeId BIGINT UNSIGNED NOT NULL,

    totalCalendarDays INT UNSIGNED NOT NULL,
    payableDays DECIMAL(6,2) NOT NULL,
    absentDays DECIMAL(6,2) NOT NULL DEFAULT 0,
    halfDays DECIMAL(6,2) NOT NULL DEFAULT 0,
    paidLeaveDays DECIMAL(6,2) NOT NULL DEFAULT 0,
    lateHalfDayDeductions DECIMAL(6,2) NOT NULL DEFAULT 0,
    lateFullDayDeductions DECIMAL(6,2) NOT NULL DEFAULT 0,
    overtimeMinutes INT UNSIGNED NOT NULL DEFAULT 0,

    grossEarnings DECIMAL(14,2) NOT NULL DEFAULT 0,
    totalDeductions DECIMAL(14,2) NOT NULL DEFAULT 0,
    overtimeAmount DECIMAL(14,2) NOT NULL DEFAULT 0,
    bonusIncentiveAmount DECIMAL(14,2) NOT NULL DEFAULT 0,
    netSalary DECIMAL(14,2) NOT NULL DEFAULT 0,

    status ENUM(
        'generated',
        'pending_accounts',
        'pending_admin',
        'approved',
        'locked',
        'regenerated'
    ) NOT NULL DEFAULT 'generated',

    generatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lockedAt DATETIME NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (payrollPeriodId) REFERENCES payroll_periods(id),
    FOREIGN KEY (employeeId) REFERENCES employees(id),

    UNIQUE KEY uq_payroll_period_employee (payrollPeriodId, employeeId),
    INDEX idx_payroll_status (status)
);

ALTER TABLE overtime_records
ADD CONSTRAINT fk_overtime_payroll
FOREIGN KEY (payrollId) REFERENCES payrolls(id) ON DELETE SET NULL;

ALTER TABLE bonus_incentives
ADD CONSTRAINT fk_bonus_payroll
FOREIGN KEY (payrollId) REFERENCES payrolls(id) ON DELETE SET NULL;

CREATE TABLE payroll_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payrollId BIGINT UNSIGNED NOT NULL,
    salaryComponentId BIGINT UNSIGNED NULL,
    componentName VARCHAR(150) NOT NULL,
    componentCode VARCHAR(50) NULL,
    componentType ENUM('earning','deduction') NOT NULL,
    calculatedAmount DECIMAL(14,2) NOT NULL,
    calculationDetails JSON NULL,
    FOREIGN KEY (payrollId) REFERENCES payrolls(id) ON DELETE CASCADE,
    FOREIGN KEY (salaryComponentId) REFERENCES salary_components(id) ON DELETE SET NULL,
    INDEX idx_payroll_items_payroll (payrollId)
);

CREATE TABLE payroll_approvals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payrollId BIGINT UNSIGNED NOT NULL,
    approvalLevel ENUM('accounts','admin') NOT NULL,
    approvedBy BIGINT UNSIGNED NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    remarks TEXT NULL,
    actionAt DATETIME NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payrollId) REFERENCES payrolls(id) ON DELETE CASCADE,
    FOREIGN KEY (approvedBy) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY uq_payroll_approval_level (payrollId, approvalLevel)
);

CREATE TABLE payslips (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    payrollId BIGINT UNSIGNED NOT NULL UNIQUE,
    payslipNumber VARCHAR(50) NOT NULL UNIQUE,
    generatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    filePath VARCHAR(500) NULL,
    FOREIGN KEY (payrollId) REFERENCES payrolls(id) ON DELETE CASCADE
);

-- ------------------------------------------------------------
-- EXPENSES / REIMBURSEMENTS
-- ------------------------------------------------------------
CREATE TABLE expense_categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL
);

CREATE TABLE expense_claims (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    expenseCategoryId BIGINT UNSIGNED NOT NULL,
    expenseDate DATE NOT NULL,
    amount DECIMAL(14,2) NOT NULL,
    description TEXT NOT NULL,
    status ENUM('pending','manager_approved','accounts_approved','rejected') NOT NULL DEFAULT 'pending',
    submittedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deletedAt DATETIME NULL,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (expenseCategoryId) REFERENCES expense_categories(id),
    INDEX idx_expense_employee_status (employeeId, status)
);

CREATE TABLE expense_attachments (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    expenseClaimId BIGINT UNSIGNED NOT NULL,
    fileName VARCHAR(255) NOT NULL,
    filePath VARCHAR(500) NOT NULL,
    fileType VARCHAR(100) NULL,
    storageProvider VARCHAR(50) NOT NULL DEFAULT 'local',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expenseClaimId) REFERENCES expense_claims(id) ON DELETE CASCADE
);

CREATE TABLE expense_approvals (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    expenseClaimId BIGINT UNSIGNED NOT NULL,
    approvalLevel ENUM('manager','accounts') NOT NULL,
    approvedBy BIGINT UNSIGNED NULL,
    status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
    remarks TEXT NULL,
    actionAt DATETIME NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (expenseClaimId) REFERENCES expense_claims(id) ON DELETE CASCADE,
    FOREIGN KEY (approvedBy) REFERENCES employees(id) ON DELETE SET NULL,
    UNIQUE KEY uq_expense_approval_level (expenseClaimId, approvalLevel)
);

-- ------------------------------------------------------------
-- DPR
-- ------------------------------------------------------------
CREATE TABLE daily_reports (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    reportDate DATE NOT NULL,
    workSummary TEXT NOT NULL,
    tasksCompleted TEXT NULL,
    hoursWorked DECIMAL(5,2) NULL,
    problemsBlockers TEXT NULL,
    tomorrowPlan TEXT NULL,
    status ENUM('draft','submitted','approved','rejected','rework') NOT NULL DEFAULT 'draft',
    submittedAt DATETIME NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    UNIQUE KEY uq_employee_dpr_day (employeeId, reportDate)
);

CREATE TABLE daily_report_reviews (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    dailyReportId BIGINT UNSIGNED NOT NULL,
    reviewerId BIGINT UNSIGNED NOT NULL,
    status ENUM('approved','rejected','rework') NOT NULL,
    remarks TEXT NULL,
    reviewedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (dailyReportId) REFERENCES daily_reports(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewerId) REFERENCES employees(id)
);

-- ------------------------------------------------------------
-- PERFORMANCE + KPI
-- ------------------------------------------------------------
CREATE TABLE performance_review_cycles (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    periodType ENUM('monthly','quarterly','half_yearly','yearly') NOT NULL,
    startDate DATE NOT NULL,
    endDate DATE NOT NULL,
    status ENUM('draft','active','closed') NOT NULL DEFAULT 'draft',
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE rating_scales (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    minScore DECIMAL(5,2) NOT NULL,
    maxScore DECIMAL(5,2) NOT NULL,
    label VARCHAR(100) NOT NULL,
    description TEXT NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE kpis (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT NULL,
    unit VARCHAR(50) NULL,
    isActive BOOLEAN NOT NULL DEFAULT TRUE,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE employee_kpis (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    kpiId BIGINT UNSIGNED NOT NULL,
    reviewCycleId BIGINT UNSIGNED NOT NULL,
    targetValue DECIMAL(14,2) NULL,
    actualValue DECIMAL(14,2) NULL,
    weightage DECIMAL(5,2) NOT NULL DEFAULT 0,
    remarks TEXT NULL,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (kpiId) REFERENCES kpis(id),
    FOREIGN KEY (reviewCycleId) REFERENCES performance_review_cycles(id),
    UNIQUE KEY uq_employee_kpi_cycle (employeeId, kpiId, reviewCycleId)
);

CREATE TABLE performance_reviews (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    employeeId BIGINT UNSIGNED NOT NULL,
    reviewCycleId BIGINT UNSIGNED NOT NULL,
    selfAssessment TEXT NULL,
    managerReview TEXT NULL,
    finalScore DECIMAL(5,2) NULL,
    ratingScaleId BIGINT UNSIGNED NULL,
    status ENUM('draft','self_submitted','manager_reviewed','completed') NOT NULL DEFAULT 'draft',
    reviewedBy BIGINT UNSIGNED NULL,
    reviewedAt DATETIME NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (employeeId) REFERENCES employees(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewCycleId) REFERENCES performance_review_cycles(id),
    FOREIGN KEY (ratingScaleId) REFERENCES rating_scales(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewedBy) REFERENCES employees(id) ON DELETE SET NULL,
    UNIQUE KEY uq_employee_review_cycle (employeeId, reviewCycleId)
);

-- ------------------------------------------------------------
-- NOTIFICATIONS + AUDIT LOGS
-- ------------------------------------------------------------
CREATE TABLE notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT UNSIGNED NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(100) NOT NULL,
    isRead BOOLEAN NOT NULL DEFAULT FALSE,
    relatedModule VARCHAR(100) NULL,
    relatedModuleId BIGINT UNSIGNED NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    readAt DATETIME NULL,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_notifications_user_read (userId, isRead)
);

CREATE TABLE audit_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    userId BIGINT UNSIGNED NULL,
    action VARCHAR(100) NOT NULL,
    module VARCHAR(100) NOT NULL,
    recordId BIGINT UNSIGNED NULL,
    oldValues JSON NULL,
    newValues JSON NULL,
    ipAddress VARCHAR(45) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_module_record (module, recordId),
    INDEX idx_audit_user_date (userId, createdAt)
);

-- ------------------------------------------------------------
-- DEFAULT ROLES
-- ------------------------------------------------------------
INSERT INTO roles (name, description, isSystemRole) VALUES
('Super Admin', 'Full system access', TRUE),
('Admin', 'Administrative access', TRUE),
('HR', 'Human resources management', TRUE),
('Accounts', 'Payroll and accounts access', TRUE),
('Department Manager', 'Department and team management', TRUE),
('Employee', 'Standard employee access', TRUE),
('Helper/Worker', 'Worker access', TRUE);

-- ------------------------------------------------------------
-- DEFAULT LEAVE TYPES
-- ------------------------------------------------------------
INSERT INTO leave_types (name, code, annualLimit, isPaid) VALUES
('Paid Leave', 'PAID', 12, TRUE),
('Sick Leave', 'SICK', 10, TRUE);

-- ------------------------------------------------------------
-- DEFAULT EXPENSE CATEGORIES
-- ------------------------------------------------------------
INSERT INTO expense_categories (name) VALUES
('Travel'),
('Food'),
('Accommodation'),
('Fuel'),
('Office Supplies'),
('Others');