import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getSalaryComponents, createSalaryComponent, updateSalaryComponent, deleteSalaryComponent } from '@/api/salaryComponents';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from '@/pages/ModulePage.module.css';

const COMPONENT_TYPES = [
  { value: 'earning', label: 'Earning' },
  { value: 'deduction', label: 'Deduction' },
];

const CALC_TYPES = [
  { value: 'fixed', label: 'Fixed' },
  { value: 'percentage', label: 'Percentage' },
  { value: 'formula', label: 'Formula' },
];

function getDefault(comp) {
  if (comp) {
    return {
      name: comp.name || '',
      code: comp.code || '',
      componentType: comp.componentType || 'earning',
      calculationType: comp.calculationType || 'fixed',
      formulaExpression: comp.formulaExpression || '',
      isTaxable: !!comp.isTaxable,
      pfApplicable: !!comp.pfApplicable,
      esiApplicable: !!comp.esiApplicable,
      isStatutory: !!comp.isStatutory,
      isActive: !!comp.isActive,
    };
  }
  return { name: '', code: '', componentType: 'earning', calculationType: 'fixed', formulaExpression: '', isTaxable: false, pfApplicable: false, esiApplicable: false, isStatutory: false, isActive: true };
}

export default function SalaryComponentsTab() {
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
    try { setData(await getSalaryComponents(accessToken)); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(getDefault(null)); setError(''); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm(getDefault(row)); setError(''); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.code) {
      setError('Name and code are required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      if (payload.formulaExpression === '') payload.formulaExpression = null;
      if (editing) await updateSalaryComponent(editing.id, payload, accessToken);
      else await createSalaryComponent(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to save'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete salary component "${row.name}"?`)) return;
    try { await deleteSalaryComponent(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'CODE', label: 'Code', width: '90px' },
    { key: 'NAME', label: 'Name' },
    { key: 'componentType', label: 'Type', width: '100px', render: (v) => <span className={v === 'earning' ? styles.badgeGreen : styles.badgeRed}>{v}</span> },
    { key: 'calculationType', label: 'Calculation', width: '110px' },
    { key: 'isTaxable', label: 'Taxable', width: '80px', render: (v) => v ? 'Yes' : 'No' },
    { key: 'pfApplicable', label: 'PF', width: '60px', render: (v) => v ? 'Yes' : 'No' },
    { key: 'esiApplicable', label: 'ESI', width: '60px', render: (v) => v ? 'Yes' : 'No' },
    { key: 'isActive', label: 'Status', width: '80px', render: (v) => v ? 'Active' : 'Inactive' },
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
          <h1 className={styles.pageTitle}>Salary Components</h1>
          <p className={styles.pageSub}>{data.length} components</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Component</button>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : <Table columns={columns} data={data} emptyMessage="No salary components found" />}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Salary Component' : 'New Salary Component'} width={560}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <FormField label="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <FormField label="Type" type="select" value={form.componentType} onChange={(e) => setForm({ ...form, componentType: e.target.value })} options={COMPONENT_TYPES} required />
            <FormField label="Calculation" type="select" value={form.calculationType} onChange={(e) => setForm({ ...form, calculationType: e.target.value })} options={CALC_TYPES} required />
          </div>
          {form.calculationType === 'formula' && (
            <FormField label="Formula Expression" value={form.formulaExpression} onChange={(e) => setForm({ ...form, formulaExpression: e.target.value })} />
          )}
          <div className={styles.checkGroup}>
            {[['isTaxable', 'Taxable'], ['pfApplicable', 'PF Applicable'], ['esiApplicable', 'ESI Applicable'], ['isStatutory', 'Statutory'], ['isActive', 'Active']].map(([key, label]) => (
              <label key={key} className={styles.checkLabel}>
                <input type="checkbox" checked={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.checked })} />
                {label}
              </label>
            ))}
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}