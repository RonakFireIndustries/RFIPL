import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import Layout from '@/components/Layout';
import Login from '@/pages/Login';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Dashboard from '@/pages/Dashboard';
import Employees from '@/pages/Employees';
import EmployeeDetail from '@/pages/EmployeeDetail';
import Departments from '@/pages/Departments';
import Designations from '@/pages/Designations';
import Shifts from '@/pages/Shifts';
import Attendance from '@/pages/Attendance';
import MyAttendance from '@/pages/MyAttendance';
import Leave from '@/pages/Leave';
import WorkLocations from '@/pages/WorkLocations';
import Payroll from '@/pages/Payroll';
import InventoryOverview from '@/pages/inventory/Overview';
import InventoryUnits from '@/pages/inventory/Units';
import InventoryCategories from '@/pages/inventory/Categories';
import InventorySuppliers from '@/pages/inventory/Suppliers';
import RawMaterials from '@/pages/inventory/RawMaterials';
import InventoryBatches from '@/pages/inventory/Batches';
import InventoryStock from '@/pages/inventory/Stock';
import InventoryLedger from '@/pages/inventory/Ledger';
import InventoryPurchasing from '@/pages/inventory/Purchasing';
import InventoryProduction from '@/pages/inventory/Production';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/employees" element={<Employees />} />
              <Route path="/employees/:id" element={<EmployeeDetail />} />
              <Route path="/departments" element={<Departments />} />
              <Route path="/designations" element={<Designations />} />
              <Route path="/shifts" element={<Shifts />} />
              <Route path="/attendance" element={<Attendance />} />
              <Route path="/my-attendance" element={<MyAttendance />} />
              <Route path="/leave" element={<Leave />} />
              <Route path="/locations" element={<WorkLocations />} />
              <Route path="/payroll" element={<Payroll />} />

              <Route path="/inventory" element={<InventoryOverview />} />
              <Route path="/inventory/units" element={<InventoryUnits />} />
              <Route path="/inventory/categories" element={<InventoryCategories />} />
              <Route path="/inventory/suppliers" element={<InventorySuppliers />} />
              <Route path="/inventory/raw-materials" element={<RawMaterials />} />
              <Route path="/inventory/batches" element={<InventoryBatches />} />
              <Route path="/inventory/stock" element={<InventoryStock />} />
              <Route path="/inventory/ledger" element={<InventoryLedger />} />
              <Route path="/inventory/purchasing" element={<InventoryPurchasing />} />
              <Route path="/inventory/production" element={<InventoryProduction />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}