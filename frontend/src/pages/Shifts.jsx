import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getShifts, createShift, updateShift, deleteShift } from '@/api/shifts';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from './Shifts.module.css';

const WEEK_DAYS = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function time12(t) {
  if (!t) return '-';
  const parts = String(t).slice(0, 5).split(':');
  let h = Number(parts[0]);
  const m = parts[1];
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function getDefault(row) {
  if (row) {
    return {
      name: row.name,
      startTime: String(row.startTime).slice(0, 5),
      endTime: String(row.endTime).slice(0, 5),
      gracePeriodMinutes: String(row.gracePeriodMinutes || 0),
      halfDayThresholdMinutes: String(row.halfDayThresholdMinutes || 240),
      overtimeAfterEndTime: !!row.overtimeAfterEndTime,
      weekOffDays: row.weekOffDays || [],
    };
  }
  return {
    name: '', startTime: '09:00', endTime: '18:00',
    gracePeriodMinutes: '0', halfDayThresholdMinutes: '240',
    overtimeAfterEndTime: true, weekOffDays: [],
  };
}

export default function Shifts() {
  const { accessToken } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => getDefault(null));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getShifts(accessToken)); } catch (err) { setError(err.message); }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(getDefault(null)); setError(''); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm(getDefault(row)); setError(''); setModalOpen(true); };

  const toggleWeekOff = (day) => {
    setForm((f) => ({
      ...f,
      weekOffDays: f.weekOffDays.includes(day) ? f.weekOffDays.filter((d) => d !== day) : [...f.weekOffDays, day],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.startTime || !form.endTime) {
      setError('Name, start and end time are required');
      return;
    }
    const payload = {
      ...form,
      gracePeriodMinutes: Number(form.gracePeriodMinutes) || 0,
      halfDayThresholdMinutes: Number(form.halfDayThresholdMinutes) || 240,
      weekOffDays: [...form.weekOffDays],
    };
    setSubmitting(true);
    try {
      if (editing) await updateShift(editing.id, payload, accessToken);
      else await createShift(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete shift "${row.name}"?`)) return;
    try { await deleteShift(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'name', label: 'Shift', render: (v) => <strong>{v}</strong> },
    { key: 'startTime', label: 'Start', width: '110px', render: time12 },
    { key: 'endTime', label: 'End', width: '110px', render: time12 },
    { key: 'gracePeriodMinutes', label: 'Grace', width: '80px', render: (v) => `${v}m` },
    { key: 'halfDayThresholdMinutes', label: 'Half-day', width: '90px', render: (v) => `${v}m` },
    { key: 'weekOffDays', label: 'Week Off', width: '150px', render: (v) => (v?.length ? `${v.length} day(s)` : 'None') },
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
          <h1 className={styles.pageTitle}>Shifts</h1>
          <p className={styles.pageSub}>
            Shift timings used for attendance auto-validation (grace period, late/half-day thresholds, week offs).
          </p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Shift</button>
      </div>

      {error && !modalOpen && <div className={styles.error}>{error}</div>}

      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No shifts configured" />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Shift' : 'New Shift'} width={560}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Shift Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Day Shift" required />
            <FormField label="Start Time" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} required />
            <FormField label="End Time" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} required />
            <FormField label="Grace Period (min)" type="number" min="0" value={form.gracePeriodMinutes} onChange={(e) => setForm({ ...form, gracePeriodMinutes: e.target.value })} />
            <FormField label="Half-Day Threshold (min)" type="number" min="0" value={form.halfDayThresholdMinutes} onChange={(e) => setForm({ ...form, halfDayThresholdMinutes: e.target.value })} />
          </div>
          <div className={styles.weekRow}>
            <span className={styles.weekLabel}>Week Off Days</span>
            <div className={styles.weekDays}>
              {WEEK_DAYS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={`${styles.dayChip} ${form.weekOffDays.includes(d.value) ? styles.dayChipOn : ''}`}
                  onClick={() => toggleWeekOff(d.value)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <label className={styles.checkLabel}>
            <input type="checkbox" checked={form.overtimeAfterEndTime} onChange={(e) => setForm({ ...form, overtimeAfterEndTime: e.target.checked })} />
            Overtime counted after end time
          </label>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}