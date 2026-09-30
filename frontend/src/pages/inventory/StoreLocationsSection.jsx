import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getStockLocations, createStockLocation, updateStockLocation, deleteStockLocation } from '@/api/inventory';
import { getDepartments } from '@/api/departments';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from '@/pages/ModulePage.module.css';

export default function StoreLocationsSection() {
  const { accessToken } = useAuth();
  const [locations, setLocations] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', code: '', departmentId: '', description: '', isActive: true });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setLocations(await getStockLocations(accessToken)); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => {
    load();
    getDepartments(accessToken).then(setDepartments).catch(() => {});
  }, [load, accessToken]);

  const openCreate = () => { setEditing(null); setForm({ name: '', code: '', departmentId: '', description: '', isActive: true }); setError(''); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ name: row.name, code: row.code, departmentId: row.departmentId ?? '', description: row.description || '', isActive: !!row.isActive }); setError(''); setModalOpen(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.code) { setError('Name and code are required'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form, departmentId: form.departmentId || null, isActive: form.isActive ? 1 : 0 };
      if (editing) await updateStockLocation(editing.id, payload, accessToken);
      else await createStockLocation(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to save location'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete location "${row.name}"?`)) return;
    try { await deleteStockLocation(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'code', label: 'Code', width: '100px' },
    { key: 'name', label: 'Name' },
    { key: 'departmentName', label: 'Department', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'description', label: 'Description', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'isActive', label: 'Status', width: '90px', render: (v) => <span className={v ? styles.badgeGreen : styles.badgeGray}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'id', label: '', width: '130px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openEdit(row)}>Edit</button>
        <button className={styles.deleteBtn} onClick={() => handleDelete(row)}>Del</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Store Locations</h2>
          <p className={styles.pageSub}>{locations.length} locations</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Location</button>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={locations} emptyMessage="No locations found" />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Location' : 'New Location'}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <FormField label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Department" type="select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} options={departments.map((d) => ({ value: String(d.id), label: d.name }))} placeholder="None" />
            <FormField label="Active" type="select" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })} options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
          </div>
          <FormField label="Description" type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}