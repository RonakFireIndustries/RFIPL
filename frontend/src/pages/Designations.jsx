import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getDesignations, createDesignation, updateDesignation, deleteDesignation } from '@/api/designations';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from './ModulePage.module.css';

const EMPTY = { name: '', code: '', description: '', isActive: true };

export default function Designations() {
  const { accessToken } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getDesignations(accessToken)); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(EMPTY); setError(''); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ name: row.name, code: row.code, description: row.description || '', isActive: !!row.isActive }); setError(''); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (editing) await updateDesignation(editing.id, form, accessToken);
      else await createDesignation(form, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete designation "${row.name}"?`)) return;
    try { await deleteDesignation(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'code', label: 'Code', width: '100px' },
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'isActive', label: 'Status', width: '100px', render: (v) => <span className={v ? styles.badgeGreen : styles.badgeGray}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'id', label: '', width: '140px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); openEdit(row); }}>Edit</button>
        <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>Delete</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Designations</h1>
          <p className={styles.pageSub}>{data.length} designations</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Designation</button>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : <Table columns={columns} data={data} emptyMessage="No designations found" />}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Designation' : 'New Designation'}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <FormField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <FormField label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          <FormField label="Description" type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <FormField label="Active" type="select" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })} options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}