import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import {
  createRawMaterialBatch,
  getInventoryUnits,
  getRawMaterialBatches,
  getRawMaterials,
  getSuppliers,
  updateRawMaterialBatch,
} from '@/api/inventory';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from '../ModulePage.module.css';
import local from './Inventory.module.css';
import { formatDate, formatMoney, formatQty, todayISO, titleCase } from './utils';

const QC_STATUSES = ['approved', 'partial', 'rejected'];

const EMPTY = {
  rawMaterialId: '',
  supplierId: '',
  batchNumber: '',
  receivedDate: todayISO(),
  purchasePrice: '',
  originalQuantity: '',
  currentQuantity: '',
  unitId: '',
  qcStatus: 'approved',
};

function qcBadgeClass(status) {
  if (status === 'approved') return styles.badgeGreen;
  if (status === 'rejected') return styles.badgeRed;
  return local.badgeAmber;
}

export default function Batches() {
  const { accessToken } = useAuth();
  const { success, error: toastError } = useInteractions();

  const [batches, setBatches] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [batchList, materialList, supplierList, unitList] = await Promise.all([
        getRawMaterialBatches(accessToken),
        getRawMaterials(accessToken),
        getSuppliers(accessToken),
        getInventoryUnits(accessToken),
      ]);
      setBatches(batchList);
      setMaterials(materialList);
      setSuppliers(supplierList);
      setUnits(unitList);
    } catch (err) {
      toastError(err.message || 'Failed to load batches');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY,
      rawMaterialId: materials.length === 1 ? String(materials[0].id) : '',
      unitId: materials.length === 1 ? String(materials[0].unitId) : '',
      purchasePrice:
        materials.length === 1 && materials[0].defaultPurchasePrice
          ? String(materials[0].defaultPurchasePrice)
          : '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      rawMaterialId: String(row.rawMaterialId),
      supplierId: row.supplierId ? String(row.supplierId) : '',
      batchNumber: row.batchNumber || '',
      receivedDate: row.receivedDate ? String(row.receivedDate).slice(0, 10) : todayISO(),
      purchasePrice: row.purchasePrice === null || row.purchasePrice === undefined ? '' : String(row.purchasePrice),
      originalQuantity: String(row.originalQuantity ?? ''),
      currentQuantity: String(row.currentQuantity ?? ''),
      unitId: String(row.unitId),
      qcStatus: row.qcStatus || 'approved',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleMaterialChange = (rawMaterialId) => {
    const material = materials.find((m) => String(m.id) === String(rawMaterialId));
    setForm((current) => ({
      ...current,
      rawMaterialId,
      unitId: material ? String(material.unitId) : current.unitId,
      purchasePrice:
        !current.purchasePrice && material?.defaultPurchasePrice
          ? String(material.defaultPurchasePrice)
          : current.purchasePrice,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!form.rawMaterialId || !form.batchNumber.trim() || !form.receivedDate || !form.unitId) {
      setFormError('Material, batch number, received date and unit are required');
      return;
    }
    if (form.purchasePrice === '' || Number(form.purchasePrice) < 0) {
      setFormError('Purchase price is required and cannot be negative');
      return;
    }
    if (form.originalQuantity === '' || Number(form.originalQuantity) <= 0) {
      setFormError('Original quantity must be greater than zero');
      return;
    }
    if (form.currentQuantity !== '' && Number(form.currentQuantity) < 0) {
      setFormError('Current quantity cannot be negative');
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await updateRawMaterialBatch(
          editing.id,
          {
            supplierId: form.supplierId || null,
            batchNumber: form.batchNumber.trim(),
            receivedDate: form.receivedDate,
            purchasePrice: form.purchasePrice,
            originalQuantity: form.originalQuantity,
            currentQuantity: form.currentQuantity === '' ? form.originalQuantity : form.currentQuantity,
            qcStatus: form.qcStatus,
          },
          accessToken
        );
        success(`Batch "${form.batchNumber}" updated`);
      } else {
        await createRawMaterialBatch(
          {
            rawMaterialId: form.rawMaterialId,
            supplierId: form.supplierId || null,
            batchNumber: form.batchNumber.trim(),
            receivedDate: form.receivedDate,
            purchasePrice: form.purchasePrice,
            originalQuantity: form.originalQuantity,
            currentQuantity: form.currentQuantity === '' ? undefined : form.currentQuantity,
            unitId: form.unitId,
            qcStatus: form.qcStatus,
          },
          accessToken
        );
        success(`Batch "${form.batchNumber}" received into stock`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to save batch');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { key: 'batchNumber', label: 'Batch', width: '130px' },
    {
      key: 'rawMaterialName',
      label: 'Material',
      render: (value, row) => (
        <div>
          <span className={local.materialName}>{value || '—'}</span>
          <span className={local.materialSku}>{row.sku}</span>
        </div>
      ),
    },
    { key: 'supplierName', label: 'Supplier', render: (value) => value || '—' },
    { key: 'receivedDate', label: 'Received', width: '120px', render: (value) => formatDate(value) },
    {
      key: 'purchasePrice',
      label: 'Rate',
      width: '110px',
      align: 'right',
      render: (value) => <span className={local.mono}>{formatMoney(value)}</span>,
    },
    {
      key: 'originalQuantity',
      label: 'Received qty',
      width: '120px',
      align: 'right',
      render: (value, row) => <span className={local.mono}>{formatQty(value)} {row.unitSymbol || ''}</span>,
    },
    {
      key: 'currentQuantity',
      label: 'Remaining',
      width: '120px',
      align: 'right',
      render: (value, row) => <span className={local.mono}>{formatQty(value)} {row.unitSymbol || ''}</span>,
    },
    {
      key: 'qcStatus',
      label: 'QC',
      width: '110px',
      render: (value) => <span className={qcBadgeClass(value)}>{titleCase(value)}</span>,
    },
    {
      key: 'id',
      label: '',
      width: '90px',
      render: (_, row) => (
        <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); openEdit(row); }}>Edit</button>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Batches</h1>
          <p className={styles.pageSub}>{batches.length} material batches</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate} disabled={materials.length === 0}>
          + New Batch
        </button>
      </div>

      {materials.length === 0 && (
        <div className={`${local.note} ${local.sectionGap}`}>
          Add a raw material first. Every batch belongs to a material and carries its own price and quantity.
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={batches}
          searchable
          searchKeys={['batchNumber', 'rawMaterialName', 'sku', 'supplierName', 'qcStatus']}
          searchPlaceholder="Search batches..."
          emptyMessage="No batches yet. Receiving a batch adds stock automatically."
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Edit batch ${editing.batchNumber}` : 'New Batch'}
        wide
      >
        <form onSubmit={handleSubmit} className={styles.form}>
          {formError && <div className={styles.error}>{formError}</div>}

          {editing && (
            <div className={local.warnNote}>
              Changing <strong>remaining quantity</strong> adjusts current stock and writes an adjustment
              entry in the ledger.
            </div>
          )}

          <div className={styles.formGrid}>
            <FormField
              label="Raw material"
              type="select"
              value={form.rawMaterialId}
              onChange={(e) => handleMaterialChange(e.target.value)}
              options={materials.map((material) => ({
                value: String(material.id),
                label: `${material.name} (${material.sku})`,
              }))}
              required
              disabled={!!editing}
            />
            <FormField
              label="Supplier"
              type="select"
              value={form.supplierId}
              onChange={(e) => setForm({ ...form, supplierId: e.target.value })}
              options={suppliers.map((supplier) => ({
                value: String(supplier.id),
                label: `${supplier.companyName} (${supplier.supplierCode})`,
              }))}
              placeholder="No supplier / opening stock"
            />
            <FormField
              label="Batch number"
              value={form.batchNumber}
              onChange={(e) => setForm({ ...form, batchNumber: e.target.value })}
              placeholder="LOT-2026-001"
              required
            />
            <FormField
              label="Received date"
              type="date"
              value={form.receivedDate}
              onChange={(e) => setForm({ ...form, receivedDate: e.target.value })}
              required
            />
            <FormField
              label="Purchase price per unit"
              type="number"
              value={form.purchasePrice}
              onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })}
              placeholder="0.00"
              required
            />
            <FormField
              label="Unit"
              type="select"
              value={form.unitId}
              onChange={(e) => setForm({ ...form, unitId: e.target.value })}
              options={units.map((unit) => ({ value: String(unit.id), label: `${unit.name} (${unit.symbol})` }))}
              required
              disabled={!!editing}
            />
            <FormField
              label="Original quantity"
              type="number"
              value={form.originalQuantity}
              onChange={(e) => setForm({ ...form, originalQuantity: e.target.value })}
              placeholder="0"
              required
            />
            <FormField
              label="Current quantity"
              type="number"
              value={form.currentQuantity}
              onChange={(e) => setForm({ ...form, currentQuantity: e.target.value })}
              placeholder="Defaults to original quantity"
            />
            <FormField
              label="QC status"
              type="select"
              value={form.qcStatus}
              onChange={(e) => setForm({ ...form, qcStatus: e.target.value })}
              options={QC_STATUSES.map((status) => ({ value: status, label: titleCase(status) }))}
            />
          </div>

          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Saving...' : editing ? 'Save changes' : 'Receive batch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
