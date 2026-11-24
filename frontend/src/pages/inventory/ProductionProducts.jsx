import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import moduleStyles from '../ModulePage.module.css';
import local from './Purchasing.module.css';
import {
  createFinishedProduct,
  deleteFinishedProduct,
  getFinishedProducts,
  getInventoryCategories,
  getInventoryUnits,
  updateFinishedProduct,
} from '@/api/inventory';
import { formatMoney, formatQty } from './utils';
import { StatusBadge } from './PurchasingShared';

function emptyForm(units) {
  return {
    sku: '',
    name: '',
    categoryId: '',
    unitId: units[0] ? String(units[0].id) : '',
    minimumStockLevel: '0',
    sellingPrice: '',
    description: '',
    isActive: true,
  };
}

export default function ProductionProducts() {
  const { accessToken } = useAuth();
  const { success, error: toastError } = useInteractions();

  const [rows, setRows] = useState([]);
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm([]));
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [products, unitRows, categoryRows] = await Promise.all([
        getFinishedProducts(accessToken),
        getInventoryUnits(accessToken),
        getInventoryCategories(accessToken),
      ]);
      setRows(products);
      setUnits(unitRows);
      setCategories(categoryRows.filter((c) => c.inventoryType === 'finished_product'));
    } catch (err) {
      toastError(err.message || 'Failed to load finished products');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm(units));
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      sku: row.sku || '',
      name: row.name || '',
      categoryId: row.categoryId ? String(row.categoryId) : '',
      unitId: String(row.unitId),
      minimumStockLevel: row.minimumStockLevel ?? '0',
      sellingPrice: row.sellingPrice ?? '',
      description: row.description || '',
      isActive: Number(row.isActive) === 1,
    });
    setFormError('');
    setFormOpen(true);
  };

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name || !form.unitId) {
      setFormError('Name and unit are required');
      return;
    }
    const payload = {
      sku: form.sku.trim() || undefined,
      name: form.name,
      categoryId: form.categoryId || null,
      unitId: form.unitId,
      minimumStockLevel: form.minimumStockLevel === '' ? 0 : form.minimumStockLevel,
      sellingPrice: form.sellingPrice === '' ? null : form.sellingPrice,
      description: form.description || null,
      isActive: form.isActive ? 1 : 0,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await updateFinishedProduct(editing.id, payload, accessToken);
        success(`${editing.sku} updated`);
      } else {
        const created = await createFinishedProduct(payload, accessToken);
        success(`${created.sku} created`);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to save finished product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete ${row.sku} — ${row.name}?`)) return;
    try {
      await deleteFinishedProduct(row.id, accessToken);
      success(`${row.sku} deleted`);
      await load();
    } catch (err) {
      toastError(err.message || 'Failed to delete finished product');
    }
  };

  const columns = [
    {
      key: 'sku',
      label: 'SKU',
      render: (value, row) => (
        <div>
          <span className={local.docNumber}>{value}</span>
          <span className={local.subtleBlock}>{row.categoryName || 'No category'}</span>
        </div>
      ),
    },
    { key: 'name', label: 'Product' },
    { key: 'unitSymbol', label: 'Unit', render: (value) => value || '—' },
    { key: 'minimumStockLevel', label: 'Min stock', align: 'right', render: (value, row) => `${formatQty(value)} ${row.unitSymbol || ''}` },
    { key: 'sellingPrice', label: 'Selling price', align: 'right', render: (value) => formatMoney(value) },
    {
      key: 'isActive',
      label: 'Status',
      width: '120px',
      render: (value) => <StatusBadge status={Number(value) === 1 ? 'approved' : 'cancelled'} />,
    },
    {
      key: 'id',
      label: 'Actions',
      width: '150px',
      render: (_, row) => (
        <div className={moduleStyles.actions} onClick={(e) => e.stopPropagation()}>
          <button className={moduleStyles.editBtn} onClick={() => openEdit(row)}>Edit</button>
          <button className={moduleStyles.deleteBtn} onClick={() => handleDelete(row)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={moduleStyles.pageHeader}>
        <div>
          <h2 className={local.sectionTitle}>Finished Products</h2>
          <p className={moduleStyles.pageSub}>
            SKUs are generated as FG-0001, FG-0002… when left blank. You can enter your own SKU instead.
          </p>
        </div>
        <button className={moduleStyles.primaryBtn} onClick={openCreate}>+ New Product</button>
      </div>

      {loading ? (
        <div className={moduleStyles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={rows}
          onRowClick={openEdit}
          searchable
          searchKeys={['sku', 'name', 'categoryName']}
          searchPlaceholder="Search finished products..."
          emptyMessage="No finished products yet."
        />
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Edit ${editing.sku}` : 'New finished product'}>
        <form onSubmit={handleSubmit} className={moduleStyles.form}>
          {formError && <div className={moduleStyles.error}>{formError}</div>}

          <div className={moduleStyles.formGrid}>
            <FormField
              label="SKU"
              value={form.sku}
              onChange={(e) => setField('sku', e.target.value)}
              placeholder={editing ? form.sku : 'Auto FG-0001'}
              disabled={false}
            />
            <FormField
              label="Unit"
              type="select"
              value={form.unitId}
              onChange={(e) => setField('unitId', e.target.value)}
              options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))}
              required
            />
          </div>

          <FormField label="Product name" value={form.name} onChange={(e) => setField('name', e.target.value)} required />

          <div className={moduleStyles.formGrid}>
            <FormField
              label="Category"
              type="select"
              value={form.categoryId}
              onChange={(e) => setField('categoryId', e.target.value)}
              options={categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder="Optional"
            />
            <FormField
              label="Minimum stock"
              type="number"
              value={form.minimumStockLevel}
              onChange={(e) => setField('minimumStockLevel', e.target.value)}
            />
          </div>

          <FormField
            label="Selling price"
            type="number"
            value={form.sellingPrice}
            onChange={(e) => setField('sellingPrice', e.target.value)}
            placeholder="Optional, entered manually"
          />
          <FormField
            label="Description"
            type="textarea"
            value={form.description}
            onChange={(e) => setField('description', e.target.value)}
          />

          <label className={local.checkboxLine}>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setField('isActive', e.target.checked)}
            />
            Active product
          </label>

          <p className={local.hint}>
            Selling price is only a reference for sales and margin reports; production cost can be entered at completion.
          </p>

          <div className={moduleStyles.formActions}>
            <button type="button" className={moduleStyles.cancelBtn} onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" className={moduleStyles.primaryBtn} disabled={submitting}>
              {submitting ? 'Saving...' : editing ? 'Update product' : 'Create product'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
