import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getTools, getTool, createTool, updateTool, deleteTool,
  getInventoryCategories, getInventoryUnits,
} from '@/api/inventory';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Drawer from '@/components/ui/Drawer';
import FormField from '@/components/ui/FormField';
import { StatusPill } from '../shared';
import styles from '@/pages/ModulePage.module.css';

const TOOL_TYPES = ['reusable', 'consumable'];

export default function ToolsSection() {
  const { accessToken } = useAuth();
  const [data, setData] = useState([]);
  const [cats, setCats] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);

  function emptyForm() {
    return { toolCode: '', name: '', categoryId: '', unitId: '', toolType: 'reusable', minimumStockLevel: 0, description: '', isActive: true };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getTools(accessToken, { toolType: typeFilter || undefined })); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, typeFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    getInventoryCategories(accessToken, { inventoryType: 'tool' }).then(setCats).catch(() => {});
    getInventoryUnits(accessToken).then(setUnits).catch(() => {});
  }, [accessToken]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setError(''); setModalOpen(true); };
  const openEdit = (row) => {
    setEditing(row);
    setForm({
      toolCode: row.toolCode,
      name: row.name,
      categoryId: row.categoryId ?? '',
      unitId: row.unitId ?? '',
      toolType: row.toolType,
      minimumStockLevel: row.minimumStockLevel ?? 0,
      description: row.description || '',
      isActive: !!row.isActive,
    });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.toolCode || !form.name || !form.unitId) { setError('Code, name and unit are required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        toolCode: form.toolCode,
        name: form.name,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        unitId: Number(form.unitId),
        toolType: form.toolType,
        minimumStockLevel: Number(form.minimumStockLevel || 0),
        description: form.description || null,
        isActive: form.isActive ? 1 : 0,
      };
      if (editing) await updateTool(editing.id, payload, accessToken);
      else await createTool(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to save'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete tool "${row.name}"?`)) return;
    try { await deleteTool(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const openDetail = async (row) => {
    try { setDetail(await getTool(row.id, accessToken)); } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'toolCode', label: 'Code', width: '110px' },
    { key: 'name', label: 'Tool' },
    { key: 'categoryName', label: 'Category', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'toolType', label: 'Type', width: '100px', render: (v) => <StatusPill value={v} color={v === 'consumable' ? '#f59e0b' : '#3b82f6'} /> },
    { key: 'unitSymbol', label: 'Unit', width: '70px', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'minimumStockLevel', label: 'Min Lvl', width: '80px' },
    { key: 'isActive', label: 'Status', width: '90px', render: (v) => <span className={v ? styles.badgeGreen : styles.badgeGray}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'id', label: '', width: '150px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openDetail(row)}>Stock</button>
        <button className={styles.editBtn} onClick={() => openEdit(row)}>Edit</button>
        <button className={styles.deleteBtn} onClick={() => handleDelete(row)}>Del</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Tools</h2>
          <p className={styles.pageSub}>{data.length} tools</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className={styles.filterSelect} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            {TOOL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className={styles.primaryBtn} onClick={openCreate}>+ New Tool</button>
        </div>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No tools found" onRowClick={openDetail} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Tool' : 'New Tool'} width={560}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Tool Code" value={form.toolCode} onChange={(e) => setForm({ ...form, toolCode: e.target.value })} placeholder="e.g. TL-001" required />
            <FormField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Category" type="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} options={cats.map((c) => ({ value: String(c.id), label: c.name }))} placeholder="None" />
            <FormField label="Unit" type="select" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} options={units.map((c) => ({ value: String(c.id), label: `${c.name} (${c.symbol})` }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Tool Type" type="select" value={form.toolType} onChange={(e) => setForm({ ...form, toolType: e.target.value })} options={TOOL_TYPES.map((t) => ({ value: t, label: t }))} required />
            <FormField label="Minimum Stock Level" type="number" min="0" step="any" value={form.minimumStockLevel} onChange={(e) => setForm({ ...form, minimumStockLevel: e.target.value })} />
          </div>
          <FormField label="Description" type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className={styles.formGrid} style={{ marginBottom: 0 }}>
            <FormField label="Active" type="select" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })} options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.name} (${detail.toolCode})` : 'Tool'} width={560}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className={styles.detailRow}><span>Category</span><strong>{detail.categoryName || '—'}</strong></div>
            <div className={styles.detailRow}><span>Type</span><strong><StatusPill value={detail.toolType} color={detail.toolType === 'consumable' ? '#f59e0b' : '#3b82f6'} /></strong></div>
            <div className={styles.detailRow}><span>Unit</span><strong>{detail.unitName || detail.unitSymbol || '—'}</strong></div>
            <div className={styles.detailRow}><span>Min Stock Level</span><strong>{detail.minimumStockLevel}</strong></div>
            {detail.description && <div className={styles.detailRow}><span>Description</span><strong>{detail.description}</strong></div>}
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Stock by Location</h4>
              {!detail.stock?.length ? <p className={styles.emptyText}>No stock recorded.</p> : (
                detail.stock.map((s) => (
                  <div key={s.id} className={styles.compItem}>
                    <span className={styles.compName}>{s.locationName || `#${s.locationId}`}</span>
                    <span className={styles.compAmount} style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>
                      Avail {Number(s.availableQuantity || 0).toLocaleString('en-IN')} · Assigned {Number(s.assignedQuantity || 0).toLocaleString('en-IN')} · Damaged {Number(s.damagedQuantity || 0).toLocaleString('en-IN')} · Lost {Number(s.lostQuantity || 0).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}