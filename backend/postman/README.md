# RFIPL Employee API Testing

This folder contains everything you need to test the employee management APIs.

## 1. Postman (recommended)

Import the collection file:

```
postman/RFIPL_Employee_API.postman_collection.json
```

**Steps:**
1. Open Postman → **File > Import** → select the JSON file.
2. Set the collection variable `baseUrl` (default is `http://localhost:5000`).
3. Ensure the server is running (`npm run test` in `backend/`) and the DB is imported (`sql/hrms and payroll.sql`).
4. Run requests in each folder **in order** (Create first, then Read/Update/Delete). The scripts auto-save returned IDs like `departmentId`, `employeeId` etc. into collection variables, so later requests that reference `{{employeeId}}` work automatically.

> **Note on Shift Assignments / Salary Structures:** these need a record in the `shifts` / `salary_structures` tables first. If none exist, run e.g.:
> ```sql
> INSERT INTO shifts (name, startTime, endTime) VALUES ('General', '09:00:00', '18:00:00');
> INSERT INTO salary_structures (name) VALUES ('Monthly Salary');
> ```
> Then set `shiftId` / `salaryStructureId` = 1 in the request body.

## 2. Testing with cURL (PowerShell)

Start the server first, then run one of these as a quick sanity check:

```powershell
# Health check
curl.exe http://localhost:5000/api/health

# Get all employees
curl.exe http://localhost:5000/api/employees
```

## API Reference

### Base URL: `http://localhost:5000`

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| | **Employees** | |
| GET | `/api/employees` | List (filters: `departmentId`, `designationId`, `employmentStatus`, `search`) |
| GET | `/api/employees/stats` | Employee count by status |
| GET | `/api/employees/:id` | Get one |
| POST | `/api/employees` | Create |
| PUT | `/api/employees/:id` | Update |
| PATCH | `/api/employees/:id/status` | Update employment status |
| DELETE | `/api/employees/:id` | Soft delete |
| | **Departments** | |
| GET | `/api/departments` | List |
| GET | `/api/departments/active` | List active |
| GET | `/api/departments/:id` | Get one |
| POST | `/api/departments` | Create |
| PUT | `/api/departments/:id` | Update |
| DELETE | `/api/departments/:id` | Soft delete |
| | **Designations** | |
| GET | `/api/designations` | List |
| GET | `/api/designations/active` | List active |
| GET | `/api/designations/:id` | Get one |
| POST | `/api/designations` | Create |
| PUT | `/api/designations/:id` | Update |
| DELETE | `/api/designations/:id` | Soft delete |
| | **Emergency Contacts** | |
| GET | `/api/emergency-contacts/employee/:employeeId` | By employee |
| GET | `/api/emergency-contacts/:id` | Get one |
| POST | `/api/emergency-contacts` | Create |
| PUT | `/api/emergency-contacts/:id` | Update |
| DELETE | `/api/emergency-contacts/:id` | Delete |
| | **Documents** | |
| GET | `/api/documents/employee/:employeeId` | By employee |
| GET | `/api/documents/:id` | Get one |
| POST | `/api/documents` | Create |
| PUT | `/api/documents/:id` | Update |
| DELETE | `/api/documents/:id` | Soft delete |
| | **Bank Details** | |
| GET | `/api/bank-details/employee/:employeeId` | By employee |
| GET | `/api/bank-details/:id` | Get one |
| POST | `/api/bank-details` | Create |
| PUT | `/api/bank-details/:id` | Update |
| DELETE | `/api/bank-details/:id` | Delete |
| | **Shift Assignments** | |
| GET | `/api/shift-assignments/employee/:employeeId` | By employee |
| GET | `/api/shift-assignments/active/:employeeId` | Current active shift |
| GET | `/api/shift-assignments/:id` | Get one |
| POST | `/api/shift-assignments` | Create |
| PUT | `/api/shift-assignments/:id` | Update |
| DELETE | `/api/shift-assignments/:id` | Delete |
| | **Salary Structures** | |
| GET | `/api/salary-structures/employee/:employeeId` | By employee |
| GET | `/api/salary-structures/active/:employeeId` | Current active structure |
| GET | `/api/salary-structures/:id` | Get one |
| POST | `/api/salary-structures` | Create |
| PUT | `/api/salary-structures/:id` | Update |
| DELETE | `/api/salary-structures/:id` | Delete |
| | **Overtime Rates** | |
| GET | `/api/overtime-rates/employee/:employeeId` | By employee |
| GET | `/api/overtime-rates/active/:employeeId` | Current active rate |
| GET | `/api/overtime-rates/:id` | Get one |
| POST | `/api/overtime-rates` | Create |
| PUT | `/api/overtime-rates/:id` | Update |
| DELETE | `/api/overtime-rates/:id` | Delete |
