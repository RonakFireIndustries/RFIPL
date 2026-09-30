import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getEmployees, getEmployeeStats, deleteEmployee } from '@/api/employees';
import { getActiveDepartments } from '@/api/departments';
import { getActiveDesignations } from '@/api/designations';
import Table from '@/components/ui/Table';
import StatsCard from '@/components/ui/StatsCard';
import Drawer from '@/components/ui/Drawer';
import EmployeeForm from '@/components/EmployeeForm';
import { useInteractions } from '@/components/ui/interactions';
import styles from './Employees.module.css';

const STATUS_FILTERS = [
  { key: '', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'resigned', label: 'Resigned' },
  { key: 'terminated', label: 'Terminated' },
  { key: 'on_notice', label: 'On Notice' },
];

export default function Employees() {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const { toast } = useInteractions();
  const [data, setData] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [desigFilter, setDesigFilter] = useState('');
  const [departments, setDepartments] = useState([]);
  const [designations, setDesignations] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter) params.employmentStatus = statusFilter;
      if (deptFilter) params.departmentId = deptFilter;
      if (desigFilter) params.designationId = desigFilter;
      const [empData, statsData] = await Promise.all([
        getEmployees(accessToken, params),
        getEmployeeStats(accessToken),
      ]);
      setData(empData);
      setStats(statsData);
    } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, search, statusFilter, deptFilter, desigFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getActiveDepartments(accessToken).then(setDepartments).catch(() => {});
    getActiveDesignations(accessToken).then(setDesignations).catch(() => {});
  }, [accessToken]);

  const handleDelete = async (row) => {
    if (!confirm(`Delete employee "${row.firstName} ${row.lastName || ''}"?`)) return;
    try { await deleteEmployee(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const openCreate = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit = (row) => { setEditing(row); setDrawerOpen(true); };
  const handleSaved = (data) => {
    setDrawerOpen(false);
    load();
    if (data?.autoLoginEmail && data?.autoLoginPassword) {
      toast('success', `Login account auto-created: ${data.autoLoginEmail} / ${data.autoLoginPassword}`);
    }
  };

  const statusColor = (s) => {
    const m = { active: '#16a34a', inactive: '#6b7280', resigned: '#f59e0b', terminated: '#DC2626', on_notice: '#3b82f6' };
    return m[s] || '#6b7280';
  };

  const columns = [
    { key: 'employeeCode', label: 'Code', width: '100px' },
    { key: 'firstName', label: 'Name', render: (_, r) => `${r.firstName} ${r.lastName || ''}` },
    { key: 'departmentName', label: 'Department' },
    { key: 'designationName', label: 'Designation' },
    { key: 'phone', label: 'Phone', width: '120px' },
    { key: 'employmentStatus', label: 'Status', width: '110px', render: (v) => <span className={styles.badge} style={{ color: statusColor(v), background: `${statusColor(v)}15` }}>{v?.replace('_', ' ')}</span> },
    { key: 'id', label: '', width: '100px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); openEdit(row); }}>Edit</button>
        <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>Del</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Employees</h1>
          <p className={styles.pageSub}>{data.length} employees</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Employee</button>
      </div>

      {stats && (
        <div className={styles.stats}>
          <StatsCard label="Total" value={stats.total} color="#6b7280" />
          <StatsCard label="Active" value={Number(stats.active)} color="#16a34a" onClick={() => setStatusFilter(statusFilter === 'active' ? '' : 'active')} active={statusFilter === 'active'} />
          <StatsCard label="Inactive" value={Number(stats.inactive)} color="#6b7280" onClick={() => setStatusFilter(statusFilter === 'inactive' ? '' : 'inactive')} active={statusFilter === 'inactive'} />
          <StatsCard label="Resigned" value={Number(stats.resigned)} color="#f59e0b" onClick={() => setStatusFilter(statusFilter === 'resigned' ? '' : 'resigned')} active={statusFilter === 'resigned'} />
          <StatsCard label="Terminated" value={Number(stats.terminated)} color="#DC2626" onClick={() => setStatusFilter(statusFilter === 'terminated' ? '' : 'terminated')} active={statusFilter === 'terminated'} />
          <StatsCard label="On Notice" value={Number(stats.onNotice)} color="#3b82f6" onClick={() => setStatusFilter(statusFilter === 'on_notice' ? '' : 'on_notice')} active={statusFilter === 'on_notice'} />
        </div>
      )}

      <div className={styles.filters}>
        <input className={styles.searchInput} type="text" placeholder="Search by name, code, phone..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className={styles.filterSelect} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select className={styles.filterSelect} value={desigFilter} onChange={(e) => setDesigFilter(e.target.value)}>
          <option value="">All Designations</option>
          {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        {STATUS_FILTERS.length > 0 && (
          <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_FILTERS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        )}
      </div>

      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} onRowClick={(row) => navigate(`/employees/${row.id}`)} emptyMessage="No employees found" />
      )}

      <Drawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} title={editing ? 'Edit Employee' : 'New Employee'} width={560}>
        <EmployeeForm employee={editing} departments={departments} designations={designations} onSave={handleSaved} onCancel={() => setDrawerOpen(false)} />
      </Drawer>
    </div>
  );
}