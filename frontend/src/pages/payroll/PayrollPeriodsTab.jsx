import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getPayrollPeriods, createPayrollPeriod, updatePayrollPeriod, deletePayrollPeriod } from '@/api/payrollPeriods';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from '@/pages/ModulePage.module.css';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'processing', label: 'Processing' },
  { value: 'closed', label: 'Closed' },
  { value: 'archived', label: 'Archived' },
];

export default function PayrollPeriodsTab() {
  const { accessToken } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ monthNumber: 1, yearNumber: new Date().getFullYear(), startDate: '', endDate: '', name: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getPayrollPeriods(accessToken)); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ monthNumber: new Date().getMonth() + 1, yearNumber: new Date().getFullYear(), startDate: '', endDate: '', name: '' });
    setError(''); setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({ monthNumber: row.monthNumber, yearNumber: row.yearNumber, startDate: row.startDate?.split('T')[0], endDate: row.endDate?.split('T')[0], name: row.name });
    setError(''); setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.monthNumber || !form.yearNumber || !form.startDate || !form.endDate) {
      setError('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      if (editing) await updatePayrollPeriod(editing.id, { ...form, status: form.status }, accessToken);
      else await createPayrollPeriod(form, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to save'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete payroll period "${row.name}"?`)) return;
    try { await deletePayrollPeriod(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const handleStatusChange = async (row, status) => {
    try { await updatePayrollPeriod(row.id, { status }, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const columns = [
    { key: 'NAME', label: 'Period' },
    { key: 'monthNumber', label: 'Month', width: '90px', render: (v) => monthNames[v - 1] },
    { key: 'yearNumber', label: 'Year', width: '80px' },
    { key: 'startDate', label: 'Start', width: '110px', render: (v) => v?.split('T')[0] },
    { key: 'endDate', label: 'End', width: '110px', render: (v) => v?.split('T')[0] },
    { key: 'status', label: 'Status', width: '130px', render: (v, row) => (
      <select className={styles.statusSelect} value={v} onChange={(e) => handleStatusChange(row, e.target.value)}>
        {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
      </select>
    )},
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
          <h1 className={styles.pageTitle}>Payroll Periods</h1>
          <p className={styles.pageSub}>{data.length} periods</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Period</button>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : <Table columns={columns} data={data} emptyMessage="No payroll periods found" />}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Payroll Period' : 'New Payroll Period'} width={520}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Month" type="select" value={form.monthNumber} onChange={(e) => setForm({ ...form, monthNumber: Number(e.target.value) })} options={monthNames.map((m, i) => ({ value: i + 1, label: m }))} required />
            <FormField label="Year" type="number" value={form.yearNumber} onChange={(e) => setForm({ ...form, yearNumber: Number(e.target.value) })} required />
            <FormField label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required />
            <FormField label="End Date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required />
            {editing && <FormField label="Status" type="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={STATUS_OPTIONS} />}
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}