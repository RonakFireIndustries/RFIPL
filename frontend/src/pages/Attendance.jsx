import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAttendanceRecords, createAttendanceRecord, updateAttendanceRecord, deleteAttendanceRecord } from '@/api/attendance';
import { getEmployees } from '@/api/dropdowns';
import { getShifts } from '@/api/dropdowns';
import { getActiveWorkLocation } from '@/api/workLocations';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from './Attendance.module.css';

const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'leave', label: 'Leave' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'week_off', label: 'Week Off' },
  { value: 'absent', label: 'Absent' },
  { value: 'incomplete', label: 'Incomplete' },
];

const LATE_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'half_day', label: 'Half Day' },
  { value: 'full_day', label: 'Full Day' },
];

function getDefault(record) {
  if (record) {
    return {
      employeeId: record.employeeId,
      shiftId: record.shiftId || '',
      attendanceDate: record.attendanceDate ? record.attendanceDate.split('T')[0] : '',
      status: record.status || 'present',
      checkInAt: record.checkInAt ? record.checkInAt.split('T')[1]?.slice(0, 5) || record.checkInAt.slice(0, 5) : '',
      checkOutAt: record.checkOutAt ? record.checkOutAt.split('T')[1]?.slice(0, 5) || record.checkOutAt.slice(0, 5) : '',
      notes: record.notes || '',
    };
  }
  return {
    employeeId: '', shiftId: '', attendanceDate: '', status: 'present',
    checkInAt: '', checkOutAt: '', notes: '',
  };
}

export default function Attendance() {
  const { accessToken } = useAuth();
  const [data, setData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [shifts, setShiftsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ employeeId: '', fromDate: '', toDate: '', status: '' });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => getDefault(null));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getAttendanceRecords(filters, accessToken));
    } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, filters.employeeId, filters.fromDate, filters.toDate, filters.status]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getEmployees(accessToken).then(setEmployees).catch(() => {});
    getShifts(accessToken).then(setShiftsList).catch(() => {});
  }, [accessToken]);

  const openCreate = () => { setEditing(null); setForm(getDefault(null)); setError(''); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm(getDefault(row)); setError(''); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.employeeId || !form.attendanceDate) {
      setError('Please select an employee and date');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '' || payload[k] === null) payload[k] = null;
      });
      if (editing) await updateAttendanceRecord(editing.id, payload, accessToken);
      else await createAttendanceRecord(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete attendance record for ${row.firstName} ${row.lastName || ''} on ${row.attendanceDate?.split('T')[0]}?`)) return;
    try { await deleteAttendanceRecord(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const statusMap = {
    present: { color: '#16a34a' }, late: { color: '#f59e0b' }, half_day: { color: '#fb923c' },
    leave: { color: '#3b82f6' }, holiday: { color: '#8b5cf6' }, week_off: { color: '#64748b' },
    absent: { color: '#DC2626' }, incomplete: { color: '#6b7280' },
  };

  const [workLocation, setWorkLocation] = useState(null);
  useEffect(() => {
    getActiveWorkLocation(accessToken).then(setWorkLocation).catch(() => {});
  }, [accessToken]);

  const distanceFromSite = (r) => {
    const loc = workLocation;
    const lat = Number(r.checkInLatitude);
    const lng = Number(r.checkInLongitude);
    if (!loc || !r.checkInLatitude || !r.checkInLongitude) return null;
    const toRad = (d) => (d * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(loc.latitude - lat);
    const dLng = toRad(loc.longitude - lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat)) * Math.cos(toRad(loc.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  };

  const columns = [
    { key: 'attendanceDate', label: 'Date', width: '110px', render: (v) => v?.split('T')[0] },
    { key: 'employeeCode', label: 'Code', width: '90px' },
    { key: 'firstName', label: 'Employee', render: (_, r) => `${r.firstName} ${r.lastName || ''}` },
    { key: 'shiftName', label: 'Shift', width: '100px' },
    { key: 'status', label: 'Status', width: '100px', render: (v) => <span className={styles.badge} style={{ color: statusMap[v]?.color, background: `${statusMap[v]?.color}15` }}>{v?.replace('_', ' ')}</span> },
    { key: 'checkInAt', label: 'Check In', width: '120px', render: (v) => v?.slice(0, 5) },
    { key: 'checkOutAt', label: 'Check Out', width: '120px', render: (v) => v?.slice(0, 5) },
    { key: 'geo', label: 'Geo', width: '100px', render: (_, r) => {
      const d = distanceFromSite(r);
      if (d === null) return <span style={{ color: '#9ca3af', fontSize: 12 }}>—</span>;
      const within = d <= Number(workLocation.radiusMeters);
      return (
        <span className={styles.badge} style={{ color: within ? '#16a34a' : '#DC2626', background: within ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)' }}>
          {Math.round(d)}m {within ? '· on site' : '· outside'}
        </span>
      );
    }},
    { key: 'workingMinutes', label: 'Worked', width: '80px', render: (v) => v ? `${Math.round(v / 60)}h` : '-' },
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
          <h1 className={styles.pageTitle}>Attendance</h1>
          <p className={styles.pageSub}>{data.length} records</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Record</button>
      </div>

      <div className={styles.filters}>
        <select className={styles.filterSelect} value={filters.employeeId} onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}>
          <option value="">All Employees</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.firstName} {e.lastName || ''}</option>)}
        </select>
        <input className={styles.filterInput} type="date" value={filters.fromDate} onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })} />
        <input className={styles.filterInput} type="date" value={filters.toDate} onChange={(e) => setFilters({ ...filters, toDate: e.target.value })} />
        <select className={styles.filterSelect} value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">All Status</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No attendance records found" />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Attendance' : 'New Attendance Record'} width={560}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Employee" type="select" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} options={employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName || ''}` }))} required />
            <FormField label="Date" type="date" value={form.attendanceDate} onChange={(e) => setForm({ ...form, attendanceDate: e.target.value })} required />
            <FormField label="Status" type="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={STATUS_OPTIONS} required />
            <FormField label="Shift" type="select" value={form.shiftId} onChange={(e) => setForm({ ...form, shiftId: e.target.value })} options={shifts.map((s) => ({ value: s.id, label: s.name }))} />
            <FormField label="Check In" type="time" value={form.checkInAt} onChange={(e) => setForm({ ...form, checkInAt: e.target.value })} />
            <FormField label="Check Out" type="time" value={form.checkOutAt} onChange={(e) => setForm({ ...form, checkOutAt: e.target.value })} />
          </div>
          <FormField label="Notes" type="textarea" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}