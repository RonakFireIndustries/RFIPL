import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getProductionOrders, getProductionOrder, createProductionOrder,
  startProductionOrder, completeProductionOrder, cancelProductionOrder,
  addProductionConsumption, addProductionWastage, addProductionOutput,
  getBoms, getRawMaterials, getFinishedProducts, getRawBatches, getStockLocations, getInventoryUnits,
} from '@/api/inventory';
import { getDepartments } from '@/api/departments';
import { getEmployees } from '@/api/dropdowns';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Drawer from '@/components/ui/Drawer';
import FormField from '@/components/ui/FormField';
import { ItemRowsEditor, StatusPill, STATUS_COLORS, fmtDate, fmtDateTime, todayKey } from './shared';
import styles from '@/pages/ModulePage.module.css';

export default function ProductionTab() {
  return <Orders />;
}

function useProdDropdowns(accessToken) {
  const [boms, setBoms] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [rawBatches, setRawBatches] = useState([]);
  const [locations, setLocations] = useState([]);
  const [units, setUnits] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      getBoms(accessToken),
      getRawMaterials(accessToken),
      getFinishedProducts(accessToken),
      getRawBatches(accessToken),
      getStockLocations(accessToken),
      getInventoryUnits(accessToken),
      getDepartments(accessToken),
      getEmployees(accessToken),
    ])
      .then(([b, m, p, rb, l, u, d, e]) => {
        setBoms(b); setMaterials(m); setProducts(p); setRawBatches(rb); setLocations(l); setUnits(u); setDepartments(d); setEmployees(e);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [accessToken]);

  return { boms, materials, products, rawBatches, locations, units, departments, employees, ready };
}

