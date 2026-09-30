import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getTools, getTool, addToolStock, updateToolStock, getStockLocations } from '@/api/inventory';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from '@/pages/ModulePage.module.css';

export default function ToolStockSection() {
  const { accessToken } = useAuth();
  const [tools, setTools] = useState([]);
  const [locations, setLocations] = useState([]);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function emptyForm() {
    return { toolId: '', locationId: '', availableQuantity: '', assignedQuantity: '', damagedQuantity: '', lostQuantity: '' };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const t = await getTools(accessToken);
      setTools(t);
      const details = await Promise.all(t.map((x) => getTool(x.id, accessToken)));
      const rows = details.flatMap((d) => (d.stock || []).map((s) => ({ ...s, toolCode: d.toolCode, toolName: d.name, toolId: d.id })));
      setData(rows);
    } catch { /* empty */ }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getStockLocations(accessToken).then(setLocations).catch(() => {});
  }, [accessToken]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setError(''); setModalOpen(true); };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      toolId: String(row.toolId),
      locationId: String(row.locationId),
      availableQuantity: row.availableQuantity ?? '',
      assignedQuantity: row.assignedQuantity ?? '',
      damagedQuantity: row.damagedQuantity ?? '',
      lostQuantity: row.lostQuantity ?? '',
    });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.toolId || !form.locationId) { setError('Tool and location are required'); return; }
    setSubmitting(true);
    try {
      const tool = tools.find((t) => String(t.id) === String(form.toolId));
      const payload = {
        availableQuantity: form.availableQuantity === '' ? 0 : Number(form.availableQuantity),
        assignedQuantity: form.assignedQuantity === '' ? 0 : Number(form.assignedQuantity),
        damagedQuantity: form.damagedQuantity === '' ? 0 : Number(form.damagedQuantity),
        lostQuantity: form.lostQuantity === '' ? 0 : Number(form.lostQuantity),
        unitId: Number(tool.unitId),
      };
      if (editing) await updateToolStock(editing.id, payload, accessToken);
      else await addToolStock({ toolId: Number(form.toolId), locationId: Number(form.locationId), ...payload }, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to save'); } finally { setSubmitting(false); }
  };

  const columns = [
    { key: 'toolCode', label: 'Code', width: '110px' },
    { key: 'toolName', label: 'Tool' },
    { key: 'locationName', label: 'Location', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'availableQuantity', label: 'Available', width: '90px', render: (v) => <strong>{Number(v || 0).toLocaleString('en-IN')}</strong> },
    { key: 'assignedQuantity', label: 'Assigned', width: '90px', render: (v) => Number(v || 0).toLocaleString('en-IN') },
    { key: 'damagedQuantity', label: 'Damaged', width: '90px', render: (v) => Number(v || 0).toLocaleString('en-IN') },
    { key: 'lostQuantity', label: 'Lost', width: '90px', render: (v) => Number(v || 0).toLocaleString('en-IN') },
    { key: 'unitSymbol', label: 'Unit', width: '70px', render: (v) => v || '—' },
    { key: 'id', label: '', width: '80px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openEdit(row)}>Edit</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Tool Stock</h2>
          <p className={styles.pageSub}>{data.length} stock entries</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ Add Stock</button>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No tool stock recorded yet" />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Tool Stock' : 'Add Tool Stock'} width={520}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Tool" type="select" value={form.toolId} onChange={(e) => setForm({ ...form, toolId: e.target.value })} options={tools.map((t) => ({ value: String(t.id), label: `${t.name} (${t.toolCode})` }))} required />
            <FormField label="Location" type="select" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} options={locations.map((l) => ({ value: String(l.id), label: l.name }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Available Qty" type="number" min="0" step="any" value={form.availableQuantity} onChange={(e) => setForm({ ...form, availableQuantity: e.target.value })} />
            <FormField label="Assigned Qty" type="number" min="0" step="any" value={form.assignedQuantity} onChange={(e) => setForm({ ...form, assignedQuantity: e.target.value })} />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Damaged Qty" type="number" min="0" step="any" value={form.damagedQuantity} onChange={(e) => setForm({ ...form, damagedQuantity: e.target.value })} />
            <FormField label="Lost Qty" type="number" min="0" step="any" value={form.lostQuantity} onChange={(e) => setForm({ ...form, lostQuantity: e.target.value })} />
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af' }}>
            {editing ? 'Values replace the current stock row.' : 'Values are added to the tool at the selected location.'}
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}