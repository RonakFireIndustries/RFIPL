import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getStockTransfers, getStockTransfer, createStockTransfer, cancelStockTransfer,
  getStockAdjustments, getStockAdjustment, createStockAdjustment,
  approveStockAdjustment, rejectStockAdjustment, applyStockAdjustment,
  getDamageLossReports, getDamageLossReport, createDamageLossReport,
  approveDamageLossReport, rejectDamageLossReport, applyDamageLossReport,
  getRawMaterials, getFinishedProducts, getTools, getMachines,
  getStockLocations, getInventoryUnits,
} from '@/api/inventory';
import { getDepartments } from '@/api/departments';
import { getEmployees } from '@/api/dropdowns';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Drawer from '@/components/ui/Drawer';
import FormField from '@/components/ui/FormField';
import { TabBar, ItemRowsEditor, StatusPill, STATUS_COLORS, fmtDate, todayKey, invTypeLabel } from './shared';
import styles from '@/pages/ModulePage.module.css';

const INV_TYPES = ['raw_material', 'finished_product', 'tool', 'machine'];

export default function MovementsTab() {
  const { accessToken } = useAuth();
  const [section, setSection] = useState('transfers');

  return (
    <div>
      <TabBar
        tabs={[
          { key: 'transfers', label: 'Stock Transfers' },
          { key: 'adjustments', label: 'Stock Adjustments' },
          { key: 'damage', label: 'Damage & Loss' },
        ]}
        current={section}
        onChange={setSection}
      />
      {section === 'transfers' && <Transfers accessToken={accessToken} />}
      {section === 'adjustments' && <Adjustments accessToken={accessToken} />}
      {section === 'damage' && <DamageLoss accessToken={accessToken} />}
    </div>
  );
}

export function TransfersSection() {
  const { accessToken } = useAuth();
  return <Transfers accessToken={accessToken} />;
}

export function AdjustmentsSection() {
  const { accessToken } = useAuth();
  return <Adjustments accessToken={accessToken} />;
}

export function DamageLossSection() {
  const { accessToken } = useAuth();
  return <DamageLoss accessToken={accessToken} />;
}

function useMoveDropdowns(accessToken) {
  const [materials, setMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [tools, setTools] = useState([]);
  const [machines, setMachines] = useState([]);
  const [locations, setLocations] = useState([]);
  const [units, setUnits] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      getRawMaterials(accessToken),
      getFinishedProducts(accessToken),
      getTools(accessToken),
      getMachines(accessToken),
      getStockLocations(accessToken),
      getInventoryUnits(accessToken),
      getDepartments(accessToken),
      getEmployees(accessToken),
    ])
      .then(([m, p, t, mc, l, u, d, e]) => {
        setMaterials(m); setProducts(p); setTools(t); setMachines(mc); setLocations(l); setUnits(u); setDepartments(d); setEmployees(e);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [accessToken]);

  return { materials, products, tools, machines, locations, units, departments, employees, ready };
}

function itemOptions({ materials, products }) {
  const raw = materials.map((m) => ({ value: `raw_material:${m.id}`, label: `[Raw] ${m.name} (${m.sku})`, type: 'raw_material', id: m.id, unitId: m.unitId }));
  const fin = products.map((p) => ({ value: `finished_product:${p.id}`, label: `[Finished] ${p.name} (${p.sku})`, type: 'finished_product', id: p.id, unitId: p.unitId }));
  return [...raw, ...fin];
}

function damageItemOptions({ materials, products, tools, machines }) {
  const opts = itemOptions({ materials, products });
  const tls = tools.map((t) => ({ value: `tool:${t.id}`, label: `[Tool] ${t.name} (${t.toolCode})`, type: 'tool', id: t.id, unitId: t.unitId }));
  const mcs = machines.map((m) => ({ value: `machine:${m.id}`, label: `[Machine] ${m.machineName || m.machineCode}`, type: 'machine', id: m.id, unitId: null }));
  return [...opts, ...tls, ...mcs];
}

