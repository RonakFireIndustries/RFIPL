import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getTools, getStockLocations, getToolAssignments, getToolAssignment,
  createToolAssignment, createToolReturn, updateToolAssignmentStatus,
} from '@/api/inventory';
import { getEmployees } from '@/api/dropdowns';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Drawer from '@/components/ui/Drawer';
import FormField from '@/components/ui/FormField';
import { StatusPill, fmtDate, fmtDateTime } from '../shared';
import styles from '@/pages/ModulePage.module.css';

const ASSIGNMENT_STATUSES = ['assigned', 'partially_returned', 'returned', 'lost', 'damaged'];

const ASSIGNMENT_STATUS_COLORS = {
  assigned: '#3b82f6',
  partially_returned: '#f59e0b',
  returned: '#16a34a',
  lost: '#6b7280',
  damaged: '#DC2626',
};

const RETURN_CONDITIONS = ['good', 'needs_repair', 'damaged', 'lost'];

function nowLocal() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AssignmentsSection() {
  const { accessToken } = useAuth();
  const [data, setData] = useState([]);
  const [tools, setTools] = useState([]);
  const [locations, setLocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [returnTarget, setReturnTarget] = useState(null);
  const [returnForm, setReturnForm] = useState(emptyReturnForm());
  const [returnError, setReturnError] = useState('');
  const [statusTarget, setStatusTarget] = useState(null);

  function emptyForm() {
    return { assignmentNumber: '', toolId: '', employeeId: '', locationId: '', quantity: '', assignedAt: nowLocal(), assignedBy: '', expectedReturnDate: '', remarks: '' };
  }

  function emptyReturnForm() {
    return { returnedQuantity: '', returnCondition: 'good', returnedAt: nowLocal(), receivedBy: '', remarks: '' };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getToolAssignments(accessToken, { status: statusFilter || undefined })); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getTools(accessToken).then(setTools).catch(() => {});
    getStockLocations(accessToken).then(setLocations).catch(() => {});
    getEmployees(accessToken).then(setEmployees).catch(() => {});
  }, [accessToken]);

  const openCreate = () => {
    setForm({ ...emptyForm(), assignedBy: employees[0] ? String(employees[0].id) : '' });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.assignmentNumber || !form.toolId || !form.employeeId || !form.quantity || !form.assignedBy) { setError('Number, tool, employee, quantity and assigned by are required'); return; }
    setSubmitting(true);
    try {
      await createToolAssignment({
        assignmentNumber: form.assignmentNumber,
        toolId: Number(form.toolId),
        employeeId: Number(form.employeeId),
        locationId: form.locationId ? Number(form.locationId) : null,
        quantity: Number(form.quantity),
        assignedAt: form.assignedAt.replace('T', ' '),
        assignedBy: Number(form.assignedBy),
        expectedReturnDate: form.expectedReturnDate || null,
        remarks: form.remarks || null,
      }, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to create'); } finally { setSubmitting(false); }
  };

  const openDetail = async (row) => {
    try { setDetail(await getToolAssignment(row.id, accessToken)); } catch (err) { alert(err.message); }
  };

  const saveReturn = async (e) => {
    e.preventDefault();
    setReturnError('');
    if (returnForm.returnedQuantity === '' || !returnForm.receivedBy) { setReturnError('Returned quantity and received by are required'); return; }
    try {
      await createToolReturn(returnTarget.id, {
        returnedQuantity: Number(returnForm.returnedQuantity),
        returnCondition: returnForm.returnCondition,
        returnedAt: returnForm.returnedAt.replace('T', ' '),
        receivedBy: Number(returnForm.receivedBy),
        remarks: returnForm.remarks || null,
      }, accessToken);
      setReturnTarget(null);
      load();
      if (detail?.id === returnTarget.id) openDetail(returnTarget);
    } catch (err) { setReturnError(err.message || 'Failed to record return'); }
  };

  const changeStatus = async () => {
    if (!statusTarget) return;
    try {
      await updateToolAssignmentStatus(statusTarget.id, statusTarget.status, accessToken);
      setStatusTarget(null);
      load();
    } catch (err) { alert(err.message); }
  };

  const employeeName = (id) => {
    const found = employees.find((e) => String(e.id) === String(id));
    return found ? `${found.firstName} ${found.lastName || ''}`.trim() : `#${id}`;
  };

  const columns = [
    { key: 'assignmentNumber', label: 'Number', width: '140px' },
    { key: 'toolName', label: 'Tool', render: (v, row) => `${v || ''} (${row.toolCode || '—'})` },
    { key: 'employee', label: 'Employee', render: (_, row) => `${row.firstName || ''} ${row.lastName || ''}`.trim() || '—' },
    { key: 'locationName', label: 'Location', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'quantity', label: 'Qty', width: '80px', render: (v) => <strong>{Number(v || 0).toLocaleString('en-IN')}</strong> },
    { key: 'assignedAt', label: 'Assigned', width: '130px', render: (v) => fmtDateTime(v) },
    { key: 'expectedReturnDate', label: 'Due', width: '95px', render: (v) => (v ? fmtDate(v) : <span style={{ color: '#cbd5e1' }}>—</span>) },
    { key: 'status', label: 'Status', width: '120px', render: (v) => <StatusPill value={v} color={ASSIGNMENT_STATUS_COLORS[v] || '#6b7280'} /> },
    { key: 'id', label: '', width: '220px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openDetail(row)}>View</button>
        {row.status === 'assigned' || row.status === 'partially_returned' ? (
          <button className={styles.editBtn} onClick={() => { setReturnTarget(row); setReturnForm(emptyReturnForm()); setReturnError(''); }}>Return</button>
        ) : null}
        <button className={styles.editBtn} onClick={() => setStatusTarget({ id: row.id, status: row.status })}>Status</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Tool Assignments</h2>
          <p className={styles.pageSub}>{data.length} assignments</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {ASSIGNMENT_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
          <button className={styles.primaryBtn} onClick={openCreate}>+ New Assignment</button>
        </div>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No tool assignments found" onRowClick={openDetail} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Tool Assignment" width={600}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Assignment Number" value={form.assignmentNumber} onChange={(e) => setForm({ ...form, assignmentNumber: e.target.value })} placeholder="e.g. TA-0001" required />
            <FormField label="Tool" type="select" value={form.toolId} onChange={(e) => setForm({ ...form, toolId: e.target.value })} options={tools.map((t) => ({ value: String(t.id), label: `${t.name} (${t.toolCode})` }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Employee" type="select" value={form.employeeId} onChange={(e) => setForm({ ...form, employeeId: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} required />
            <FormField label="Quantity" type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Location" type="select" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} options={locations.map((l) => ({ value: String(l.id), label: l.name }))} placeholder="None" />
            <FormField label="Assigned At" type="datetime-local" value={form.assignedAt} onChange={(e) => setForm({ ...form, assignedAt: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Assigned By" type="select" value={form.assignedBy} onChange={(e) => setForm({ ...form, assignedBy: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} required />
            <FormField label="Expected Return" type="date" value={form.expectedReturnDate} onChange={(e) => setForm({ ...form, expectedReturnDate: e.target.value })} />
          </div>
          <FormField label="Remarks" type="textarea" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Assignment: ${detail.assignmentNumber}` : 'Tool Assignment'} width={560}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className={styles.detailRow}><span>Status</span><strong><StatusPill value={detail.status} color={ASSIGNMENT_STATUS_COLORS[detail.status] || '#6b7280'} /></strong></div>
            <div className={styles.detailRow}><span>Tool</span><strong>{`${detail.toolName || ''} (${detail.toolCode || '—'})`}</strong></div>
            <div className={styles.detailRow}><span>Employee</span><strong>{`${detail.firstName || ''} ${detail.lastName || ''}`.trim() || '—'}</strong></div>
            <div className={styles.detailRow}><span>Quantity</span><strong>{Number(detail.quantity || 0).toLocaleString('en-IN')}</strong></div>
            <div className={styles.detailRow}><span>Location</span><strong>{detail.locationName || '—'}</strong></div>
            <div className={styles.detailRow}><span>Assigned At</span><strong>{fmtDateTime(detail.assignedAt)}</strong></div>
            {detail.expectedReturnDate && <div className={styles.detailRow}><span>Expected Return</span><strong>{fmtDate(detail.expectedReturnDate)}</strong></div>}
            {detail.remarks && <div className={styles.detailRow}><span>Remarks</span><strong>{detail.remarks}</strong></div>}
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Returns</h4>
              {!detail.returns?.length ? <p className={styles.emptyText}>No returns yet.</p> : (
                detail.returns.map((r) => (
                  <div key={r.id} className={styles.compItem}>
                    <div>
                      <span className={styles.compName}>
                        {fmtDateTime(r.returnedAt)} · <StatusPill value={r.returnCondition} color={r.returnCondition === 'good' ? '#16a34a' : r.returnCondition === 'lost' ? '#6b7280' : '#f59e0b'} />
                      </span>
                      <div className={styles.compAmount} style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>
                        Qty {Number(r.returnedQuantity || 0).toLocaleString('en-IN')} · Received by {employeeName(r.receivedBy)}
                        {r.remarks ? ` · ${r.remarks}` : ''}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            {(detail.status === 'assigned' || detail.status === 'partially_returned') && (
              <button className={styles.primaryBtn} onClick={() => { setReturnTarget(detail); setReturnForm(emptyReturnForm()); setReturnError(''); }}>Record Return</button>
            )}
          </div>
        )}
      </Drawer>

      {returnTarget && (
        <Modal isOpen onClose={() => setReturnTarget(null)} title={`Record Return: ${returnTarget.assignmentNumber}`} width={520}>
          <form onSubmit={saveReturn} className={styles.form}>
            {returnError && <div className={styles.error}>{returnError}</div>}
            <div className={styles.formGrid}>
              <FormField label="Returned Qty" type="number" min="0" step="any" value={returnForm.returnedQuantity} onChange={(e) => setReturnForm({ ...returnForm, returnedQuantity: e.target.value })} required />
              <FormField label="Condition" type="select" value={returnForm.returnCondition} onChange={(e) => setReturnForm({ ...returnForm, returnCondition: e.target.value })} options={RETURN_CONDITIONS.map((c) => ({ value: c, label: c.replace(/_/g, ' ') }))} required />
            </div>
            <div className={styles.formGrid}>
              <FormField label="Returned At" type="datetime-local" value={returnForm.returnedAt} onChange={(e) => setReturnForm({ ...returnForm, returnedAt: e.target.value })} required />
              <FormField label="Received By" type="select" value={returnForm.receivedBy} onChange={(e) => setReturnForm({ ...returnForm, receivedBy: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} required />
            </div>
            <FormField label="Remarks" type="textarea" value={returnForm.remarks} onChange={(e) => setReturnForm({ ...returnForm, remarks: e.target.value })} />
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setReturnTarget(null)}>Cancel</button>
              <button type="submit" className={styles.primaryBtn}>Save Return</button>
            </div>
          </form>
        </Modal>
      )}

      {statusTarget && (
        <Modal isOpen onClose={() => setStatusTarget(null)} title="Change Assignment Status" width={420}>
          <div className={styles.form}>
            <FormField label="Status" type="select" value={statusTarget.status} onChange={(e) => setStatusTarget({ ...statusTarget, status: e.target.value })} options={ASSIGNMENT_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))} />
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