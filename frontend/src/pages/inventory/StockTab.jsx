import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getRawBatches, createRawBatch,
  getRawStockRows, upsertRawStock,
  getRawLedger, getRawStockSummary, getRawLowStock,
  getFinishedBatches, createFinishedBatch,
  getFinishedStockRows, upsertFinishedStock,
  getFinishedLedger, getFinishedStockSummary, getFinishedLowStock,
  getRawMaterials, getFinishedProducts, getSuppliers, getStockLocations, getInventoryUnits,
} from '@/api/inventory';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import { TabBar, StatusPill, STATUS_COLORS, fmtDate, fmtDateTime } from './shared';
import styles from '@/pages/ModulePage.module.css';

const QC_STATUS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'quarantine', label: 'Quarantine' },
];

export default function StockTab() {
  const { accessToken } = useAuth();
  const [section, setSection] = useState('raw');

  return (
    <div>
      <TabBar
        tabs={[
          { key: 'raw', label: 'Raw Material Stock' },
          { key: 'finished', label: 'Finished Product Stock' },
        ]}
        current={section}
        onChange={setSection}
      />
      {section === 'raw' && <StockSection mode="raw" accessToken={accessToken} />}
      {section === 'finished' && <StockSection mode="finished" accessToken={accessToken} />}
    </div>
  );
}

export function RawStockSection() {
  const { accessToken } = useAuth();
  return <StockSection mode="raw" accessToken={accessToken} />;
}

export function FinishedStockSection() {
  const { accessToken } = useAuth();
  return <StockSection mode="finished" accessToken={accessToken} />;
}

