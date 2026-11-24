import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import {
  createRawMaterial,
  deleteRawMaterial,
  getInventoryCategories,
  getInventoryUnits,
  getRawMaterial,
  getRawMaterialStockSummary,
  getRawMaterials,
  getSuppliers,
  updateRawMaterial,
} from '@/api/inventory';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from '../ModulePage.module.css';
import local from './Inventory.module.css';
import { amountOrNull, formatQty, numberOrZero } from './utils';

const EMPTY = {
  sku: '',
  name: '',
  categoryId: '',
  unitId: '',
  description: '',
  grade: '',
  specification: '',
  thickness: '',
  size: '',
  hsnCode: '',
  gstRate: '',
  minimumStockLevel: '0',
  reorderLevel: '0',
  defaultPurchasePrice: '',
  isActive: true,
};

function newSupplierRow(supplierId = '') {
  return {
    key: Math.random().toString(36).slice(2),
    supplierId,
    supplierItemCode: '',
    purchasePrice: '',
    isPreferred: false,
  };
}

export default function RawMaterials() {
  const { accessToken } = useAuth();
  const { success, error: toastError, confirm } = useInteractions();

  const [materials, setMaterials] = useState([]);
  const [categories, setCategories] = useState([]);
  const [units, setUnits] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [supplierRows, setSupplierRows] = useState([]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      const [materialList, categoryList, unitList, supplierList, stockSummary] = await Promise.all([
        getRawMaterials(accessToken),
        getInventoryCategories(accessToken),
        getInventoryUnits(accessToken),
        getSuppliers(accessToken),
        getRawMaterialStockSummary(accessToken),
      ]);
      setMaterials(materialList);
      setCategories(categoryList);
      setUnits(unitList);
      setSuppliers(supplierList);
      setSummary(stockSummary);
    } catch (err) {
      toastError(err.message || 'Failed to load raw materials');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const stockByMaterial = useMemo(() => {
    const map = new Map();
    summary.forEach((row) => map.set(String(row.id), row));
    return map;
  }, [summary]);

  const rawMaterialCategories = useMemo(
    () => categories.filter((category) => category.inventoryType === 'raw_material'),
    [categories]
  );

  const visibleMaterials = useMemo(
    () => (filterCategory ? materials.filter((m) => String(m.categoryId) === String(filterCategory)) : materials),
    [materials, filterCategory]
  );

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY,
      categoryId: filterCategory || '',
      unitId: units.length === 1 ? String(units[0].id) : '',
    });
    setSupplierRows([]);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = async (row) => {
    setFormError('');
    setDetailLoading(true);
    try {
      const detail = await getRawMaterial(row.id, accessToken);
      setEditing(detail);
      setForm({
        sku: detail.sku || '',
        name: detail.name || '',
        categoryId: detail.categoryId ? String(detail.categoryId) : '',
        unitId: detail.unitId ? String(detail.unitId) : '',
        description: detail.description || '',
        grade: detail.grade || '',
        specification: detail.specification || '',
        thickness: detail.thickness || '',
        size: detail.size || '',
        hsnCode: detail.hsnCode || '',
        gstRate: detail.gstRate === null || detail.gstRate === undefined ? '' : String(detail.gstRate),
        minimumStockLevel: String(detail.minimumStockLevel ?? 0),
        reorderLevel: String(detail.reorderLevel ?? 0),
        defaultPurchasePrice:
          detail.defaultPurchasePrice === null || detail.defaultPurchasePrice === undefined
            ? ''
            : String(detail.defaultPurchasePrice),
        isActive: !!detail.isActive,
      });
      setSupplierRows(
        (detail.suppliers || []).map((link) => ({
          key: `link-${link.id}`,
          supplierId: String(link.supplierId),
          supplierItemCode: link.supplierItemCode || '',
          purchasePrice:
            link.purchasePrice === null || link.purchasePrice === undefined ? '' : String(link.purchasePrice),
          isPreferred: !!link.isPreferred,
        }))
      );
      setModalOpen(true);
    } catch (err) {
      toastError(err.message || 'Failed to load raw material');
    } finally {
      setDetailLoading(false);
    }
  };

  const updateSupplierRow = (key, patch) => {
    setSupplierRows((rows) =>
      rows.map((row) => {
        if (row.key !== key) {
          return patch.isPreferred ? { ...row, isPreferred: false } : row;
        }
        return { ...row, ...patch };
      })
    );
  };

  const removeSupplierRow = (key) => {
    setSupplierRows((rows) => rows.filter((row) => row.key !== key));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) {
      setFormError('Material name is required');
      return;
    }
    if (!form.unitId) {
      setFormError('Select a unit of measure');
      return;
    }

    const linked = supplierRows.filter((row) => row.supplierId);
    const supplierIds = linked.map((row) => row.supplierId);
    if (new Set(supplierIds).size !== supplierIds.length) {
      setFormError('Each supplier can only be linked once');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        sku: form.sku.trim() || undefined,
        name: form.name.trim(),
        categoryId: form.categoryId || null,
        unitId: form.unitId,
        description: form.description || null,
        grade: form.grade || null,
        specification: form.specification || null,
        thickness: form.thickness || null,
        size: form.size || null,
        hsnCode: form.hsnCode || null,
        gstRate: amountOrNull(form.gstRate),
        minimumStockLevel: numberOrZero(form.minimumStockLevel),
        reorderLevel: numberOrZero(form.reorderLevel),
        defaultPurchasePrice: amountOrNull(form.defaultPurchasePrice),
        isActive: form.isActive ? 1 : 0,
        suppliers: linked.map((row) => ({
          supplierId: row.supplierId,
          supplierItemCode: row.supplierItemCode || null,
          purchasePrice: amountOrNull(row.purchasePrice),
          isPreferred: row.isPreferred ? 1 : 0,
        })),
      };

      if (editing) {
        await updateRawMaterial(editing.id, payload, accessToken);
        success(`Material "${payload.name}" updated`);
      } else {
        const created = await createRawMaterial(payload, accessToken);
        success(`Material "${payload.name}" created as ${created.sku}`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to save raw material');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Delete raw material',
      message: `Delete "${row.name}" (${row.sku})? It will be hidden from material lists; stock and ledger history stays for audit.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteRawMaterial(row.id, accessToken);
      success(`Material "${row.name}" deleted`);
      await load();
    } catch (err) {
      toastError(err.message || 'Failed to delete raw material');
    }
  };

  const columns = [
    {
      key: 'sku',
      label: 'SKU',
      width: '120px',
      render: (value) => <span className={local.mono}>{value}</span>,
    },
    {
      key: 'name',
      label: 'Material',
      render: (value, row) => (
        <div>
          <span className={local.materialName}>{value}</span>
          {(row.grade || row.size) && (
            <span className={local.materialSku}>{[row.grade, row.size].filter(Boolean).join(' · ')}</span>
          )}
        </div>
      ),
    },
    { key: 'categoryName', label: 'Category', render: (value) => value || '—' },
    {
      key: 'unitId',
      label: 'Unit',
      width: '90px',
      render: (_, row) => row.unitSymbol || '—',
    },
    {
      key: 'id',
      label: 'In stock',
      width: '130px',
      align: 'right',
      render: (_, row) => {
        const stock = stockByMaterial.get(String(row.id));
        return (
          <span className={local.mono}>
            {formatQty(stock?.totalStock ?? 0)} {row.unitSymbol || ''}
          </span>
        );
      },
    },
    {
      key: 'minimumStockLevel',
      label: 'Minimum',
      width: '110px',
      align: 'right',
      render: (value, row) => <span className={local.mono}>{formatQty(value)} {row.unitSymbol || ''}</span>,
    },
    {
      key: 'isActive',
      label: 'Status',
      width: '100px',
      render: (value) => (
        <span className={value ? styles.badgeGreen : styles.badgeGray}>{value ? 'Active' : 'Inactive'}</span>
      ),
    },
    {
      key: 'actions',
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
          <h1 className={styles.pageTitle}>Raw Materials</h1>
          <p className={styles.pageSub}>{materials.length} materials</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate} disabled={detailLoading}>
          + New Material
        </button>
      </div>

      {units.length === 0 && (
        <div className={`${local.note} ${local.sectionGap}`}>
          Create at least one unit under <strong>Inventory → Units</strong> before adding raw materials.
        </div>
      )}

      <div className={local.filterBar}>
        <div className={local.filterField}>
          <label className={local.filterLabel}>Category</label>
          <select
            className={local.filterInput}
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="">All categories</option>
            {rawMaterialCategories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={visibleMaterials}
          searchable
          searchPlaceholder="Search by name, SKU, HSN or grade..."
          emptyMessage="No raw materials yet. Create a unit, then add your first material."
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit ${editing.sku}` : 'New Raw Material'}
        wide
      >
        <form onSubmit={handleSubmit} className={styles.form}>
          {formError && <div className={styles.error}>{formError}</div>}

          <div className={styles.formGrid}>
            <FormField
              label="SKU"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              placeholder="Leave blank to auto-generate (RM-0001)"
            />
            <FormField
              label="Material name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="MS Sheet"
              required
            />
            <FormField
              label="Category"
              type="select"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              options={rawMaterialCategories.map((category) => ({ value: String(category.id), label: category.name }))}
              placeholder="No category"
            />
            <FormField
              label="Unit"
              type="select"
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              options={units.map((unit) => ({ value: String(unit.id), label: `${unit.name} (${unit.symbol})` }))}
              required
            />
            <FormField
              label="Grade"
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value })}
              placeholder="MS / SS 304"
            />
            <FormField
              label="Thickness"
              value={form.thickness}
              onChange={(e) => setForm({ ...form, thickness: e.target.value })}
              placeholder="2 mm"
            />
            <FormField
              label="Size / dimensions"
              value={form.size}
              onChange={(e) => setForm({ ...form, size: e.target.value })}
              placeholder="1250 x 2500 mm"
            />
            <FormField
              label="HSN code"
              value={form.hsnCode}
              onChange={(e) => setForm({ ...form, hsnCode: e.target.value })}
              placeholder="7208"
            />
            <FormField
              label="GST rate (%)"
              type="number"
              value={form.gstRate}
              onChange={(e) => setForm({ ...form, gstRate: e.target.value })}
              placeholder="18"
            />
            <FormField
              label="Default purchase price"
              type="number"
              value={form.defaultPurchasePrice}
              onChange={(e) => setForm({ ...form, defaultPurchasePrice: e.target.value })}
              placeholder="0.00"
            />
            <FormField
              label="Minimum stock level"
              type="number"
              value={form.minimumStockLevel}
              onChange={(e) => setForm({ ...form, minimumStockLevel: e.target.value })}
            />
            <FormField
              label="Reorder level"
              type="number"
              value={form.reorderLevel}
              onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
            />
            <FormField
              label="Active"
              type="select"
              value={form.isActive ? '1' : '0'}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}
              options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]}
            />
          </div>

          <FormField
            label="Specification"
            type="textarea"
            value={form.specification}
            onChange={(e) => setForm({ ...form, specification: e.target.value })}
            placeholder="Detailed specification"
          />

          <FormField
            label="Description"
            type="textarea"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Optional notes"
          />

          <div>
            <div className={local.panelHeader}>
              <div>
                <h3 className={local.panelTitle}>Suppliers</h3>
                <p className={local.panelSub}>Link one or more suppliers and mark one as preferred.</p>
              </div>
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => setSupplierRows((rows) => [...rows, newSupplierRow()])}
                disabled={suppliers.length === 0}
              >
                + Add Supplier
              </button>
            </div>

            {suppliers.length === 0 ? (
              <p className={local.hint}>No suppliers exist yet. Add suppliers first to link them here.</p>
            ) : supplierRows.length === 0 ? (
              <p className={local.hint}>No suppliers linked to this material.</p>
            ) : (
              <div className={local.supplierEditor}>
                <div className={local.supplierRowHeader}>
                  <span>Supplier</span>
                  <span>Supplier item code</span>
                  <span>Price</span>
                  <span>Preferred</span>
                  <span />
                </div>
                {supplierRows.map((row) => (
                  <div key={row.key} className={local.supplierRow}>
                    <select
                      className={local.inlineInput}
                      value={row.supplierId}
                      onChange={(e) => {
                        const supplierId = e.target.value;
                        const patch = { supplierId };
                        if (!row.purchasePrice && form.defaultPurchasePrice) {
                          patch.purchasePrice = form.defaultPurchasePrice;
                        }
                        updateSupplierRow(row.key, patch);
                      }}
                    >
                      <option value="">Select supplier...</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.companyName} ({supplier.supplierCode})
                        </option>
                      ))}
                    </select>
                    <input
                      className={local.inlineInput}
                      placeholder="Item code"
                      value={row.supplierItemCode}
                      onChange={(e) => updateSupplierRow(row.key, { supplierItemCode: e.target.value })}
                    />
                    <input
                      className={local.inlineInput}
                      type="number"
                      placeholder="0.00"
                      value={row.purchasePrice}
                      onChange={(e) => updateSupplierRow(row.key, { purchasePrice: e.target.value })}
                    />
                    <label className={local.preferredLabel}>
                      <input
                        type="checkbox"
                        checked={row.isPreferred}
                        onChange={(e) => updateSupplierRow(row.key, { isPreferred: e.target.checked })}
                      />
                      Preferred
                    </label>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => removeSupplierRow(row.key)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
