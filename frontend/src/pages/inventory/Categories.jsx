import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import {
  createInventoryCategory,
  deleteInventoryCategory,
  getInventoryCategories,
  updateInventoryCategory,
} from '@/api/inventory';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from '../ModulePage.module.css';
import local from './Inventory.module.css';
import { titleCase } from './utils';

const TYPES = ['raw_material', 'finished_product', 'tool'];

const EMPTY = {
  name: '',
  inventoryType: 'raw_material',
  description: '',
  isActive: true,
};

export default function Categories() {
  const { accessToken } = useAuth();
  const { success, error: toastError, confirm } = useInteractions();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState('');

  const load = useCallback(async () => {
    try {
      setCategories(await getInventoryCategories(accessToken, filterType ? { inventoryType: filterType } : {}));
    } catch (err) {
      toastError(err.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [accessToken, filterType, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY, inventoryType: filterType || 'raw_material' });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name,
      inventoryType: row.inventoryType,
      description: row.description || '',
      isActive: !!row.isActive,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = { ...form, isActive: form.isActive ? 1 : 0 };
      if (editing) {
        await updateInventoryCategory(editing.id, payload, accessToken);
        success(`Category "${form.name}" updated`);
      } else {
        await createInventoryCategory(payload, accessToken);
        success(`Category "${form.name}" created`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to save category');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Delete category',
      message: `Delete category "${row.name}"?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteInventoryCategory(row.id, accessToken);
      success(`Category "${row.name}" deleted`);
      await load();
    } catch (err) {
      toastError(err.message || 'Failed to delete category');
    }
  };

  const columns = [
    { key: 'name', label: 'Category' },
    {
      key: 'inventoryType',
      label: 'Applies to',
      width: '170px',
      render: (value) => <span className={`${styles.badge} ${local.badgeBlue}`}>{titleCase(value)}</span>,
    },
    { key: 'description', label: 'Description' },
    {
      key: 'isActive',
      label: 'Status',
      width: '100px',
      render: (value) => (
        <span className={value ? styles.badgeGreen : styles.badgeGray}>{value ? 'Active' : 'Inactive'}</span>
      ),
    },
    {
      key: 'id',
      label: '',
      width: '150px',
      render: (_, row) => (
        <div className={styles.actions}>
          <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); openEdit(row); }}>Edit</button>
          <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Categories</h1>
          <p className={styles.pageSub}>{categories.length} categories</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Category</button>
      </div>

      <div className={local.filterBar}>
        <div className={local.filterField}>
          <label className={local.filterLabel}>Inventory type</label>
          <select
            className={local.filterInput}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All</option>
            {TYPES.map((type) => (
              <option key={type} value={type}>{titleCase(type)}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={categories}
          searchable
          searchPlaceholder="Search categories..."
          emptyMessage="No categories found."
        />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Category' : 'New Category'}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {formError && <div className={styles.error}>{formError}</div>}
          <FormField
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Sheets & Plates"
            required
          />
          <FormField
            label="Applies to"
            type="select"
            value={form.inventoryType}
            onChange={(e) => setForm({ ...form, inventoryType: e.target.value })}
            options={TYPES.map((type) => ({ value: type, label: titleCase(type) }))}
            required
          />
          <FormField
            label="Description"
            type="textarea"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Short description"
          />
          <FormField
            label="Active"
            type="select"
            value={form.isActive ? '1' : '0'}
            onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}
            options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]}
          />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
