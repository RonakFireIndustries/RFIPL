import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getSalaryStructuresMaster, createSalaryStructureMaster, updateSalaryStructureMaster, deleteSalaryStructureMaster, getSalaryStructureMaster, addSalaryStructureComponent, removeSalaryStructureComponent } from '@/api/salaryStructureMaster';
import { getSalaryComponents } from '@/api/salaryComponents';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from '@/pages/ModulePage.module.css';

export default function SalaryStructuresTab() {
  const { accessToken } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', isActive: true });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [components, setComponents] = useState([]);
  const [compForm, setCompForm] = useState({});
  const [compError, setCompError] = useState('');
  const [compSubmitting, setCompSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getSalaryStructuresMaster(accessToken)); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '', isActive: true }); setError(''); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm({ name: row.name, description: row.description || '', isActive: !!row.isActive }); setError(''); setModalOpen(true); };

  const openDetail = async (row) => {
    try {
      const d = await getSalaryStructureMaster(row.id, accessToken);
      setDetail(d);
      setDetailOpen(true);
      setCompError('');
      setCompForm(defaultCompForm());
      getSalaryComponents(accessToken).then((list) => setComponents(list)).catch(() => {});
    } catch (err) { alert(err.message); }
  };

  const defaultCompForm = () => ({ salaryComponentId: '', calculationType: 'fixed', amount: '', percentage: '', formulaExpression: '', sortOrder: 0 });

  const handleComponentChange = (e) => {
    const id = Number(e.target.value);
    const comp = components.find((c) => c.id === id);
    const calcType = comp ? comp.calculationType === 'manual' ? 'fixed' : comp.calculationType : 'fixed';
    setCompForm({ ...compForm, salaryComponentId: e.target.value, calculationType: calcType });
  };

  const handleAddComponent = async (e) => {
    e.preventDefault();
    setCompError('');
    if (!compForm.salaryComponentId) { setCompError('Select a salary component'); return; }
    setCompSubmitting(true);
    try {
      await addSalaryStructureComponent(detail.id, compForm, accessToken);
      const d = await getSalaryStructureMaster(detail.id, accessToken);
      setDetail(d);
      setCompForm(defaultCompForm());
    } catch (err) { setCompError(err.message || 'Failed to add component'); }
    finally { setCompSubmitting(false); }
  };

  const handleRemoveComponent = async (row) => {
    if (!confirm(`Remove "${row.componentName}" from this structure?`)) return;
    try {
      await removeSalaryStructureComponent(detail.id, row.id, accessToken);
      const d = await getSalaryStructureMaster(detail.id, accessToken);
      setDetail(d);
    } catch (err) { alert(err.message); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name) { setError('Name is required'); return; }
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (payload.description === '') payload.description = null;
      if (editing) await updateSalaryStructureMaster(editing.id, payload, accessToken);
      else await createSalaryStructureMaster(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to save'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete salary structure "${row.name}"?`)) return;
    try { await deleteSalaryStructureMaster(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'NAME', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'isActive', label: 'Status', width: '100px', render: (v) => <span className={v ? styles.badgeGreen : styles.badgeGray}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'id', label: '', width: '150px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); openDetail(row); }}>Components</button>
        <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); openEdit(row); }}>Edit</button>
        <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>Del</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Salary Structures</h1>
          <p className={styles.pageSub}>{data.length} structures</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Structure</button>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : <Table columns={columns} data={data} emptyMessage="No salary structures found" />}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Salary Structure' : 'New Salary Structure'} width={520}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <FormField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <FormField label="Description" type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <FormField label="Active" type="select" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })} options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

<Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title={detail?.name ? `Components: ${detail.name}` : 'Structure Components'} width={640}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {detail.components?.length > 0 ? (
              <div className={styles.compList}>
                {detail.components.map((c) => (
                  <div key={c.id} className={styles.compItem}>
                    <div>
                      <div className={styles.compName}>{c.componentName} <span style={{ color: c.componentType === 'earning' ? '#16a34a' : '#ef4444', fontSize: 11 }}>{c.componentType}</span></div>
                      <div style={{ fontSize: 12, color: '#9ca3af' }}>{c.calculationType}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className={styles.compAmount}>
                        {c.calculationType === 'percentage' ? `${c.percentage}%` : c.calculationType === 'formula' ? c.formulaExpression : `₹${Number(c.amount || 0).toLocaleString('en-IN')}`}
                      </div>
                      <button className={styles.deleteBtn} onClick={() => handleRemoveComponent(c)}>Remove</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className={styles.emptyText}>No components in this structure</p>}

            <form onSubmit={handleAddComponent} className={styles.form} style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
              <h4 style={{ margin: 0, fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Add Component</h4>
              {compError && <div className={styles.error}>{compError}</div>}
              <FormField label="Salary Component" type="select" value={compForm.salaryComponentId} onChange={handleComponentChange} required
                options={components.filter((c) => c.isActive).map((c) => ({ value: String(c.id), label: `${c.name} (${c.componentType})` }))} />
              <div className={styles.formGrid}>
                <FormField label="Calculation" type="select" value={compForm.calculationType} onChange={(e) => setCompForm({ ...compForm, calculationType: e.target.value })} required
                  options={[{ value: 'fixed', label: 'Fixed' }, { value: 'percentage', label: 'Percentage' }, { value: 'formula', label: 'Formula' }]} />
                <FormField label="Sort Order" type="number" value={compForm.sortOrder} onChange={(e) => setCompForm({ ...compForm, sortOrder: Number(e.target.value) })} />
              </div>
              {compForm.calculationType === 'fixed' && (
                <FormField label="Amount (₹)" type="number" value={compForm.amount} onChange={(e) => setCompForm({ ...compForm, amount: Number(e.target.value) })} required />
              )}
              {compForm.calculationType === 'percentage' && (
                <FormField label="Percentage (%)" type="number" value={compForm.percentage} onChange={(e) => setCompForm({ ...compForm, percentage: Number(e.target.value) })} required placeholder="e.g. 50 = 50% of fixed earnings" />
              )}
              {compForm.calculationType === 'formula' && (
                <FormField label="Formula Expression" value={compForm.formulaExpression} onChange={(e) => setCompForm({ ...compForm, formulaExpression: e.target.value })} required placeholder="e.g. BASIC * 0.12" />
              )}
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn} disabled={compSubmitting}>{compSubmitting ? 'Adding...' : 'Add Component'}</button>
              </div>
            </form>
          </div>
        )}
      </Modal>
    </div>
  );
}