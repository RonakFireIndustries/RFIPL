import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import moduleStyles from '../ModulePage.module.css';
import local from './Purchasing.module.css';
import {
  createProductionConsumption,
  createProductionWastage,
  deleteProductionWastage,
  getFinishedLedger,
  getFinishedProducts,
  getInventoryUnits,
  getProductionConsumptions,
  getProductionOrders,
  getProductionOutputs,
  getProductionWastage,
  getRawMaterialBatches,
  getRawMaterials,
  updateProductionWastage,
} from '@/api/inventory';
import { formatDateTime, formatMoney, formatQty, titleCase } from './utils';

const TABS = [
  { key: 'consumption', label: 'Material Consumption' },
  { key: 'wastage', label: 'Wastage' },
  { key: 'outputs', label: 'Finished Output' },
  { key: 'ledger', label: 'Finished Ledger' },
];

const WASTAGE_TYPES = [
  { value: 'normal', label: 'Normal' },
  { value: 'excess', label: 'Excess' },
  { value: 'damaged', label: 'Damaged' },
  { value: 'scrap', label: 'Scrap' },
];

export default function ProductionHistory() {
  const { accessToken } = useAuth();
  const { success, error: toastError } = useInteractions();

  const [tab, setTab] = useState('consumption');
  const [consumptions, setConsumptions] = useState([]);
  const [wastage, setWastage] = useState([]);
  const [outputs, setOutputs] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [orders, setOrders] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [batches, setBatches] = useState([]);
  const [units, setUnits] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [consumeOpen, setConsumeOpen] = useState(false);
  const [consumeOrderId, setConsumeOrderId] = useState('');
  const [consumeMaterialId, setConsumeMaterialId] = useState('');
  const [consumeBatchId, setConsumeBatchId] = useState('');
  const [consumeQuantity, setConsumeQuantity] = useState('');
  const [consumeUnitId, setConsumeUnitId] = useState('');
  const [consumeRemarks, setConsumeRemarks] = useState('');
  const [consumeError, setConsumeError] = useState('');
  const [consumeSubmitting, setConsumeSubmitting] = useState(false);

  const [wastageOpen, setWastageOpen] = useState(false);
  const [editingWastage, setEditingWastage] = useState(null);
  const [wastageOrderId, setWastageOrderId] = useState('');
  const [wastageMaterialId, setWastageMaterialId] = useState('');
  const [wastageType, setWastageType] = useState('normal');
  const [wastageQuantity, setWastageQuantity] = useState('');
  const [wastageUnitId, setWastageUnitId] = useState('');
  const [wastageDescription, setWastageDescription] = useState('');
  const [wastageError, setWastageError] = useState('');
  const [wastageSubmitting, setWastageSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [consumptionRows, wastageRows, outputRows, ledgerRows, orderRows,
        materialRows, batchRows, unitRows, productRows] = await Promise.all([
        getProductionConsumptions(accessToken),
        getProductionWastage(accessToken),
        getProductionOutputs(accessToken),
        getFinishedLedger(accessToken),
        getProductionOrders(accessToken),
        getRawMaterials(accessToken),
        getRawMaterialBatches(accessToken),
        getInventoryUnits(accessToken),
        getFinishedProducts(accessToken),
      ]);
      setConsumptions(consumptionRows);
      setWastage(wastageRows);
      setOutputs(outputRows);
      setLedger(ledgerRows);
      setOrders(orderRows);
      setMaterials(materialRows);
      setBatches(batchRows);
      setUnits(unitRows);
      setProducts(productRows);
    } catch (err) {
      toastError(err.message || 'Failed to load production history');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => { load(); }, [load]);

  const inProgressOrders = orders.filter((order) => order.status === 'in_progress');
  const filteredBatches = batches.filter((batch) => (
    !consumeMaterialId || String(batch.rawMaterialId) === String(consumeMaterialId)
  ));

  const openConsume = () => {
    const firstOrder = inProgressOrders[0];
    const firstMaterial = materials[0];
    setConsumeOrderId(firstOrder ? String(firstOrder.id) : '');
    setConsumeMaterialId(firstMaterial ? String(firstMaterial.id) : '');
    setConsumeBatchId('');
    setConsumeQuantity('');
    setConsumeUnitId(firstMaterial?.unitId ? String(firstMaterial.unitId) : '');
    setConsumeRemarks('');
    setConsumeError('');
    setConsumeOpen(true);
  };

  const changeConsumeMaterial = (id) => {
    setConsumeMaterialId(id);
    setConsumeBatchId('');
    const material = materials.find((m) => String(m.id) === String(id));
    if (material?.unitId) setConsumeUnitId(String(material.unitId));
  };

  const handleConsume = async (e) => {
    e.preventDefault();
    setConsumeError('');
    if (!consumeOrderId || !consumeMaterialId || !consumeUnitId || !(Number(consumeQuantity) > 0)) {
      setConsumeError('Select an in-progress order, material and unit, and enter a quantity');
      return;
    }

    setConsumeSubmitting(true);
    try {
      await createProductionConsumption({
        productionOrderId: consumeOrderId,
        rawMaterialId: consumeMaterialId,
        batchId: consumeBatchId || null,
        consumedQuantity: consumeQuantity,
        unitId: consumeUnitId,
        remarks: consumeRemarks || null,
      }, accessToken);
      success('Manual consumption recorded and deducted from batch stock');
      setConsumeOpen(false);
      await load();
    } catch (err) {
      setConsumeError(err.message || 'Failed to record consumption');
    } finally {
      setConsumeSubmitting(false);
    }
  };

  const openWastage = (row = null) => {
    setEditingWastage(row);
    setWastageOrderId(row ? String(row.productionOrderId) : (orders[0] ? String(orders[0].id) : ''));
    setWastageMaterialId(row?.rawMaterialId ? String(row.rawMaterialId) : '');
    setWastageType(row?.wastageType || 'normal');
    setWastageQuantity(row ? String(row.quantity) : '');
    setWastageUnitId(row?.unitId ? String(row.unitId) : (materials[0]?.unitId ? String(materials[0].unitId) : ''));
    setWastageDescription(row?.description || '');
    setWastageError('');
    setWastageOpen(true);
  };

  const handleWastage = async (e) => {
    e.preventDefault();
    setWastageError('');
    if (!wastageOrderId || !wastageType || !wastageUnitId || !(Number(wastageQuantity) > 0)) {
      setWastageError('Select an order, wastage type and unit, and enter a quantity');
      return;
    }

    const payload = {
      productionOrderId: wastageOrderId,
      rawMaterialId: wastageMaterialId || null,
      wastageType,
      quantity: wastageQuantity,
      unitId: wastageUnitId,
      description: wastageDescription || null,
    };

    setWastageSubmitting(true);
    try {
      if (editingWastage) {
        await updateProductionWastage(editingWastage.id, payload, accessToken);
        success('Wastage record updated');
      } else {
        await createProductionWastage(payload, accessToken);
        success('Wastage record added');
      }
      setWastageOpen(false);
      await load();
    } catch (err) {
      setWastageError(err.message || 'Failed to save wastage record');
    } finally {
      setWastageSubmitting(false);
    }
  };

  const handleDeleteWastage = async (row) => {
    if (!window.confirm(`Delete ${titleCase(row.wastageType)} wastage of ${formatQty(row.quantity)} ${row.unitSymbol || ''}?`)) return;
    try {
      await deleteProductionWastage(row.id, accessToken);
      success('Wastage record deleted');
      await load();
    } catch (err) {
      toastError(err.message || 'Failed to delete wastage record');
    }
  };

  const consumptionColumns = [
    {
      key: 'productionNumber',
      label: 'Order',
      render: (value, row) => (
        <div>
          <span className={local.docNumber}>{value}</span>
          <span className={local.subtleBlock}>{formatDateTime(row.consumedAt)}</span>
        </div>
      ),
    },
    {
      key: 'rawMaterialName',
      label: 'Material',
      render: (value, row) => (
        <div>
          <span>{value}</span>
          <span className={local.subtleBlock}>{row.sku}</span>
        </div>
      ),
    },
    { key: 'batchNumber', label: 'Batch', render: (v) => v || '—' },
    { key: 'consumptionMode', label: 'Mode', render: (v) => titleCase(v) },
    { key: 'consumedQuantity', label: 'Quantity', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
    { key: 'consumedByEmail', label: 'By', render: (v) => v || '—' },
  ];

  const wastageColumns = [
    { key: 'productionNumber', label: 'Order' },
    { key: 'rawMaterialName', label: 'Material', render: (v) => v || '—' },
    { key: 'wastageType', label: 'Type', render: (v) => titleCase(v) },
    { key: 'quantity', label: 'Quantity', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
    { key: 'recordedAt', label: 'Recorded', render: (v) => formatDateTime(v) },
    { key: 'recordedByEmail', label: 'By', render: (v) => v || '—' },
    {
      key: 'id',
      label: 'Actions',
      width: '150px',
      render: (_, row) => (
        <div className={moduleStyles.actions} onClick={(e) => e.stopPropagation()}>
          <button className={moduleStyles.editBtn} onClick={() => openWastage(row)}>Edit</button>
          <button className={moduleStyles.deleteBtn} onClick={() => handleDeleteWastage(row)}>Delete</button>
        </div>
      ),
    },
  ];

  const outputColumns = [
    { key: 'productionNumber', label: 'Order' },
    {
      key: 'finishedProductName',
      label: 'Product',
      render: (value, row) => (
        <div>
          <span>{value}</span>
          <span className={local.subtleBlock}>{row.finishedProductSku}</span>
        </div>
      ),
    },
    { key: 'batchNumber', label: 'Batch' },
    { key: 'outputQuantity', label: 'Quantity', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
    { key: 'manufacturingDate', label: 'Manufactured', render: (v) => formatDateTime(v) },
  ];

  const ledgerColumns = [
    {
      key: 'transactionAt',
      label: 'When',
      render: (value, row) => (
        <div>
          <span className={local.docNumber}>{row.batchNumber}</span>
          <span className={local.subtleBlock}>{formatDateTime(value)}</span>
        </div>
      ),
    },
    {
      key: 'finishedProductName',
      label: 'Product',
      render: (value, row) => (
        <div>
          <span>{value}</span>
          <span className={local.subtleBlock}>{row.sku}</span>
        </div>
      ),
    },
    { key: 'transactionType', label: 'Movement', render: (v) => titleCase(v) },
    { key: 'quantityIn', label: 'In', align: 'right', render: (v) => (Number(v) > 0 ? formatQty(v) : '—') },
    { key: 'quantityOut', label: 'Out', align: 'right', render: (v) => (Number(v) > 0 ? formatQty(v) : '—') },
    { key: 'unitCost', label: 'Unit cost', align: 'right', render: (v) => formatMoney(v) },
    { key: 'createdByEmail', label: 'By', render: (v) => v || '—' },
  ];

  return (
    <div>
      <div className={moduleStyles.pageHeader}>
        <div>
          <h2 className={local.sectionTitle}>Movement History</h2>
          <p className={moduleStyles.pageSub}>Material consumption, wastage, finished output and the finished stock ledger.</p>
        </div>
      </div>

      <div className={local.tabs} role="tablist" aria-label="Production history sections">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`${local.tab} ${tab === item.key ? local.tabActive : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className={local.workflowStrip}>
        <div className={local.step}>
          <span className={local.stepLabel}>Consumption rows</span>
          <span className={local.stepValue}>{consumptions.length}</span>
        </div>
        <div className={local.step}>
          <span className={local.stepLabel}>Wastage rows</span>
          <span className={local.stepValue}>{wastage.length}</span>
        </div>
        <div className={local.step}>
          <span className={local.stepLabel}>Finished outputs</span>
          <span className={local.stepValue}>{outputs.length}</span>
        </div>
        <div className={local.step}>
          <span className={local.stepLabel}>Ledger entries</span>
          <span className={local.stepValue}>{ledger.length}</span>
        </div>
      </div>

      {loading ? (
        <div className={moduleStyles.loading}>Loading...</div>
      ) : (
        <>
          {tab === 'consumption' && (
            <div className={local.panel}>
              <div className={local.panelHeader}>
                <div>
                  <h3 className={local.sectionTitle}>Material Consumption</h3>
                  <p className={local.hint}>
                    Automatic rows are created when orders are completed. Manual rows can only be added to in-progress orders.
                  </p>
                </div>
                <button className={moduleStyles.primaryBtn} onClick={openConsume} disabled={inProgressOrders.length === 0}>
                  + Record consumption
                </button>
              </div>
              <Table
                columns={consumptionColumns}
                data={consumptions}
                searchable
                searchKeys={['productionNumber', 'rawMaterialName', 'sku', 'batchNumber', 'consumptionMode']}
                searchPlaceholder="Search consumption..."
                emptyMessage="No material consumption recorded yet."
              />
              {inProgressOrders.length === 0 && (
                <p className={local.hint}>Start a production order before recording manual consumption.</p>
              )}
            </div>
          )}

          {tab === 'wastage' && (
            <div className={local.panel}>
              <div className={local.panelHeader}>
                <div>
                  <h3 className={local.sectionTitle}>Wastage</h3>
                  <p className={local.hint}>BOM wastage is posted automatically on completion. These records are for reporting.</p>
                </div>
                <button className={moduleStyles.primaryBtn} onClick={() => openWastage()}>+ Record wastage</button>
              </div>
              <Table
                columns={wastageColumns}
                data={wastage}
                searchable
                searchKeys={['productionNumber', 'rawMaterialName', 'wastageType', 'description', 'recordedByEmail']}
                searchPlaceholder="Search wastage..."
                emptyMessage="No wastage recorded."
              />
            </div>
          )}

          {tab === 'outputs' && (
            <div className={local.panel}>
              <div className={local.panelHeader}>
                <div>
                  <h3 className={local.sectionTitle}>Finished Output</h3>
                  <p className={local.hint}>Outputs are created automatically when a production order is completed and cannot be edited here.</p>
                </div>
              </div>
              <Table
                columns={outputColumns}
                data={outputs}
                searchable
                searchKeys={['productionNumber', 'finishedProductName', 'finishedProductSku', 'batchNumber']}
                searchPlaceholder="Search outputs..."
                emptyMessage="No finished output yet."
              />
            </div>
          )}

          {tab === 'ledger' && (
            <div className={local.panel}>
              <div className={local.panelHeader}>
                <div>
                  <h3 className={local.sectionTitle}>Finished Stock Ledger</h3>
                  <p className={local.hint}>Every finished-goods movement with quantity, cost, user and timestamp.</p>
                </div>
              </div>
              <Table
                columns={ledgerColumns}
                data={ledger}
                searchable
                searchKeys={['batchNumber', 'finishedProductName', 'sku', 'transactionType', 'createdByEmail']}
                searchPlaceholder="Search ledger..."
                emptyMessage="No finished stock movements yet."
              />
            </div>
          )}
        </>
      )}

      <Modal isOpen={consumeOpen} onClose={() => setConsumeOpen(false)} title="Record manual consumption">
        {consumeOpen && (
          <form onSubmit={handleConsume} className={moduleStyles.form}>
            {consumeError && <div className={moduleStyles.error}>{consumeError}</div>}
            <p className={local.note}>Manual consumption is deducted from batch stock immediately and written to the raw material ledger.</p>
            <div className={moduleStyles.formGrid}>
              <FormField
                label="In-progress order"
                type="select"
                value={consumeOrderId}
                onChange={(e) => setConsumeOrderId(e.target.value)}
                options={inProgressOrders.map((order) => ({ value: order.id, label: `${order.productionNumber} · ${order.finishedProductName || 'Production'}` }))}
                required
              />
              <FormField
                label="Raw material"
                type="select"
                value={consumeMaterialId}
                onChange={(e) => changeConsumeMaterial(e.target.value)}
                options={materials.map((m) => ({ value: m.id, label: `${m.sku} · ${m.name}` }))}
                required
              />
              <FormField
                label="Batch"
                type="select"
                value={consumeBatchId}
                onChange={(e) => setConsumeBatchId(e.target.value)}
                options={filteredBatches.map((batch) => ({ value: batch.id, label: `${batch.batchNumber} · ${formatQty(batch.currentQuantity)} left` }))}
                placeholder="FIFO (automatic)"
              />
              <FormField label="Quantity" type="number" value={consumeQuantity} onChange={(e) => setConsumeQuantity(e.target.value)} required />
              <FormField
                label="Unit"
                type="select"
                value={consumeUnitId}
                onChange={(e) => setConsumeUnitId(e.target.value)}
                options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))}
                required
              />
            </div>
            <FormField label="Remarks" type="textarea" value={consumeRemarks} onChange={(e) => setConsumeRemarks(e.target.value)} placeholder="Optional" />
            <div className={moduleStyles.formActions}>
              <button type="button" className={moduleStyles.cancelBtn} onClick={() => setConsumeOpen(false)}>Cancel</button>
              <button type="submit" className={moduleStyles.primaryBtn} disabled={consumeSubmitting}>
                {consumeSubmitting ? 'Saving...' : 'Record consumption'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={wastageOpen}
        onClose={() => setWastageOpen(false)}
        title={editingWastage ? 'Edit wastage record' : 'Record wastage'}
      >
        {wastageOpen && (
          <form onSubmit={handleWastage} className={moduleStyles.form}>
            {wastageError && <div className={moduleStyles.error}>{wastageError}</div>}
            <div className={moduleStyles.formGrid}>
              <FormField
                label="Production order"
                type="select"
                value={wastageOrderId}
                onChange={(e) => setWastageOrderId(e.target.value)}
                options={orders.map((order) => ({ value: order.id, label: order.productionNumber }))}
                required
              />
              <FormField
                label="Raw material"
                type="select"
                value={wastageMaterialId}
                onChange={(e) => setWastageMaterialId(e.target.value)}
                options={materials.map((m) => ({ value: m.id, label: `${m.sku} · ${m.name}` }))}
                placeholder="Optional"
              />
              <FormField
                label="Wastage type"
                type="select"
                value={wastageType}
                onChange={(e) => setWastageType(e.target.value)}
                options={WASTAGE_TYPES}
                required
              />
              <FormField label="Quantity" type="number" value={wastageQuantity} onChange={(e) => setWastageQuantity(e.target.value)} required />
              <FormField
                label="Unit"
                type="select"
                value={wastageUnitId}
                onChange={(e) => setWastageUnitId(e.target.value)}
                options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))}
                required
              />
            </div>
            <FormField label="Description" type="textarea" value={wastageDescription} onChange={(e) => setWastageDescription(e.target.value)} placeholder="Optional" />
            <p className={local.hint}>Wastage records are informational; stock is not deducted again for these rows.</p>
            <div className={moduleStyles.formActions}>
              <button type="button" className={moduleStyles.cancelBtn} onClick={() => setWastageOpen(false)}>Cancel</button>
              <button type="submit" className={moduleStyles.primaryBtn} disabled={wastageSubmitting}>
                {wastageSubmitting ? 'Saving...' : editingWastage ? 'Update wastage' : 'Save wastage'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