function StockSection({ mode, accessToken }) {
  const isRaw = mode === 'raw';
  const [view, setView] = useState('summary');
  const [notice, setNotice] = useState(null);

  const [materials, setMaterials] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [units, setUnits] = useState([]);

  const [summary, setSummary] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [batches, setBatches] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);

  const [batchOpen, setBatchOpen] = useState(false);
  const [batchForm, setBatchForm] = useState(emptyBatch());
  const [batchError, setBatchError] = useState('');
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  const [inOpen, setInOpen] = useState(false);
  const [inForm, setInForm] = useState({ itemId: '', batchId: '', locationId: '', quantity: '', unitId: '' });
  const [inError, setInError] = useState('');

  const [filters, setFilters] = useState({ itemId: '', locationId: '' });

  function emptyBatch() {
    return { itemId: '', supplierId: '', batchNumber: '', receivedDate: '', purchasePrice: '', originalQuantity: '', currentQuantity: '', unitId: '', qcStatus: 'approved' };
  }

  const loadSources = useCallback(async () => {
    const [m, s, l, u] = await Promise.all([
      isRaw ? getRawMaterials(accessToken) : getFinishedProducts(accessToken),
      getSuppliers(accessToken),
      getStockLocations(accessToken),
      getInventoryUnits(accessToken),
    ]);
    setMaterials(m);
    setSuppliers(s);
    setLocations(l);
    setUnits(u);
  }, [accessToken, isRaw]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, low] = await Promise.all([
        isRaw ? getRawStockSummary(accessToken) : getFinishedStockSummary(accessToken),
        isRaw ? getRawLowStock(accessToken) : getFinishedLowStock(accessToken),
      ]);
      setSummary(sum);
      setLowStock(low);
    } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, isRaw]);

  const loadBatches = useCallback(async () => {
    try { setBatches(isRaw ? await getRawBatches(accessToken) : await getFinishedBatches(accessToken)); } catch { /* empty */ }
  }, [accessToken, isRaw]);

  const loadStockRows = useCallback(async () => {
    try {
      const params = {};
      if (filters.itemId) params[isRaw ? 'rawMaterialId' : 'finishedProductId'] = filters.itemId;
      if (filters.locationId) params.locationId = filters.locationId;
      setStockRows(isRaw ? await getRawStockRows(accessToken, params) : await getFinishedStockRows(accessToken, params));
    } catch { /* empty */ }
  }, [accessToken, isRaw, filters]);

  const loadLedger = useCallback(async () => {
    try { setLedger(isRaw ? await getRawLedger(accessToken) : await getFinishedLedger(accessToken)); } catch { /* empty */ }
  }, [accessToken, isRaw]);

  useEffect(() => {
    loadSources();
    load();
  }, [loadSources, load]);

  useEffect(() => {
    if (view === 'batches') loadBatches();
    if (view === 'stock') loadStockRows();
    if (view === 'ledger') loadLedger();
  }, [view, loadBatches, loadStockRows, loadLedger]);

  const flash = (type, text) => setNotice({ type, text }) && setTimeout(() => setNotice(null), 4000);

  const openBatch = () => { setBatchForm(emptyBatch()); setBatchError(''); setBatchOpen(true); };

  const submitBatch = async (e) => {
    e.preventDefault();
    setBatchError('');
    if (!batchForm.itemId || !batchForm.batchNumber || !batchForm.receivedDate || !batchForm.originalQuantity || !batchForm.unitId) {
      setBatchError('Material, batch number, date, quantity and unit are required');
      return;
    }
    setBatchSubmitting(true);
    try {
      const payload = {
        [isRaw ? 'rawMaterialId' : 'finishedProductId']: Number(batchForm.itemId),
        batchNumber: batchForm.batchNumber,
        supplierId: batchForm.supplierId ? Number(batchForm.supplierId) : null,
        receivedDate: batchForm.receivedDate,
        purchasePrice: batchForm.purchasePrice === '' ? null : Number(batchForm.purchasePrice),
        originalQuantity: Number(batchForm.originalQuantity),
        currentQuantity: batchForm.currentQuantity === '' ? Number(batchForm.originalQuantity) : Number(batchForm.currentQuantity),
        unitId: Number(batchForm.unitId),
        qcStatus: batchForm.qcStatus,
      };
      if (isRaw) await createRawBatch(payload, accessToken);
      else await createFinishedBatch(payload, accessToken);
      setBatchOpen(false);
      loadBatches();
      load();
      flash('success', 'Batch created.');
    } catch (err) { setBatchError(err.message || 'Failed to create batch'); } finally { setBatchSubmitting(false); }
  };

  const submitIn = async (e) => {
    e.preventDefault();
    setInError('');
    if (!inForm.itemId || !inForm.locationId || !inForm.quantity || !inForm.unitId) {
      setInError('Material, location, quantity and unit are required');
      return;
    }
    try {
      const payload = {
        [isRaw ? 'rawMaterialId' : 'finishedProductId']: Number(inForm.itemId),
        batchId: inForm.batchId ? Number(inForm.batchId) : null,
        locationId: Number(inForm.locationId),
        quantity: Number(inForm.quantity),
        unitId: Number(inForm.unitId),
      };
      if (isRaw) await upsertRawStock(payload, accessToken);
      else await upsertFinishedStock(payload, accessToken);
      setInOpen(false);
      loadStockRows();
      load();
      flash('success', 'Stock added.');
    } catch (err) { setInError(err.message || 'Failed to add stock'); }
  };

  const summaryCols = [
    { key: 'sku', label: 'SKU', width: '120px' },
    { key: 'name', label: 'Name' },
    { key: 'minimumStockLevel', label: 'Min Lvl', width: '80px' },
    { key: 'unitSymbol', label: 'Unit', width: '70px' },
    { key: 'totalStock', label: 'Total Stock', width: '110px', render: (v, r) => (
      <strong style={{ color: Number(v) < Number(r.minimumStockLevel || 0) ? '#DC2626' : '#16a34a' }}>
        {Number(v || 0).toLocaleString('en-IN')}
      </strong>
    )},
    { key: 'status', label: 'Level', width: '110px', render: (_, r) => (
      Number(r.totalStock || 0) < Number(r.minimumStockLevel || 0)
        ? <StatusPill value="low stock" color="#DC2626" />
        : <StatusPill value="ok" color="#16a34a" />
    )},
  ];

  const batchCols = [
    { key: isRaw ? 'rawMaterialName' : 'finishedProductName', label: 'Material' },
    { key: 'batchNumber', label: 'Batch', width: '110px' },
    { key: 'supplierName', label: 'Supplier', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: isRaw ? 'receivedDate' : 'manufacturingDate', label: isRaw ? 'Received' : 'Mfg', width: '90px', render: (v) => fmtDate(v) },
    { key: 'originalQuantity', label: 'Original', width: '90px' },
    { key: 'currentQuantity', label: 'On Hand', width: '90px', render: (v) => <strong style={{ color: '#16a34a' }}>{Number(v || 0).toLocaleString('en-IN')}</strong> },
    { key: 'qcStatus', label: 'QC', width: '110px', render: (v) => <StatusPill value={v || '—'} color={STATUS_COLORS[v] || '#6b7280'} /> },
    { key: 'id', label: '', width: '90px', render: (_, row) => (
      <button className={styles.editBtn} onClick={() => alert(`Unit cost: ${row.purchasePrice ?? row.manualCost ?? '—'}`)}>Info</button>
    )},
  ];

  const stockCols = [
    { key: isRaw ? 'rawMaterialName' : 'finishedProductName', label: 'Material' },
    { key: 'batchNumber', label: 'Batch', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'locationName', label: 'Location' },
    { key: 'quantity', label: 'Quantity', render: (v) => <strong>{Number(v || 0).toLocaleString('en-IN')}</strong> },
    { key: 'unitSymbol', label: 'Unit', width: '70px' },
  ];

  const ledgerCols = [
    { key: 'transactionAt', label: 'When', width: '130px', render: (v) => fmtDateTime(v) },
    { key: isRaw ? 'rawMaterialName' : 'finishedProductName', label: 'Material' },
    { key: 'batchNumber', label: 'Batch', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'locationName', label: 'Location', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'transactionType', label: 'Type', width: '140px', render: (v) => <StatusPill value={v} color={v.startsWith('in') || v.endsWith('_in') || v === 'qc_approved' || v === 'production_output' ? '#16a34a' : '#f59e0b'} /> },
    { key: 'quantityIn', label: 'In', width: '80px', align: 'right', render: (v) => (Number(v) > 0 ? <strong style={{ color: '#16a34a' }}>+{v}</strong> : '—') },
    { key: 'quantityOut', label: 'Out', width: '80px', align: 'right', render: (v) => (Number(v) > 0 ? <strong style={{ color: '#DC2626' }}>-{v}</strong> : '—') },
    { key: 'remarks', label: 'Remarks', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
  ];

  const subTabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'batches', label: 'Batches' },
    { key: 'stock', label: 'By Location' },
    { key: 'ledger', label: 'Ledger' },
  ];

  return (
    <div>
      {notice && (
        <div
          style={{
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: 13,
            border: `1px solid ${notice.type === 'error' ? 'rgba(220,38,38,.2)' : 'rgba(22,163,74,.2)'}`,
            color: notice.type === 'error' ? '#DC2626' : '#16a34a',
            background: notice.type === 'error' ? 'rgba(220,38,38,.06)' : 'rgba(22,163,74,.06)',
          }}
        >
          {notice.text}
        </div>
      )}
      <TabBar tabs={subTabs} current={view} onChange={setView} />
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>{isRaw ? 'Raw Material Stock' : 'Finished Product Stock'}</h2>
          <p className={styles.pageSub}>
            {isRaw ? `${summary.length} materials tracked` : `${summary.length} products tracked`}
            {lowStock.length > 0 && ` · ${lowStock.length} low stock alert(s)`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className={styles.primaryBtn} onClick={() => { setInForm({ itemId: '', batchId: '', locationId: '', quantity: '', unitId: '' }); setInError(''); setInOpen(true); }}>+ Add Stock</button>
          <button className={styles.cancelBtn} style={{ border: '1px solid #D4AF37', color: '#D4AF37', fontWeight: 600 }} onClick={openBatch}>+ New Batch</button>
        </div>
      </div>

      {loading ? <div className={styles.loading}>Loading...</div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          {view === 'summary' && (
            <>
              {lowStock.length > 0 && (
                <div style={{ borderRadius: 10, border: '1px solid rgba(220,38,38,.25)', background: 'rgba(220,38,38,.06)', padding: '12px 16px' }}>
                  <strong style={{ fontSize: 13, color: '#DC2626' }}>Low stock alerts</strong>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {lowStock.map((l) => (
                      <span key={l.id} style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 20, padding: '4px 12px', fontSize: 12.5 }}>
                        <strong>{l.name}</strong> — {Number(l.totalStock || 0)} {l.unitSymbol} (min {l.minimumStockLevel})
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <Table columns={summaryCols} data={summary} emptyMessage="No stock summary available" />
            </>
          )}
          {view === 'batches' && <Table columns={batchCols} data={batches} emptyMessage="No batches found" />}
          {view === 'stock' && (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
                <select className={styles.filterSelect} value={filters.itemId} onChange={(e) => setFilters({ ...filters, itemId: e.target.value })}>
                  <option value="">All materials</option>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
                </select>
                <select className={styles.filterSelect} value={filters.locationId} onChange={(e) => setFilters({ ...filters, locationId: e.target.value })}>
                  <option value="">All locations</option>
                  {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
              </div>
              <Table columns={stockCols} data={stockRows} emptyMessage="No stock at locations" />
            </>
          )}
          {view === 'ledger' && <Table columns={ledgerCols} data={ledger} emptyMessage="No ledger entries" />}
        </div>
      )}

      <Modal isOpen={batchOpen} onClose={() => setBatchOpen(false)} title={isRaw ? 'New Raw Material Batch' : 'New Finished Product Batch'} width={540}>
        <form onSubmit={submitBatch} className={styles.form}>
          {batchError && <div className={styles.error}>{batchError}</div>}
          <div className={styles.formGrid}>
            <FormField
              label={isRaw ? 'Raw Material' : 'Finished Product'}
              type="select"
              value={batchForm.itemId}
              onChange={(e) => setBatchForm({ ...batchForm, itemId: e.target.value })}
              options={materials.map((m) => ({ value: String(m.id), label: `${m.name} (${m.sku})` }))}
              required
            />
            <FormField label="Batch Number" value={batchForm.batchNumber} onChange={(e) => setBatchForm({ ...batchForm, batchNumber: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label={isRaw ? 'Received Date' : 'Manufacturing Date'} type="date" value={batchForm.receivedDate} onChange={(e) => setBatchForm({ ...batchForm, receivedDate: e.target.value })} required />
            {isRaw ? (
              <FormField label="Supplier" type="select" value={batchForm.supplierId} onChange={(e) => setBatchForm({ ...batchForm, supplierId: e.target.value })} options={suppliers.map((s) => ({ value: String(s.id), label: s.companyName }))} placeholder="None" />
            ) : (
              <FormField label="Unit Cost" type="number" min="0" step="any" value={batchForm.purchasePrice} onChange={(e) => setBatchForm({ ...batchForm, purchasePrice: e.target.value })} />
            )}
          </div>
          <div className={styles.formGrid}>
            <FormField label="Original Quantity" type="number" min="0" step="any" value={batchForm.originalQuantity} onChange={(e) => setBatchForm({ ...batchForm, originalQuantity: e.target.value })} required />
            <FormField label={isRaw ? 'Purchase Price' : 'Current Quantity'} type="number" min="0" step="any" value={isRaw ? batchForm.purchasePrice : batchForm.currentQuantity} onChange={(e) => setBatchForm(isRaw ? { ...batchForm, purchasePrice: e.target.value } : { ...batchForm, currentQuantity: e.target.value })} />
          </div>
          {isRaw ? (
            <div className={styles.formGrid}>
              <FormField label="Current Quantity" type="number" min="0" step="any" value={batchForm.currentQuantity} onChange={(e) => setBatchForm({ ...batchForm, currentQuantity: e.target.value })} />
              <FormField label="QC Status" type="select" value={batchForm.qcStatus} onChange={(e) => setBatchForm({ ...batchForm, qcStatus: e.target.value })} options={QC_STATUS} required />
            </div>
          ) : (
            <div className={styles.formGrid}>
              <FormField label="Current Quantity" type="number" min="0" step="any" value={batchForm.currentQuantity} onChange={(e) => setBatchForm({ ...batchForm, currentQuantity: e.target.value })} />
              <FormField label="QC Status" type="select" value={batchForm.qcStatus} onChange={(e) => setBatchForm({ ...batchForm, qcStatus: e.target.value })} options={QC_STATUS} />
            </div>
          )}
          <FormField label="Unit" type="select" value={batchForm.unitId} onChange={(e) => setBatchForm({ ...batchForm, unitId: e.target.value })} options={units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.symbol})` }))} required />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setBatchOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={batchSubmitting}>{batchSubmitting ? 'Saving...' : 'Create Batch'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={inOpen} onClose={() => setInOpen(false)} title="Add Stock to Location" width={520}>
        <form onSubmit={submitIn} className={styles.form}>
          {inError && <div className={styles.error}>{inError}</div>}
          <FormField
            label={isRaw ? 'Raw Material' : 'Finished Product'}
            type="select"
            value={inForm.itemId}
            onChange={(e) => setInForm({ ...inForm, itemId: e.target.value })}
            options={materials.map((m) => ({ value: String(m.id), label: `${m.name} (${m.sku})` }))}
            required
          />
          <div className={styles.formGrid}>
            <FormField
              label="Batch"
              type="select"
              value={inForm.batchId}
              onChange={(e) => setInForm({ ...inForm, batchId: e.target.value })}
              options={batches.filter((b) => String(b[isRaw ? 'rawMaterialId' : 'finishedProductId']) === inForm.itemId).map((b) => ({ value: String(b.id), label: b.batchNumber }))}
              placeholder="None"
            />
            <FormField label="Location" type="select" value={inForm.locationId} onChange={(e) => setInForm({ ...inForm, locationId: e.target.value })} options={locations.map((l) => ({ value: String(l.id), label: l.name }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Quantity" type="number" min="0" step="any" value={inForm.quantity} onChange={(e) => setInForm({ ...inForm, quantity: e.target.value })} required />
            <FormField label="Unit" type="select" value={inForm.unitId} onChange={(e) => setInForm({ ...inForm, unitId: e.target.value })} options={units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.symbol})` }))} required />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setInOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn}>Add Stock</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}