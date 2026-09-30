import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getMachines, getMachine, createMachine, updateMachine, deleteMachine, updateMachineStatus,
  getMachineBreakdowns, createMachineBreakdown, resolveMachineBreakdown, deleteMachineBreakdown,
  getStockLocations,
} from '@/api/inventory';
import { getDepartments } from '@/api/departments';
import { getEmployees } from '@/api/dropdowns';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Drawer from '@/components/ui/Drawer';
import FormField from '@/components/ui/FormField';
import { StatusPill, fmtDate, fmtDateTime } from '../shared';
import styles from '@/pages/ModulePage.module.css';

const MACHINE_STATUSES = ['active', 'under_maintenance', 'inactive', 'breakdown'];

const MACHINE_STATUS_COLORS = {
  active: '#16a34a',
  under_maintenance: '#f59e0b',
  inactive: '#6b7280',
  breakdown: '#DC2626',
};

const SEVERITIES = ['low', 'medium', 'high', 'critical'];

function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MachinesSection() {
  const { accessToken } = useAuth();
  const [data, setData] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [breakdowns, setBreakdowns] = useState([]);
  const [bkModalOpen, setBkModalOpen] = useState(false);
  const [bkForm, setBkForm] = useState(emptyBkForm());
  const [bkError, setBkError] = useState('');
  const [bkSubmitting, setBkSubmitting] = useState(false);
  const [resolveTarget, setResolveTarget] = useState(null);
  const [resolveForm, setResolveForm] = useState({ resolutionDetails: '', resolvedBy: '', downtimeMinutes: '' });
  const [statusTarget, setStatusTarget] = useState(null);

  function emptyForm() {
    return { machineCode: '', machineName: '', departmentId: '', locationId: '', maintenanceDueDate: '', status: 'active', description: '' };
  }

  function emptyBkForm() {
    return { breakdownDateTime: nowLocal(), problemDescription: '', severity: 'medium', reportedBy: '', downtimeMinutes: '' };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getMachines(accessToken, { status: statusFilter || undefined })); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getDepartments(accessToken).then(setDepartments).catch(() => {});
    getStockLocations(accessToken).then(setLocations).catch(() => {});
    getEmployees(accessToken).then(setEmployees).catch(() => {});
  }, [accessToken]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setError(''); setModalOpen(true); };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      machineCode: row.machineCode,
      machineName: row.machineName,
      departmentId: row.departmentId ?? '',
      locationId: row.locationId ?? '',
      maintenanceDueDate: row.maintenanceDueDate ? String(row.maintenanceDueDate).slice(0, 10) : '',
      status: row.status,
      description: row.description || '',
    });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.machineCode || !form.machineName || !form.departmentId) { setError('Code, name and department are required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        machineCode: form.machineCode,
        machineName: form.machineName,
        departmentId: Number(form.departmentId),
        locationId: form.locationId ? Number(form.locationId) : null,
        maintenanceDueDate: form.maintenanceDueDate || null,
        status: form.status,
        description: form.description || null,
      };
      if (editing) await updateMachine(editing.id, payload, accessToken);
      else await createMachine(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to save'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete machine "${row.machineName}"?`)) return;
    try { await deleteMachine(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const openDetail = async (row) => {
    try {
      setDetail(await getMachine(row.id, accessToken));
      setBreakdowns(await getMachineBreakdowns(row.id, accessToken));
    } catch (err) { alert(err.message); }
  };

  const saveBreakdown = async (e) => {
    e.preventDefault();
    setBkError('');
    if (!bkForm.problemDescription || !bkForm.reportedBy) { setBkError('Problem description and reported by are required'); return; }
    setBkSubmitting(true);
    try {
      await createMachineBreakdown(detail.id, {
        breakdownDateTime: bkForm.breakdownDateTime.replace('T', ' '),
        problemDescription: bkForm.problemDescription,
        severity: bkForm.severity,
        reportedBy: Number(bkForm.reportedBy),
        downtimeMinutes: bkForm.downtimeMinutes === '' ? null : Number(bkForm.downtimeMinutes),
      }, accessToken);
      setBkModalOpen(false);
      setBreakdowns(await getMachineBreakdowns(detail.id, accessToken));
      load();
    } catch (err) { setBkError(err.message || 'Failed to report breakdown'); } finally { setBkSubmitting(false); }
  };

  const resolveBreakdown = async (bk) => {
    if (!confirm('Mark this breakdown as resolved?')) return;
    try {
      await resolveMachineBreakdown(bk.id, {
        resolutionDetails: resolveForm.resolutionDetails || bk.resolutionDetails || null,
        resolvedBy: resolveForm.resolvedBy ? Number(resolveForm.resolvedBy) : null,
        downtimeMinutes: resolveForm.downtimeMinutes === '' ? null : Number(resolveForm.downtimeMinutes),
      }, accessToken);
      setBreakdowns(await getMachineBreakdowns(detail.id, accessToken));
      load();
    } catch (err) { alert(err.message); }
  };

  const deleteBreakdown = async (bk) => {
    if (!confirm('Delete this breakdown record?')) return;
    try { await deleteMachineBreakdown(bk.id, accessToken); setBreakdowns(await getMachineBreakdowns(detail.id, accessToken)); load(); } catch (err) { alert(err.message); }
  };

  const changeStatus = async () => {
    if (!statusTarget) return;
    try {
      await updateMachineStatus(statusTarget.id, statusTarget.status, accessToken);
      setStatusTarget(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'machineCode', label: 'Code', width: '110px' },
    { key: 'machineName', label: 'Machine' },
    { key: 'departmentName', label: 'Department', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'locationName', label: 'Location', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'maintenanceDueDate', label: 'Maint Due', width: '100px', render: (v) => (v ? fmtDate(v) : <span style={{ color: '#cbd5e1' }}>—</span>) },
    { key: 'status', label: 'Status', width: '130px', render: (v) => <StatusPill value={v} color={MACHINE_STATUS_COLORS[v] || '#6b7280'} /> },
    { key: 'id', label: '', width: '250px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openDetail(row)}>Breakdowns</button>
        <button className={styles.editBtn} onClick={() => setStatusTarget({ id: row.id, status: row.status })}>Status</button>
        <button className={styles.editBtn} onClick={() => openEdit(row)}>Edit</button>
        <button className={styles.deleteBtn} onClick={() => handleDelete(row)}>Del</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Machines</h2>
          <p className={styles.pageSub}>{data.length} machines</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {MACHINE_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button className={styles.primaryBtn} onClick={openCreate}>+ New Machine</button>
        </div>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No machines found" onRowClick={openDetail} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Machine' : 'New Machine'} width={560}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Machine Code" value={form.machineCode} onChange={(e) => setForm({ ...form, machineCode: e.target.value })} placeholder="e.g. MC-001" required />
            <FormField label="Machine Name" value={form.machineName} onChange={(e) => setForm({ ...form, machineName: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Department" type="select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} options={departments.map((d) => ({ value: String(d.id), label: d.name }))} required />
            <FormField label="Location" type="select" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} options={locations.map((l) => ({ value: String(l.id), label: l.name }))} placeholder="None" />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Maintenance Due" type="date" value={form.maintenanceDueDate} onChange={(e) => setForm({ ...form, maintenanceDueDate: e.target.value })} />
            <FormField label="Status" type="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={MACHINE_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          </div>
          <FormField label="Description" type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.machineName} (${detail.machineCode})` : 'Machine'} width={560}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className={styles.detailRow}><span>Department</span><strong>{detail.departmentName || '—'}</strong></div>
            <div className={styles.detailRow}><span>Location</span><strong>{detail.locationName || '—'}</strong></div>
            <div className={styles.detailRow}><span>Maintenance Due</span><strong>{detail.maintenanceDueDate ? fmtDate(detail.maintenanceDueDate) : '—'}</strong></div>
            <div className={styles.detailRow}><span>Status</span><strong><StatusPill value={detail.status} color={MACHINE_STATUS_COLORS[detail.status] || '#6b7280'} /></strong></div>
            {detail.description && <div className={styles.detailRow}><span>Description</span><strong>{detail.description}</strong></div>}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4 style={{ margin: 0, fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Breakdowns</h4>
                <button className={styles.primaryBtn} onClick={() => { setBkForm(emptyBkForm()); setBkError(''); setBkModalOpen(true); }}>+ Report</button>
              </div>
              {!breakdowns.length ? <p className={styles.emptyText}>No breakdowns recorded.</p> : (
                breakdowns.map((bk) => (
                  <div key={bk.id} className={styles.compItem}>
                    <div>
                      <span className={styles.compName}>
                        {fmtDateTime(bk.breakdownDateTime)} · <StatusPill value={bk.severity} color={bk.severity === 'critical' || bk.severity === 'high' ? '#DC2626' : '#f59e0b'} />
                      </span>
                      <div className={styles.compAmount} style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>
                        {bk.problemDescription} {bk.status === 'open' ? '' : ` · resolved ${fmtDate(bk.resolvedAt)}`}
                      </div>
                    </div>
                    <div className={styles.actions}>
                      {bk.status === 'open' && (
                        <button className={styles.editBtn} onClick={() => { setResolveTarget(bk); setResolveForm({ resolutionDetails: bk.resolutionDetails || '', resolvedBy: bk.resolvedBy ?? '', downtimeMinutes: bk.downtimeMinutes ?? '' }); }}>Resolve</button>
                      )}
                      <button className={styles.deleteBtn} onClick={() => deleteBreakdown(bk)}>Del</button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal isOpen={bkModalOpen} onClose={() => setBkModalOpen(false)} title="Report Breakdown" width={520}>
        <form onSubmit={saveBreakdown} className={styles.form}>
          {bkError && <div className={styles.error}>{bkError}</div>}
          <div className={styles.formGrid}>
            <FormField label="Date & Time" type="datetime-local" value={bkForm.breakdownDateTime} onChange={(e) => setBkForm({ ...bkForm, breakdownDateTime: e.target.value })} required />
            <FormField label="Severity" type="select" value={bkForm.severity} onChange={(e) => setBkForm({ ...bkForm, severity: e.target.value })} options={SEVERITIES.map((s) => ({ value: s, label: s }))} />
          </div>
          <FormField label="Problem" type="textarea" value={bkForm.problemDescription} onChange={(e) => setBkForm({ ...bkForm, problemDescription: e.target.value })} placeholder="Describe the issue" required />
          <div className={styles.formGrid}>
            <FormField label="Reported By" type="select" value={bkForm.reportedBy} onChange={(e) => setBkForm({ ...bkForm, reportedBy: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} required />
            <FormField label="Downtime (min)" type="number" min="0" value={bkForm.downtimeMinutes} onChange={(e) => setBkForm({ ...bkForm, downtimeMinutes: e.target.value })} />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setBkModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={bkSubmitting}>{bkSubmitting ? 'Saving...' : 'Report'}</button>
          </div>
        </form>
      </Modal>

      {resolveTarget && (
        <Modal isOpen onClose={() => setResolveTarget(null)} title="Resolve Breakdown" width={520}>
          <div className={styles.form}>
            <div className={styles.formGrid}>
              <FormField label="Resolved By" type="select" value={resolveForm.resolvedBy} onChange={(e) => setResolveForm({ ...resolveForm, resolvedBy: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} placeholder="Optional" />
              <FormField label="Down Time (min)" type="number" min="0" value={resolveForm.downtimeMinutes} onChange={(e) => setResolveForm({ ...resolveForm, downtimeMinutes: e.target.value })} />
            </div>
            <FormField label="Resolution Notes" type="textarea" value={resolveForm.resolutionDetails} onChange={(e) => setResolveForm({ ...resolveForm, resolutionDetails: e.target.value })} />
            <div className={styles.formActions}>
              <button className={styles.cancelBtn} onClick={() => setResolveTarget(null)}>Cancel</button>
              <button className={styles.primaryBtn} onClick={resolveBreakdown}>Resolve</button>
            </div>
          </div>
        </Modal>
      )}

      {statusTarget && (
        <Modal isOpen onClose={() => setStatusTarget(null)} title="Change Machine Status" width={440}>
          <div className={styles.form}>
            <FormField label="Status" type="select" value={statusTarget.status} onChange={(e) => setStatusTarget({ ...statusTarget, status: e.target.value })} options={MACHINE_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
            <div className={styles.formActions}>
              <button className={styles.cancelBtn} onClick={() => setStatusTarget(null)}>Cancel</button>
              <button className={styles.primaryBtn} onClick={changeStatus}>Update</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}