function splitKey(key) {
  const [itemType, itemId] = String(key || '').split(':');
  return { itemType, itemId };
}

function Transfers({ accessToken }) {
  const { materials, products, locations, units, employees, ready } = useMoveDropdowns(accessToken);
  const allItems = itemOptions({ materials, products });

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);

  function emptyForm() {
    return { transferNumber: '', inventoryType: 'raw_material', fromLocationId: '', toLocationId: '', transferDate: todayKey(), transferredBy: '', remarks: '', items: [] };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getStockTransfers(accessToken, { inventoryType: typeFilter || undefined })); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm()); setError(''); setModalOpen(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.transferNumber || !form.fromLocationId || !form.toLocationId || !form.transferredBy) { setError('Number, locations and person are required'); return; }
    if (form.fromLocationId === form.toLocationId) { setError('Source and destination must differ'); return; }
    if (!form.items.length) { setError('Add at least one item'); return; }
    setSubmitting(true);
    try {
      await createStockTransfer({
        transferNumber: form.transferNumber,
        inventoryType: form.inventoryType,
        fromLocationId: Number(form.fromLocationId),
        toLocationId: Number(form.toLocationId),
        transferDate: form.transferDate,
        transferredBy: Number(form.transferredBy),
        remarks: form.remarks || null,
        items: form.items.map((it) => {
          const { itemType, itemId } = splitKey(it.itemKey);
          return { itemType, itemId: Number(itemId), batchNumber: it.batchNumber || null, quantity: Number(it.quantity || 0), unitId: Number(it.unitId) };
        }),
      }, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to create'); } finally { setSubmitting(false); }
  };

  const openDetail = async (row) => {
    try { setDetail(await getStockTransfer(row.id, accessToken)); } catch (err) { alert(err.message); }
  };

  const handleCancel = async (row) => {
    if (!confirm(`Cancel transfer ${row.transferNumber}?`)) return;
    try { await cancelStockTransfer(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const itemCols = [
    { key: 'itemKey', label: 'Item', type: 'select', options: allItems },
    { key: 'batchNumber', label: 'Batch', type: 'text' },
    { key: 'quantity', label: 'Qty', type: 'number', min: '0', step: 'any' },
    { key: 'unitId', label: 'Unit', type: 'select', options: units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.symbol})` })) },
  ];

  const columns = [
    { key: 'transferNumber', label: 'Number', width: '140px' },
    { key: 'inventoryType', label: 'Type', width: '120px', render: (v) => <StatusPill value={invTypeLabel(v)} color={v === 'finished_product' ? '#8b5cf6' : '#3b82f6'} capitalize={false} /> },
    { key: 'fromLocationName', label: 'From' },
    { key: 'toLocationName', label: 'To' },
    { key: 'transferDate', label: 'Date', width: '95px', render: (v) => fmtDate(v) },
    { key: 'person', label: 'Transferred By', render: (_, r) => `${r.firstName || ''} ${r.lastName || ''}`.trim() || '—' },
    { key: 'status', label: 'Status', width: '110px', render: (v) => <StatusPill value={v} color={STATUS_COLORS[v] || '#6b7280'} /> },
    { key: 'id', label: '', width: '140px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openDetail(row)}>View</button>
        {row.status === 'completed' && <button className={styles.deleteBtn} onClick={() => handleCancel(row)}>Cancel</button>}
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Stock Transfers</h2>
          <p className={styles.pageSub}>{data.length} transfers</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className={styles.filterSelect} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All types</option>
            <option value="raw_material">Raw Material</option>
            <option value="finished_product">Finished Product</option>
          </select>
          <button className={styles.primaryBtn} onClick={openCreate} disabled={!ready}>+ New Transfer</button>
        </div>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No stock transfers found" onRowClick={openDetail} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Stock Transfer" width={760}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Transfer Number" value={form.transferNumber} onChange={(e) => setForm({ ...form, transferNumber: e.target.value })} placeholder="e.g. TR-0001" required />
            <FormField label="Type" type="select" value={form.inventoryType} onChange={(e) => setForm({ ...form, inventoryType: e.target.value })} options={INV_TYPES.map((t) => ({ value: t, label: invTypeLabel(t) }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="From Location" type="select" value={form.fromLocationId} onChange={(e) => setForm({ ...form, fromLocationId: e.target.value })} options={locations.map((l) => ({ value: String(l.id), label: l.name }))} required />
            <FormField label="To Location" type="select" value={form.toLocationId} onChange={(e) => setForm({ ...form, toLocationId: e.target.value })} options={locations.map((l) => ({ value: String(l.id), label: l.name }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Transfer Date" type="date" value={form.transferDate} onChange={(e) => setForm({ ...form, transferDate: e.target.value })} required />
            <FormField label="Transferred By" type="select" value={form.transferredBy} onChange={(e) => setForm({ ...form, transferredBy: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} required />
          </div>
          <FormField label="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          <div>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 6 }}>Items</label>
            <ItemRowsEditor
              columns={itemCols}
              rows={form.items}
              onChange={(items) => setForm({ ...form, items })}
              newRow={() => ({ itemKey: '', batchNumber: '', quantity: '', unitId: '' })}
              addLabel="+ Add Item"
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Transfer: ${detail.transferNumber}` : 'Stock Transfer'} width={520}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className={styles.detailRow}><span>Status</span><strong><StatusPill value={detail.status} color={STATUS_COLORS[detail.status] || '#6b7280'} /></strong></div>
            <div className={styles.detailRow}><span>Type</span><strong>{invTypeLabel(detail.inventoryType)}</strong></div>
            <div className={styles.detailRow}><span>From</span><strong>{detail.fromLocationName || '—'}</strong></div>
            <div className={styles.detailRow}><span>To</span><strong>{detail.toLocationName || '—'}</strong></div>
            <div className={styles.detailRow}><span>Date</span><strong>{fmtDate(detail.transferDate)}</strong></div>
            <div className={styles.detailRow}><span>By</span><strong>{`${detail.firstName || ''} ${detail.lastName || ''}`.trim() || '—'}</strong></div>
            {detail.remarks && <div className={styles.detailRow}><span>Remarks</span><strong>{detail.remarks}</strong></div>}
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Items</h4>
              {!detail.items?.length ? <p className={styles.emptyText}>No items.</p> : (
                detail.items.map((it, i) => (
                  <div key={i} className={styles.compItem}>
                    <span className={styles.compName}>{invTypeLabel(it.itemType)} #{it.itemId} {it.batchNumber ? <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: 12 }}>batch {it.batchNumber}</span> : null}</span>
                    <span className={styles.compAmount}>{Number(it.quantity).toLocaleString('en-IN')}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Adjustments({ accessToken }) {
  const { materials, products, locations, units, employees, ready } = useMoveDropdowns(accessToken);
  const allItems = itemOptions({ materials, products });

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionType, setActionType] = useState('approve');
  const [remarks, setRemarks] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  function emptyForm() {
    return { adjustmentNumber: '', inventoryType: 'raw_material', requestedBy: '', reason: '', description: '', items: [] };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getStockAdjustments(accessToken, { status: statusFilter || undefined })); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm()); setError(''); setModalOpen(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.adjustmentNumber || !form.requestedBy || !form.reason) { setError('Number, requester and reason are required'); return; }
    if (!form.items.length) { setError('Add at least one item'); return; }
    setSubmitting(true);
    try {
      await createStockAdjustment({
        adjustmentNumber: form.adjustmentNumber,
        inventoryType: form.inventoryType,
        requestedBy: Number(form.requestedBy),
        reason: form.reason,
        description: form.description || null,
        items: form.items.map((it) => {
          const { itemType, itemId } = splitKey(it.itemKey);
          return {
            itemType,
            itemId: Number(itemId),
            batchNumber: it.batchNumber || null,
            locationId: it.locationId ? Number(it.locationId) : null,
            systemQuantity: Number(it.systemQuantity || 0),
            physicalQuantity: Number(it.physicalQuantity || 0),
            unitId: Number(it.unitId),
          };
        }),
      }, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to create'); } finally { setSubmitting(false); }
  };

  const openDetail = async (row) => {
    try { setDetail(await getStockAdjustment(row.id, accessToken)); } catch (err) { alert(err.message); }
  };

  const doAction = async () => {
    if (!actionTarget) return;
    setActionSubmitting(true);
    try {
      const body = { approvedBy: Number(employees[0].id), approvalRemarks: remarks || undefined };
      if (actionType === 'approve') await approveStockAdjustment(actionTarget.id, body, accessToken);
      else if (actionType === 'reject') await rejectStockAdjustment(actionTarget.id, body, accessToken);
      else await applyStockAdjustment(actionTarget.id, accessToken);
      setActionTarget(null);
      load();
      if (detail?.id === actionTarget.id) openDetail(actionTarget);
    } catch (err) { alert(err.message); } finally { setActionSubmitting(false); }
  };

  const itemCols = [
    { key: 'itemKey', label: 'Item', type: 'select', options: allItems },
    { key: 'batchNumber', label: 'Batch', type: 'text' },
    { key: 'locationId', label: 'Location', type: 'select', options: locations.map((l) => ({ value: String(l.id), label: l.name })) },
    { key: 'systemQuantity', label: 'System Qty', type: 'number', min: '0', step: 'any' },
    { key: 'physicalQuantity', label: 'Physical Qty', type: 'number', min: '0', step: 'any' },
    { key: 'unitId', label: 'Unit', type: 'select', options: units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.symbol})` })) },
  ];

  const columns = [
    { key: 'adjustmentNumber', label: 'Number', width: '140px' },
    { key: 'inventoryType', label: 'Type', width: '120px', render: (v) => <StatusPill value={invTypeLabel(v)} color={v === 'finished_product' ? '#8b5cf6' : '#3b82f6'} capitalize={false} /> },
    { key: 'reason', label: 'Reason' },
    { key: 'person', label: 'Requested By', render: (_, r) => `${r.firstName || ''} ${r.lastName || ''}`.trim() || '—' },
    { key: 'status', label: 'Status', width: '110px', render: (v) => <StatusPill value={v} color={STATUS_COLORS[v] || '#6b7280'} /> },
    { key: 'id', label: '', width: '230px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openDetail(row)}>View</button>
        {row.status === 'pending' && (
          <>
            <button className={styles.editBtn} style={{ borderColor: '#16a34a', color: '#16a34a' }} onClick={() => { setActionTarget(row); setActionType('approve'); setRemarks(''); }}>Approve</button>
            <button className={styles.deleteBtn} onClick={() => { setActionTarget(row); setActionType('reject'); setRemarks(''); }}>Reject</button>
          </>
        )}
        {row.status === 'approved' && <button className={styles.editBtn} onClick={() => { setActionTarget(row); setActionType('apply'); setRemarks(''); }}>Apply</button>}
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Stock Adjustments</h2>
          <p className={styles.pageSub}>{data.length} adjustments</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="applied">Applied</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className={styles.primaryBtn} onClick={openCreate} disabled={!ready}>+ New Adjustment</button>
        </div>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No stock adjustments found" onRowClick={openDetail} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Stock Adjustment" width={780}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Adjustment Number" value={form.adjustmentNumber} onChange={(e) => setForm({ ...form, adjustmentNumber: e.target.value })} placeholder="e.g. ADJ-0001" required />
            <FormField label="Type" type="select" value={form.inventoryType} onChange={(e) => setForm({ ...form, inventoryType: e.target.value })} options={INV_TYPES.map((t) => ({ value: t, label: invTypeLabel(t) }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Requested By" type="select" value={form.requestedBy} onChange={(e) => setForm({ ...form, requestedBy: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} required />
            <FormField label="Reason" type="select" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} options={['physical count', 'correction', 'damage', 'return', 'other'].map((r) => ({ value: r, label: r.replace(/_/g, ' ') }))} required />
          </div>
          <FormField label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 6 }}>Items</label>
            <ItemRowsEditor
              columns={itemCols}
              rows={form.items}
              onChange={(items) => setForm({ ...form, items })}
              newRow={() => ({ itemKey: '', batchNumber: '', locationId: '', systemQuantity: '', physicalQuantity: '', unitId: '' })}
              addLabel="+ Add Item"
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Adjustment: ${detail.adjustmentNumber}` : 'Stock Adjustment'} width={540}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className={styles.detailRow}><span>Status</span><strong><StatusPill value={detail.status} color={STATUS_COLORS[detail.status] || '#6b7280'} /></strong></div>
            <div className={styles.detailRow}><span>Type</span><strong>{invTypeLabel(detail.inventoryType)}</strong></div>
            <div className={styles.detailRow}><span>Reason</span><strong>{detail.reason}</strong></div>
            <div className={styles.detailRow}><span>Requested By</span><strong>{`${detail.firstName || ''} ${detail.lastName || ''}`.trim() || '—'}</strong></div>
            {detail.approvalRemarks && <div className={styles.detailRow}><span>Approval Remarks</span><strong>{detail.approvalRemarks}</strong></div>}
            {detail.description && <div className={styles.detailRow}><span>Description</span><strong>{detail.description}</strong></div>}
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Items</h4>
              {!detail.items?.length ? <p className={styles.emptyText}>No items.</p> : (
                detail.items.map((it, i) => (
                  <div key={i} className={styles.compItem}>
                    <span className={styles.compName}>
                      {invTypeLabel(it.itemType)} #{it.itemId}
                      <span style={{ color: '#6b7280', fontWeight: 500, fontSize: 12 }}>
                        {it.systemQuantity} → {it.physicalQuantity} {it.unitSymbol || ''}
                      </span>
                    </span>
                    <span className={styles.compAmount} style={{ color: Number(it.adjustmentQuantity) >= 0 ? '#16a34a' : '#DC2626' }}>
                      {Number(it.adjustmentQuantity) >= 0 ? '+' : ''}{Number(it.adjustmentQuantity).toLocaleString('en-IN')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Drawer>

      {actionTarget && (
        <Modal isOpen onClose={() => setActionTarget(null)} title={actionType === 'apply' ? 'Apply Adjustment' : actionType === 'approve' ? 'Approve Adjustment' : 'Reject Adjustment'} width={440}>
          <div className={styles.form}>
            {actionType === 'apply' && <div style={{ fontSize: 13, color: '#6b7280' }}>Applying updates stock quantities immediately.</div>}
            {actionType !== 'apply' && <FormField label="Remarks" type="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Approval remarks (optional)" />}
            <div className={styles.formActions}>
              <button className={styles.cancelBtn} onClick={() => setActionTarget(null)}>Cancel</button>
              <button className={actionType === 'reject' ? styles.deleteBtn : styles.primaryBtn} disabled={actionSubmitting} onClick={doAction}>
                {actionSubmitting ? 'Submitting...' : actionType === 'apply' ? 'Apply' : actionType === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function DamageLoss({ accessToken }) {
  const { materials, products, tools, machines, locations, employees, ready } = useMoveDropdowns(accessToken);
  const allItems = damageItemOptions({ materials, products, tools, machines });

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionType, setActionType] = useState('approve');
  const [remarks, setRemarks] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  function emptyForm() {
    return { reportNumber: '', inventoryType: 'raw_material', itemKey: '', locationId: '', reportType: 'damage', quantity: '', incidentDate: todayKey(), description: '', reportedBy: '', responsibleEmployeeId: '' };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getDamageLossReports(accessToken, { status: statusFilter || undefined })); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm()); setError(''); setModalOpen(true); };

  const labelFor = (r) => {
    const { itemType, itemId } = { itemType: r.inventoryType, itemId: r.itemId };
    const pools = { uncategorized: materials, raw_material: materials, finished_product: products, tool: tools, machine: machines };
    const pool = pools[itemType] || materials;
    const found = pool.find((i) => String(i.id) === String(itemId));
    return found ? (found.name || found.machineName) : `#${r.itemId}`;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.reportNumber || !form.itemKey || !form.reportedBy || form.quantity === '') { setError('Number, item, reporter and quantity are required'); return; }
    const { itemType, itemId } = splitKey(form.itemKey);
    setSubmitting(true);
    try {
      await createDamageLossReport({
        reportNumber: form.reportNumber,
        inventoryType: itemType,
        itemId: Number(itemId),
        locationId: form.locationId ? Number(form.locationId) : null,
        reportType: form.reportType,
        quantity: Number(form.quantity),
        incidentDate: form.incidentDate,
        description: form.description || null,
        reportedBy: Number(form.reportedBy),
        responsibleEmployeeId: form.responsibleEmployeeId ? Number(form.responsibleEmployeeId) : null,
      }, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to create'); } finally { setSubmitting(false); }
  };

  const openDetail = async (row) => {
    try { setDetail(await getDamageLossReport(row.id, accessToken)); } catch (err) { alert(err.message); }
  };

  const doAction = async () => {
    if (!actionTarget) return;
    setActionSubmitting(true);
    try {
      const body = { approvedBy: Number(employees[0].id), approvalRemarks: remarks || undefined };
      if (actionType === 'approve') await approveDamageLossReport(actionTarget.id, body, accessToken);
      else if (actionType === 'reject') await rejectDamageLossReport(actionTarget.id, body, accessToken);
      else await applyDamageLossReport(actionTarget.id, accessToken);
      setActionTarget(null);
      load();
      if (detail?.id === actionTarget.id) openDetail(actionTarget);
    } catch (err) { alert(err.message); } finally { setActionSubmitting(false); }
  };

  const columns = [
    { key: 'reportNumber', label: 'Number', width: '130px' },
    { key: 'item', label: 'Item', render: (_, r) => labelFor(r) },
    { key: 'inventoryType', label: 'Type', width: '120px', render: (v) => <StatusPill value={invTypeLabel(v)} color={v === 'finished_product' ? '#8b5cf6' : '#3b82f6'} capitalize={false} /> },
    { key: 'reportType', label: 'Type', width: '90px', render: (v) => <StatusPill value={v} color={v === 'damage' ? '#DC2626' : '#f59e0b'} /> },
    { key: 'quantity', label: 'Qty', width: '90px', render: (v) => <strong>{Number(v || 0).toLocaleString('en-IN')}</strong> },
    { key: 'incidentDate', label: 'Date', width: '95px', render: (v) => fmtDate(v) },
    { key: 'reportedByName', label: 'Reported By', render: (v) => v || '—' },
    { key: 'status', label: 'Status', width: '110px', render: (v) => <StatusPill value={v} color={STATUS_COLORS[v] || '#6b7280'} /> },
    { key: 'id', label: '', width: '230px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openDetail(row)}>View</button>
        {row.status === 'pending' && (
          <>
            <button className={styles.editBtn} style={{ borderColor: '#16a34a', color: '#16a34a' }} onClick={() => { setActionTarget(row); setActionType('approve'); setRemarks(''); }}>Approve</button>
            <button className={styles.deleteBtn} onClick={() => { setActionTarget(row); setActionType('reject'); setRemarks(''); }}>Reject</button>
          </>
        )}
        {row.status === 'approved' && <button className={styles.editBtn} onClick={() => { setActionTarget(row); setActionType('apply'); setRemarks(''); }}>Apply</button>}
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Damage & Loss Reports</h2>
          <p className={styles.pageSub}>{data.length} reports</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="applied">Applied</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className={styles.primaryBtn} onClick={openCreate} disabled={!ready}>+ New Report</button>
        </div>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No damage/loss reports found" onRowClick={openDetail} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Damage / Loss Report" width={640}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Report Number" value={form.reportNumber} onChange={(e) => setForm({ ...form, reportNumber: e.target.value })} placeholder="e.g. DL-0001" required />
            <FormField label="Report Type" type="select" value={form.reportType} onChange={(e) => setForm({ ...form, reportType: e.target.value })} options={[{ value: 'damage', label: 'Damage' }, { value: 'loss', label: 'Loss' }]} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Item" type="select" value={form.itemKey} onChange={(e) => setForm({ ...form, itemKey: e.target.value })} options={allItems} required />
            <FormField label="Quantity" type="number" min="0" step="any" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} placeholder="Units lost/damaged" required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Location" type="select" value={form.locationId} onChange={(e) => setForm({ ...form, locationId: e.target.value })} options={locations.map((l) => ({ value: String(l.id), label: l.name }))} placeholder="None" />
            <FormField label="Incident Date" type="date" value={form.incidentDate} onChange={(e) => setForm({ ...form, incidentDate: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Reported By" type="select" value={form.reportedBy} onChange={(e) => setForm({ ...form, reportedBy: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} required />
            <FormField label="Responsible Employee" type="select" value={form.responsibleEmployeeId} onChange={(e) => setForm({ ...form, responsibleEmployeeId: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} placeholder="If accountable" />
          </div>
          <FormField label="Description" type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `Report: ${detail.reportNumber}` : 'Damage / Loss Report'} width={520}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className={styles.detailRow}><span>Status</span><strong><StatusPill value={detail.status} color={STATUS_COLORS[detail.status] || '#6b7280'} /></strong></div>
            <div className={styles.detailRow}><span>Type</span><strong>{invTypeLabel(detail.inventoryType)} {detail.reportType}</strong></div>
            <div className={styles.detailRow}><span>Item</span><strong>{labelFor(detail)}</strong></div>
            <div className={styles.detailRow}><span>Quantity</span><strong>{Number(detail.quantity || 0).toLocaleString('en-IN')}</strong></div>
            <div className={styles.detailRow}><span>Location</span><strong>{detail.locationName || '—'}</strong></div>
            <div className={styles.detailRow}><span>Incident Date</span><strong>{fmtDate(detail.incidentDate)}</strong></div>
            <div className={styles.detailRow}><span>Reported By</span><strong>{detail.reportedByName || '—'}</strong></div>
            {detail.description && <div className={styles.detailRow}><span>Description</span><strong>{detail.description}</strong></div>}
            {detail.approvalRemarks && <div className={styles.detailRow}><span>Approval Remarks</span><strong>{detail.approvalRemarks}</strong></div>}
          </div>
        )}
      </Drawer>

      {actionTarget && (
        <Modal isOpen onClose={() => setActionTarget(null)} title={actionType === 'apply' ? 'Apply Report' : actionType === 'approve' ? 'Approve Report' : 'Reject Report'} width={440}>
          <div className={styles.form}>
            {actionType === 'apply' && <div style={{ fontSize: 13, color: '#6b7280' }}>Applying reduces stock by the reported quantity.</div>}
            {actionType !== 'apply' && <FormField label="Remarks" type="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Approval remarks (optional)" />}
            <div className={styles.formActions}>
              <button className={styles.cancelBtn} onClick={() => setActionTarget(null)}>Cancel</button>
              <button className={actionType === 'reject' ? styles.deleteBtn : styles.primaryBtn} disabled={actionSubmitting} onClick={doAction}>
                {actionSubmitting ? 'Submitting...' : actionType === 'apply' ? 'Apply' : actionType === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}