function Orders() {
  const { accessToken } = useAuth();
  const { boms, materials, products, rawBatches, locations, units, departments, employees, ready } = useProdDropdowns(accessToken);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState(emptyCreate());
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [entryModal, setEntryModal] = useState(null);
  const [entryForm, setEntryForm] = useState({});
  const [entrySubmitting, setEntrySubmitting] = useState(false);

  function emptyCreate() {
    return { productionNumber: '', departmentId: '', bomId: '', plannedStartDate: todayKey(), plannedCompletionDate: '', createdBy: '', remarks: '' };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getProductionOrders(accessToken, { status: statusFilter || undefined })); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const refreshDetail = async (id) => {
    try {
      const d = await getProductionOrder(id, accessToken);
      setDetail(d);
    } catch (err) { alert(err.message); }
  };

  const openDetail = async (row) => {
    setDetailLoading(true);
    setDetail(row);
    await refreshDetail(row.id);
    setDetailLoading(false);
  };

  const create = async (e) => {
    e.preventDefault();
    if (!form.productionNumber || !form.createdBy) { setFormError('Production number and creator are required'); return; }
    setSubmitting(true);
    try {
      const created = await createProductionOrder({
        productionNumber: form.productionNumber,
        departmentId: form.departmentId || null,
        bomId: form.bomId || null,
        plannedStartDate: form.plannedStartDate || null,
        plannedCompletionDate: form.plannedCompletionDate || null,
        createdBy: Number(form.createdBy),
        remarks: form.remarks || null,
      }, accessToken);
      setCreateOpen(false);
      load();
      openDetail(created);
    } catch (err) { setFormError(err.message || 'Failed to create'); } finally { setSubmitting(false); }
  };

  const action = async (fn, row, label) => {
    if (!confirm(`${label} production order ${row.productionNumber}?`)) return;
    try { await fn(row.id, accessToken); load(); refreshDetail(row.id); } catch (err) { alert(err.message); }
  };

  const openCollection = (type) => {
    setEntryModal(type);
    if (type === 'consumption') setEntryForm({ rawMaterialId: '', batchId: '', locationId: '', plannedQuantity: '', consumedQuantity: '', unitId: '', consumedBy: employees[0] ? String(employees[0].id) : '', consumptionMode: 'manual', remarks: '' });
    else if (type === 'wastage') setEntryForm({ rawMaterialId: '', wastageType: 'trim', quantity: '', unitId: '', description: '', recordedBy: employees[0] ? String(employees[0].id) : '' });
    else setEntryForm({ finishedProductId: '', batchNumber: '', outputQuantity: '', unitId: products[0] ? String(products[0].unitId) : '', locationId: '', manufacturingDate: todayKey(), manualCost: '' });
  };

  const saveEntry = async (e) => {
    e.preventDefault();
    const poId = detail?.id;
    if (!poId) return;
    setEntrySubmitting(true);
    try {
      if (entryModal === 'consumption') {
        if (!entryForm.rawMaterialId || entryForm.consumedQuantity === '') { alert('Material and consumed quantity required'); return; }
        await addProductionConsumption(poId, {
          rawMaterialId: Number(entryForm.rawMaterialId),
          batchId: entryForm.batchId ? Number(entryForm.batchId) : null,
          locationId: entryForm.locationId ? Number(entryForm.locationId) : null,
          consumptionMode: 'manual',
          plannedQuantity: entryForm.plannedQuantity === '' ? null : Number(entryForm.plannedQuantity),
          consumedQuantity: Number(entryForm.consumedQuantity),
          unitId: Number(entryForm.unitId || materials.find((m) => String(m.id) === String(entryForm.rawMaterialId))?.unitId),
          consumedBy: entryForm.consumedBy ? Number(entryForm.consumedBy) : null,
          remarks: entryForm.remarks || null,
        }, accessToken);
      } else if (entryModal === 'wastage') {
        if (!entryForm.rawMaterialId || entryForm.quantity === '') { alert('Material and quantity required'); return; }
        await addProductionWastage(poId, {
          rawMaterialId: Number(entryForm.rawMaterialId),
          wastageType: entryForm.wastageType,
          quantity: Number(entryForm.quantity),
          unitId: Number(entryForm.unitId || materials.find((m) => String(m.id) === String(entryForm.rawMaterialId))?.unitId),
          description: entryForm.description || null,
          recordedBy: entryForm.recordedBy ? Number(entryForm.recordedBy) : null,
        }, accessToken);
      } else {
        if (!entryForm.finishedProductId || entryForm.outputQuantity === '') { alert('Product and output quantity required'); return; }
        await addProductionOutput(poId, {
          finishedProductId: Number(entryForm.finishedProductId),
          batchNumber: entryForm.batchNumber || null,
          outputQuantity: Number(entryForm.outputQuantity),
          unitId: Number(entryForm.unitId || products.find((p) => String(p.id) === String(entryForm.finishedProductId))?.unitId),
          locationId: entryForm.locationId ? Number(entryForm.locationId) : null,
          manufacturingDate: entryForm.manufacturingDate,
          manualCost: entryForm.manualCost === '' ? null : Number(entryForm.manualCost),
        }, accessToken);
      }
      setEntryModal(null);
      refreshDetail(poId);
    } catch (err) { alert(err.message); } finally { setEntrySubmitting(false); }
  };

  const batchOptionsFor = (matId) =>
    (rawBatches || []).filter((b) => String(b.rawMaterialId) === String(matId)).map((b) => ({ value: String(b.id), label: `${b.batchNumber} (${Number(b.currentQuantity || 0).toLocaleString('en-IN')} ${b.unitSymbol || ''})` }));

  const columns = [
    { key: 'productionNumber', label: 'Number', width: '150px' },
    { key: 'departmentName', label: 'Department', render: (v) => v || '—' },
    { key: 'bomNumber', label: 'BOM', render: (v) => v || '—' },
    { key: 'plannedStartDate', label: 'Planned Start', width: '105px', render: (v) => (v ? fmtDate(v) : '—') },
    { key: 'plannedCompletionDate', label: 'Planned End', width: '105px', render: (v) => (v ? fmtDate(v) : '—') },
    { key: 'person', label: 'Created By', render: (_, r) => `${r.firstName || ''} ${r.lastName || ''}`.trim() || '—' },
    { key: 'status', label: 'Status', width: '110px', render: (v) => <StatusPill value={v} color={STATUS_COLORS[v] || '#6b7280'} /> },
    { key: 'id', label: '', width: '250px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openDetail(row)}>View</button>
        {['draft', 'planned'].includes(row.status) && <button className={styles.editBtn} onClick={() => action(startProductionOrder, row, 'Start')}>Start</button>}
        {['planned', 'in_progress'].includes(row.status) && <button className={styles.editBtn} onClick={() => action(completeProductionOrder, row, 'Complete')}>Complete</button>}
        {!['completed', 'cancelled'].includes(row.status) && <button className={styles.deleteBtn} onClick={() => action(cancelProductionOrder, row, 'Cancel')}>Cancel</button>}
      </div>
    )},
  ];

  const materialCols = () => ({ rawMaterialId: '', batchId: '', locationId: '', plannedQuantity: '', consumedQuantity: '', unitId: '', consumedBy: employees[0] ? String(employees[0].id) : '', remarks: '' });

  const entryCols = {
    consumption: [
      { key: 'rawMaterialId', label: 'Material', type: 'select', options: materials.map((m) => ({ value: String(m.id), label: `${m.name} (${m.sku})` })) },
      { key: 'batchId', label: 'Batch', type: 'select', options: (row) => (row.rawMaterialId ? batchOptionsFor(row.rawMaterialId) : []) },
      { key: 'locationId', label: 'Location', type: 'select', options: locations.map((l) => ({ value: String(l.id), label: l.name })) },
      { key: 'consumedQuantity', label: 'Consumed Qty', type: 'number', min: '0', step: 'any' },
      { key: 'plannedQuantity', label: 'Planned Qty', type: 'number', min: '0', step: 'any' },
      { key: 'unitId', label: 'Unit', type: 'select', options: units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.symbol})` })) },
    ],
    wastage: [
      { key: 'rawMaterialId', label: 'Material', type: 'select', options: materials.map((m) => ({ value: String(m.id), label: `${m.name} (${m.sku})` })) },
      { key: 'wastageType', label: 'Type', type: 'select', options: ['trim', 'offcut', 'defective', 'spoiled', 'other'].map((t) => ({ value: t, label: t.replace(/_/g, ' ') })) },
      { key: 'quantity', label: 'Quantity', type: 'number', min: '0', step: 'any' },
      { key: 'unitId', label: 'Unit', type: 'select', options: units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.symbol})` })) },
      { key: 'description', label: 'Description', type: 'text' },
    ],
    output: [
      { key: 'finishedProductId', label: 'Product', type: 'select', options: products.map((p) => ({ value: String(p.id), label: `${p.name} (${p.sku})` })) },
      { key: 'outputQuantity', label: 'Output Qty', type: 'number', min: '0', step: 'any' },
      { key: 'unitId', label: 'Unit', type: 'select', options: units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.symbol})` })) },
      { key: 'batchNumber', label: 'Batch No.', type: 'text' },
      { key: 'locationId', label: 'Location', type: 'select', options: locations.map((l) => ({ value: String(l.id), label: l.name })) },
      { key: 'manualCost', label: 'Manual Cost', type: 'number', min: '0', step: 'any' },
    ],
  };

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Production Orders</h2>
          <p className={styles.pageSub}>{data.length} orders</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="planned">Planned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className={styles.primaryBtn} onClick={() => { setForm(emptyCreate()); setFormError(''); setCreateOpen(true); }} disabled={!ready}>+ New Order</button>
        </div>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No production orders found" onRowClick={openDetail} />
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New Production Order" width={640}>
        <form onSubmit={create} className={styles.form}>
          {formError && <div className={styles.error}>{formError}</div>}
          <div className={styles.formGrid}>
            <FormField label="Order Number" value={form.productionNumber} onChange={(e) => setForm({ ...form, productionNumber: e.target.value })} placeholder="e.g. PROD-0001" required />
            <FormField label="Created By" type="select" value={form.createdBy} onChange={(e) => setForm({ ...form, createdBy: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Department" type="select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} options={departments.map((d) => ({ value: String(d.id), label: d.name }))} placeholder="None" />
            <FormField label="Bill of Materials" type="select" value={form.bomId} onChange={(e) => setForm({ ...form, bomId: e.target.value })} options={boms.map((b) => ({ value: String(b.id), label: `${b.bomNumber} — ${b.finishedProductName || ''}` }))} placeholder="Select BOM" />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Planned Start" type="date" value={form.plannedStartDate} onChange={(e) => setForm({ ...form, plannedStartDate: e.target.value })} />
            <FormField label="Planned Completion" type="date" value={form.plannedCompletionDate} onChange={(e) => setForm({ ...form, plannedCompletionDate: e.target.value })} />
          </div>
          <FormField label="Remarks" type="textarea" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Order: ${detail.productionNumber}` : 'Production Order'} width={620}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {detailLoading ? <p className={styles.emptyText}>Loading...</p> : (
              <>
                <div className={styles.detailRow}><span>Status</span><strong><StatusPill value={detail.status} color={STATUS_COLORS[detail.status] || '#6b7280'} /></strong></div>
                <div className={styles.detailRow}><span>Department</span><strong>{detail.departmentName || '—'}</strong></div>
                <div className={styles.detailRow}><span>BOM</span><strong>{detail.bomNumber || '—'}</strong></div>
                <div className={styles.detailRow}><span>Created By</span><strong>{`${detail.firstName || ''} ${detail.lastName || ''}`.trim() || '—'}</strong></div>
                <div className={styles.detailRow}><span>Planned Start</span><strong>{fmtDate(detail.plannedStartDate)}</strong></div>
                <div className={styles.detailRow}><span>Planned Completion</span><strong>{fmtDate(detail.plannedCompletionDate)}</strong></div>
                {detail.actualStartAt && <div className={styles.detailRow}><span>Actual Start</span><strong>{fmtDateTime(detail.actualStartAt)}</strong></div>}
                {detail.actualCompletedAt && <div className={styles.detailRow}><span>Completed</span><strong>{fmtDateTime(detail.actualCompletedAt)}</strong></div>}
                {detail.remarks && <div className={styles.detailRow}><span>Remarks</span><strong>{detail.remarks}</strong></div>}

                {detail.status === 'in_progress' && (
                  <div className={styles.actions}>
                    <button className={styles.editBtn} onClick={() => openCollection('consumption')}>+ Consumption</button>
                    <button className={styles.editBtn} onClick={() => openCollection('wastage')}>+ Wastage</button>
                    <button className={styles.editBtn} onClick={() => openCollection('output')}>+ Output</button>
                  </div>
                )}

                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Consumptions</h4>
                  {!detail.consumptions?.length ? <p className={styles.emptyText}>None recorded.</p> : (
                    detail.consumptions.map((c) => (
                      <div key={c.id} className={styles.compItem}>
                        <span className={styles.compName}>{c.rawMaterialName || '—'} {c.batchNumber ? <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 12 }}>batch {c.batchNumber}</span> : null}</span>
                        <span className={styles.compAmount}>{Number(c.consumedQuantity).toLocaleString('en-IN')} {c.unitSymbol || ''}</span>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Outputs</h4>
                  {!detail.outputs?.length ? <p className={styles.emptyText}>None recorded.</p> : (
                    detail.outputs.map((o) => (
                      <div key={o.id} className={styles.compItem}>
                        <span className={styles.compName}>{o.finishedProductName || '—'} {o.batchNumber ? <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 12 }}>batch {o.batchNumber}</span> : null}</span>
                        <span className={styles.compAmount}>{Number(o.outputQuantity).toLocaleString('en-IN')} {o.unitSymbol || ''}</span>
                      </div>
                    ))
                  )}
                </div>

                <div>
                  <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Wastage</h4>
                  {!detail.wastage?.length ? <p className={styles.emptyText}>None recorded.</p> : (
                    detail.wastage.map((w) => (
                      <div key={w.id} className={styles.compItem}>
                        <span className={styles.compName}>{w.rawMaterialName || '—'} {w.wastageType ? <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 12 }}>({String(w.wastageType).replace(/_/g, ' ')})</span> : null}</span>
                        <span className={styles.compAmount}>{Number(w.quantity).toLocaleString('en-IN')} {w.unitSymbol || ''}</span>
                      </div>
                    ))
                  )}
                </div>

                {['draft', 'planned'].includes(detail.status) && (
                  <div className={styles.actions}>
                    <button className={styles.primaryBtn} onClick={() => action(startProductionOrder, detail, 'Start')}>Start Production</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Drawer>

      {entryModal && (
        <Modal isOpen onClose={() => setEntryModal(null)} title={entryModal === 'consumption' ? 'Record Material Consumption' : entryModal === 'wastage' ? 'Record Wastage' : 'Record Production Output'} width={820}>
          <form onSubmit={saveEntry}>
            <ItemRowsEditor
              columns={entryCols[entryModal]}
              rows={[entryForm]}
              onChange={(rows) => setEntryForm(rows[0] || {})}
              newRow={() => materialCols()}
              addLabel="+ Add Row"
            />
            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setEntryModal(null)}>Cancel</button>
              <button type="submit" className={styles.primaryBtn} disabled={entrySubmitting || !detail}>{entrySubmitting ? 'Saving...' : 'Save'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}