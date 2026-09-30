import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getPayrollPeriods } from '@/api/payrollPeriods';
import { getEmployees } from '@/api/dropdowns';
import { getPayrolls, createPayroll, generatePayroll, updatePayrollStatus, deletePayroll, getPayroll } from '@/api/payroll';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Drawer from '@/components/ui/Drawer';
import FormField from '@/components/ui/FormField';
import styles from '@/pages/ModulePage.module.css';

export default function PayrollManagementTab() {
  const { accessToken } = useAuth();
  const [periods, setPeriods] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [periodId, setPeriodId] = useState('');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genEmployeeId, setGenEmployeeId] = useState('');
  const [genError, setGenError] = useState('');
  const [genSubmitting, setGenSubmitting] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadPeriods = useCallback(async () => {
    try { setPeriods(await getPayrollPeriods(accessToken)); } catch { /* empty */ }
  }, [accessToken]);

  const loadEmployees = useCallback(async () => {
    try { setEmployees(await getEmployees(accessToken)); } catch { /* empty */ }
  }, [accessToken]);

  useEffect(() => { loadPeriods(); loadEmployees(); }, [loadPeriods, loadEmployees]);

  useEffect(() => {
    if (!periodId) return;
    setLoading(true);
    getPayrolls({ payrollPeriodId: periodId }, accessToken)
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [periodId, accessToken]);

  const openCreate = () => {
    setForm({ payrollPeriodId: periodId, employeeId: '', totalCalendarDays: '', payableDays: '', absentDays: 0, halfDays: 0, paidLeaveDays: 0, lateHalfDayDeductions: 0, lateFullDayDeductions: 0, overtimeMinutes: 0, grossEarnings: 0, totalDeductions: 0, overtimeAmount: 0, bonusIncentiveAmount: 0, netSalary: 0 });
    setError(''); setCreateOpen(true);
  };

  const openDetail = async (row) => {
    try {
      const d = await getPayroll(row.id, accessToken);
      setDetail(d);
      setDetailOpen(true);
    } catch (err) { alert(err.message); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.employeeId) { setError('Please select an employee'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '' || payload[k] === null) payload[k] = 0;
      });
      payload.payrollPeriodId = periodId;
      await createPayroll(payload, accessToken);
      setCreateOpen(false);
      setPeriodId(periodId);
    } catch (err) { setError(err.message || 'Failed to create'); }
    finally { setSubmitting(false); }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setGenError('');
    if (!genEmployeeId) { setGenError('Please select an employee'); return; }
    setGenSubmitting(true);
    try {
      await generatePayroll({ payrollPeriodId: periodId, employeeId: Number(genEmployeeId) }, accessToken);
      setGenOpen(false);
      setGenEmployeeId('');
      setPeriodId(periodId);
      alert('Payroll generated successfully.');
    } catch (err) { setGenError(err.message || 'Failed to generate payroll'); }
    finally { setGenSubmitting(false); }
  };

  const handleStatus = async (row, status) => {
    try {
      await updatePayrollStatus(row.id, status, accessToken);
      setPeriodId(periodId);
      if (detailOpen && detail) setDetail({ ...detail, status });
    } catch (err) { alert(err.message); }
  };

  const handleDelete = async (row) => {
    if (row.status !== 'generated') { alert('Only generated payrolls can be deleted'); return; }
    if (!confirm('Delete this payroll record?')) return;
    try { await deletePayroll(row.id, accessToken); setPeriodId(periodId); } catch (err) { alert(err.message); }
  };

  const statusColor = { draft: '#6b7280', generated: '#3b82f6', locked: '#16a34a', paid: '#8b5cf6' };

  const columns = [
    { key: 'employeeCode', label: 'Code', width: '90px' },
    { key: 'firstName', label: 'Employee', render: (_, r) => `${r.firstName} ${r.lastName || ''}` },
    { key: 'periodName', label: 'Period' },
    { key: 'payableDays', label: 'Days', width: '60px' },
    { key: 'grossEarnings', label: 'Gross', width: '110px', align: 'right', render: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}` },
    { key: 'totalDeductions', label: 'Deductions', width: '110px', align: 'right', render: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}` },
    { key: 'netSalary', label: 'Net', width: '110px', align: 'right', render: (v) => `₹${Number(v || 0).toLocaleString('en-IN')}` },
    { key: 'status', label: 'Status', width: '110px', render: (v) => <span className={styles.badge} style={{ color: statusColor[v], background: `${statusColor[v]}15` }}>{v}</span> },
    { key: 'id', label: '', width: '140px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); openDetail(row); }}>View</button>
        {row.status === 'generated' && <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); handleStatus(row, 'locked'); }}>Lock</button>}
        <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>Del</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Payroll</h1>
          <p className={styles.pageSub}>{data.length} payroll records</p>
        </div>
        <div className={styles.actions} style={{ gap: 10 }}>
          <select className={styles.filterSelect} style={{ padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 13 }} value={periodId} onChange={(e) => setPeriodId(e.target.value)}>
            <option value="">Select Payroll Period</option>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button className={styles.primaryBtn} onClick={openCreate} disabled={!periodId}>+ Add Payroll</button>
          <button className={styles.cancelBtn} onClick={() => { setGenEmployeeId(''); setGenError(''); setGenOpen(true); }} disabled={!periodId} style={{ border: '1px solid #D4AF37', color: '#D4AF37', fontWeight: 600 }}>Generate Payroll</button>
        </div>
      </div>

      {!periodId ? <div className={styles.emptyText} style={{ textAlign: 'center', color: '#9ca3af', padding: 40 }}>Select a payroll period to view or create payroll records.</div> : (
        loading ? <div className={styles.loading}>Loading...</div> : <Table columns={columns} data={data} onRowClick={openDetail} emptyMessage="No payroll records for this period" />
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Payroll Record" width={560}>
        <form onSubmit={handleCreate} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <FormField label="Employee" type="select" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} options={employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName || ''}` }))} required />
          <div className={styles.formGrid}>
            <FormField label="Calendar Days" type="number" value={form.totalCalendarDays} onChange={(e) => setForm({ ...form, totalCalendarDays: Number(e.target.value) })} />
            <FormField label="Payable Days" type="number" value={form.payableDays} onChange={(e) => setForm({ ...form, payableDays: Number(e.target.value) })} />
            <FormField label="Absent Days" type="number" value={form.absentDays} onChange={(e) => setForm({ ...form, absentDays: Number(e.target.value) })} />
            <FormField label="Half Days" type="number" value={form.halfDays} onChange={(e) => setForm({ ...form, halfDays: Number(e.target.value) })} />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Gross Earnings" type="number" value={form.grossEarnings} onChange={(e) => setForm({ ...form, grossEarnings: Number(e.target.value) })} />
            <FormField label="Total Deductions" type="number" value={form.totalDeductions} onChange={(e) => setForm({ ...form, totalDeductions: Number(e.target.value) })} />
            <FormField label="Overtime Amount" type="number" value={form.overtimeAmount} onChange={(e) => setForm({ ...form, overtimeAmount: Number(e.target.value) })} />
            <FormField label="Bonus / Incentive" type="number" value={form.bonusIncentiveAmount} onChange={(e) => setForm({ ...form, bonusIncentiveAmount: Number(e.target.value) })} />
            <FormField label="Net Salary" type="number" value={form.netSalary} onChange={(e) => setForm({ ...form, netSalary: Number(e.target.value) })} />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={genOpen} onClose={() => setGenOpen(false)} title="Auto-Generate Payroll" width={480}>
        <form onSubmit={handleGenerate} className={styles.form}>
          {genError && <div className={styles.error}>{genError}</div>}
          <FormField label="Employee" type="select" value={genEmployeeId} onChange={(e) => setGenEmployeeId(e.target.value)} options={employees.map((e) => ({ value: e.id, label: `${e.firstName} ${e.lastName || ''} (${e.employeeCode})` }))} required />
          <p style={{ margin: 0, fontSize: 12.5, color: '#9ca3af', lineHeight: 1.6 }}>
            Earnings and deductions will be computed automatically from this employee's active salary structure.
            Approved bonuses and overtime for the selected period are included.
          </p>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setGenOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={genSubmitting}>{genSubmitting ? 'Generating...' : 'Generate'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={detailOpen} onClose={() => setDetailOpen(false)} title={detail ? `Payroll: ${detail.firstName} ${detail.lastName || ''}` : 'Payroll'} width={520}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className={styles.detailRow}><span>Period</span><strong>{detail.periodName}</strong></div>
            <div className={styles.detailRow}><span>Employee</span><strong>{detail.firstName} {detail.lastName || ''} ({detail.employeeCode})</strong></div>
            <div className={styles.detailRow}><span>Payable Days</span><strong>{detail.payableDays}</strong></div>
            <div className={styles.detailRow}><span>Gross Earnings</span><strong>₹{Number(detail.grossEarnings || 0).toLocaleString('en-IN')}</strong></div>
            <div className={styles.detailRow}><span>Total Deductions</span><strong>₹{Number(detail.totalDeductions || 0).toLocaleString('en-IN')}</strong></div>
            <div className={styles.detailRow}><span>Overtime</span><strong>₹{Number(detail.overtimeAmount || 0).toLocaleString('en-IN')}</strong></div>
            <div className={styles.detailRow}><span>Bonus/Incentive</span><strong>₹{Number(detail.bonusIncentiveAmount || 0).toLocaleString('en-IN')}</strong></div>
            <div className={styles.detailRow}><span>Net Salary</span><strong style={{ color: '#D4AF37', fontSize: 18 }}>₹{Number(detail.netSalary || 0).toLocaleString('en-IN')}</strong></div>
            <div className={styles.detailRow}><span>Status</span><strong style={{ textTransform: 'capitalize' }}>{detail.status}</strong></div>

            {detail.items && detail.items.length > 0 && (
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Pay Items</h4>
                <div style={{ borderTop: '1px solid #e5e7eb' }}>
                  {detail.items.map((it) => (
                    <div key={it.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: 13 }}>
                      <span>{it.componentName}</span>
                      <span>{it.calculatedAmount ? `₹${Number(it.calculatedAmount).toLocaleString('en-IN')}` : '-'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={styles.actions}>
              {detail.status === 'generated' && <button className={styles.primaryBtn} onClick={() => handleStatus(detail, 'locked')}>Lock Payroll</button>}
              {detail.status === 'locked' && <button className={styles.cancelBtn} onClick={() => handleStatus(detail, 'generated')}>Unlock</button>}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}