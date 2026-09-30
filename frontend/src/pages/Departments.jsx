import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getDepartments, createDepartment, updateDepartment, deleteDepartment } from '@/api/departments';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from './ModulePage.module.css';

const EMPTY = { name: '', code: '', description: '', isActive: true };

export default function Departments() {
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
    try {
      setData(await getDepartments(accessToken));
    } catch { /* empty */ }
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
      if (editing) await updateDepartment(editing.id, form, accessToken);
      else await createDepartment(form, accessToken);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.message || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete department "${row.name}"?`)) return;
    try {
      await deleteDepartment(row.id, accessToken);
      load();
    } catch (err) {
      alert(err.message);
    }
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
          <h1 className={styles.pageTitle}>Departments</h1>
          <p className={styles.pageSub}>{data.length} departments</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Department</button>
      </div>

      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No departments found" />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Department' : 'New Department'}>
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