import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getPurchaseRequests, getPurchaseRequest, createPurchaseRequest,
  submitPurchaseRequest, approvePurchaseRequest, rejectPurchaseRequest, deletePurchaseRequest,
  getPurchaseOrders, getPurchaseOrder,
  getGoodsReceipts, getGoodsReceipt, createGoodsReceipt, cancelGoodsReceipt,
  getQualityInspections, createQualityInspection,
  getRawMaterials, getStockLocations, getSuppliers, getInventoryUnits,
} from '@/api/inventory';
import { getDepartments } from '@/api/departments';
import { getEmployees } from '@/api/dropdowns';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Drawer from '@/components/ui/Drawer';
import FormField from '@/components/ui/FormField';
import { TabBar, ItemRowsEditor, StatusPill, STATUS_COLORS, fmtDate, fmtDateTime, money, todayKey } from './shared';
import styles from '@/pages/ModulePage.module.css';

export default function PurchasingTab() {
  const { accessToken } = useAuth();
  const [section, setSection] = useState('requests');

  return (
    <div>
      <TabBar
        tabs={[
          { key: 'requests', label: 'Purchase Requests' },
          { key: 'receipts', label: 'Goods Receipts' },
          { key: 'qc', label: 'Quality Inspections' },
        ]}
        current={section}
        onChange={setSection}
      />
      {section === 'requests' && <Requests accessToken={accessToken} />}
      {section === 'receipts' && <Receipts accessToken={accessToken} />}
      {section === 'qc' && <Inspections accessToken={accessToken} />}
    </div>
  );
}

function useDropdowns(accessToken) {
  const [materials, setMaterials] = useState([]);
  const [locations, setLocations] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [units, setUnits] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      getRawMaterials(accessToken),
      getStockLocations(accessToken),
      getSuppliers(accessToken),
      getInventoryUnits(accessToken),
      getDepartments(accessToken),
      getEmployees(accessToken),
    ])
      .then(([m, l, s, u, d, e]) => {
        setMaterials(m); setLocations(l); setSuppliers(s); setUnits(u); setDepartments(d); setEmployees(e);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [accessToken]);

  return { materials, locations, suppliers, units, departments, employees, ready };
}

function Requests({ accessToken }) {
  const { materials, departments, employees, units, ready } = useDropdowns(accessToken);

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
    return { requestNumber: '', departmentId: '', requestedBy: '', requestDate: todayKey(), requiredDate: '', purpose: '', items: [] };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getPurchaseRequests(accessToken, { status: statusFilter || undefined })); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setForm(emptyForm()); setError(''); setModalOpen(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.requestNumber || !form.requestedBy || !form.requestDate) { setError('Request number, requester and date are required'); return; }
    if (!form.items.length) { setError('Add at least one item'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        departmentId: form.departmentId || null,
        requestedBy: Number(form.requestedBy),
        requiredDate: form.requiredDate || null,
        items: form.items.map((it) => ({ rawMaterialId: Number(it.rawMaterialId), quantity: Number(it.quantity || 0), unitId: Number(it.unitId), remarks: it.remarks || null })),
      };
      await createPurchaseRequest(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to create'); } finally { setSubmitting(false); }
  };

  const doAction = async () => {
    if (!actionTarget) return;
    setActionSubmitting(true);
    try {
      if (actionType === 'approve') await approvePurchaseRequest(actionTarget.id, { managerApprovedBy: Number(employees[0].id), managerRemarks: remarks || undefined }, accessToken);
      else if (actionType === 'reject') await rejectPurchaseRequest(actionTarget.id, { managerRemarks: remarks || undefined }, accessToken);
      setActionTarget(null);
      load();
    } catch (err) { alert(err.message); } finally { setActionSubmitting(false); }
  };

  const openDetail = async (row) => {
    try { setDetail(await getPurchaseRequest(row.id, accessToken)); } catch (err) { alert(err.message); }
  };

  const handleSubmitForApproval = async (row) => {
    try { await submitPurchaseRequest(row.id, accessToken); load(); openDetail(await getPurchaseRequest(row.id, accessToken)); } catch (err) { alert(err.message); }
  };

  const handleDelete = async (row) => {
    if (!confirm('Delete this purchase request?')) return;
    try { await deletePurchaseRequest(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const itemCols = [
    { key: 'rawMaterialId', label: 'Material', type: 'select', options: materials.map((m) => ({ value: String(m.id), label: `${m.name} (${m.sku})` })) },
    { key: 'quantity', label: 'Qty', type: 'number', min: '0', step: 'any' },
    { key: 'unitId', label: 'Unit', type: 'select', options: units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.symbol})` })) },
    { key: 'remarks', label: 'Remarks', type: 'text' },
  ];

  const columns = [
    { key: 'requestNumber', label: 'Number', width: '130px' },
    { key: 'requestDate', label: 'Date', width: '90px', render: (v) => fmtDate(v) },
    { key: 'departmentName', label: 'Department', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'requestedBy', label: 'Requested By', render: (_, r) => `${r.firstName || ''} ${r.lastName || ''}`.trim() || '—' },
    { key: 'requiredDate', label: 'Required', width: '90px', render: (v) => (v ? fmtDate(v) : <span style={{ color: '#cbd5e1' }}>—</span>) },
    { key: 'status', label: 'Status', width: '130px', render: (v) => <StatusPill value={v} color={STATUS_COLORS[v] || '#6b7280'} /> },
    { key: 'id', label: '', width: '210px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openDetail(row)}>View</button>
        {row.status === 'draft' && <button className={styles.editBtn} onClick={() => handleSubmitForApproval(row)}>Submit</button>}
        {row.status === 'pending_manager' && (
          <>
            <button className={styles.editBtn} style={{ borderColor: '#16a34a', color: '#16a34a' }} onClick={() => { setActionTarget(row); setActionType('approve'); setRemarks(''); }}>Approve</button>
            <button className={styles.deleteBtn} onClick={() => { setActionTarget(row); setActionType('reject'); setRemarks(''); }}>Reject</button>
          </>
        )}
        {(row.status === 'draft' || row.status === 'pending_manager') && <button className={styles.deleteBtn} onClick={() => handleDelete(row)}>Del</button>}
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Purchase Requests</h2>
          <p className={styles.pageSub}>{data.length} requests</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="pending_manager">Pending Approval</option>
            <option value="manager_approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
          <button className={styles.primaryBtn} onClick={openCreate} disabled={!ready}>+ New Request</button>
        </div>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No purchase requests found" onRowClick={openDetail} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Purchase Request" width={760}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="Request Number" value={form.requestNumber} onChange={(e) => setForm({ ...form, requestNumber: e.target.value })} placeholder="e.g. PR-0001" required />
            <FormField label="Request Date" type="date" value={form.requestDate} onChange={(e) => setForm({ ...form, requestDate: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Department" type="select" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} options={departments.map((d) => ({ value: String(d.id), label: d.name }))} placeholder="None" />
            <FormField label="Requested By" type="select" value={form.requestedBy} onChange={(e) => setForm({ ...form, requestedBy: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Required By" type="date" value={form.requiredDate} onChange={(e) => setForm({ ...form, requiredDate: e.target.value })} />
            <FormField label="Purpose" value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Reason for purchase" />
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 6 }}>Items</label>
            <ItemRowsEditor
              columns={itemCols}
              rows={form.items}
              onChange={(items) => setForm({ ...form, items })}
              newRow={() => ({ rawMaterialId: '', quantity: '', unitId: '', remarks: '' })}
              addLabel="+ Add Item"
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `PR: ${detail.requestNumber}` : 'Purchase Request'} width={540}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className={styles.detailRow}><span>Status</span><strong><StatusPill value={detail.status} color={STATUS_COLORS[detail.status] || '#6b7280'} /></strong></div>
            <div className={styles.detailRow}><span>Department</span><strong>{detail.departmentName || '—'}</strong></div>
            <div className={styles.detailRow}><span>Requested By</span><strong>{`${detail.firstName || ''} ${detail.lastName || ''}`.trim() || '—'}</strong></div>
            <div className={styles.detailRow}><span>Request Date</span><strong>{fmtDate(detail.requestDate)}</strong></div>
            {detail.requiredDate && <div className={styles.detailRow}><span>Required By</span><strong>{fmtDate(detail.requiredDate)}</strong></div>}
            {detail.purpose && <div className={styles.detailRow}><span>Purpose</span><strong>{detail.purpose}</strong></div>}
            {detail.managerRemarks && <div className={styles.detailRow}><span>Manager Remarks</span><strong>{detail.managerRemarks}</strong></div>}
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Items</h4>
              {!detail.items?.length ? <p className={styles.emptyText}>No items.</p> : (
                <div style={{ borderTop: '1px solid #e5e7eb' }}>
                  {detail.items.map((it) => (
                    <div key={it.id} className={styles.compItem}>
                      <span className={styles.compName}>{it.rawMaterialName || '—'} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({it.sku || ''})</span></span>
                      <span className={styles.compAmount}>{it.quantity} {it.unitSymbol || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {detail.status === 'draft' && (
              <div className={styles.actions}>
                <button className={styles.primaryBtn} onClick={() => handleSubmitForApproval(detail)}>Submit for Approval</button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {actionTarget && (
        <Modal isOpen onClose={() => setActionTarget(null)} title={`${actionType === 'approve' ? 'Approve' : 'Reject'} Purchase Request`} width={440}>
          <div className={styles.form}>
            {actionType === 'reject' && <div style={{ fontSize: 13, color: '#6b7280' }}>You are rejecting {actionTarget.requestNumber}. This cannot be undone.</div>}
            <FormField label="Remarks" type="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Review remarks (optional)" />
            <div className={styles.formActions}>
              <button className={styles.cancelBtn} onClick={() => setActionTarget(null)}>Cancel</button>
              <button className={actionType === 'approve' ? styles.primaryBtn : styles.deleteBtn} disabled={actionSubmitting} onClick={doAction}>
                {actionSubmitting ? 'Submitting...' : actionType === 'approve' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Receipts({ accessToken }) {
  const { locations, employees, ready } = useDropdowns(accessToken);
  const [data, setData] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [poDetail, setPoDetail] = useState(null);
  const [loadingPo, setLoadingPo] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);

  function emptyForm() {
    return { grnNumber: '', purchaseOrderId: '', supplierId: '', receivedDate: todayKey(), receivedBy: '', remarks: '', items: [] };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getGoodsReceipts(accessToken, { status: statusFilter || undefined }));
      const pos = await getPurchaseOrders(accessToken);
      setPurchaseOrders(pos.filter((p) => ['approved', 'partially_received'].includes(p.status)));
    } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const onSelectPo = async (poId) => {
    setForm((f) => ({ ...f, purchaseOrderId: poId, items: [] }));
    if (!poId) { setPoDetail(null); return; }
    setLoadingPo(true);
    try {
      const po = await getPurchaseOrder(poId, accessToken);
      setPoDetail(po);
      setForm((f) => ({ ...f, supplierId: f.supplierId || String(po.supplierId) }));
    } catch (err) { alert(err.message); } finally { setLoadingPo(false); }
  };

  const openCreate = () => { setForm(emptyForm()); setPoDetail(null); setError(''); setModalOpen(true); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.grnNumber || !form.purchaseOrderId || !form.receivedDate || !form.receivedBy) { setError('GRN number, PO, date and receiver are required'); return; }
    if (!form.items.length) { setError('Add at least one received item'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        purchaseOrderId: Number(form.purchaseOrderId),
        supplierId: Number(poDetail.supplierId),
        receivedBy: Number(form.receivedBy),
        items: form.items.map((it) => ({
          purchaseOrderItemId: Number(it.purchaseOrderItemId),
          rawMaterialId: Number(it.rawMaterialId),
          batchNumber: it.batchNumber || null,
          receivedQuantity: Number(it.receivedQuantity || 0),
          unitId: Number(it.unitId),
          purchasePrice: it.purchasePrice === '' ? null : Number(it.purchasePrice),
          locationId: it.locationId ? Number(it.locationId) : null,
        })),
      };
      await createGoodsReceipt(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to create'); } finally { setSubmitting(false); }
  };

  const openDetail = async (row) => {
    try { setDetail(await getGoodsReceipt(row.id, accessToken)); } catch (err) { alert(err.message); }
  };

  const handleCancel = async (row) => {
    if (!confirm('Cancel this goods receipt?')) return;
    try { await cancelGoodsReceipt(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  let itemCols = [];
  if (poDetail) {
    const remainingPoItems = poDetail.items || [];
    itemCols = [
      {
        key: 'purchaseOrderItemId',
        label: 'PO Item',
        type: 'select',
        options: (row, rows) => remainingPoItems
          .filter((it) => String(it.id) === String(row.purchaseOrderItemId) || !rows.some((r) => String(r.purchaseOrderItemId) === String(it.id)))
          .map((it) => ({ value: String(it.id), label: `${it.rawMaterialName || 'Material'} (${it.orderedQuantity} ordered)` })),
      },
      { key: 'receivedQuantity', label: 'Received Qty', type: 'number', min: '0', step: 'any' },
      { key: 'batchNumber', label: 'Batch No.', type: 'text' },
      { key: 'purchasePrice', label: 'Unit Price', type: 'number', min: '0', step: 'any' },
      { key: 'locationId', label: 'Location', type: 'select', options: locations.map((l) => ({ value: String(l.id), label: l.name })) },
    ];
  }

  const columns = [
    { key: 'grnNumber', label: 'GRN', width: '120px' },
    { key: 'poNumber', label: 'PO', width: '120px' },
    { key: 'supplierName', label: 'Supplier' },
    { key: 'receivedDate', label: 'Received', width: '95px', render: (v) => fmtDate(v) },
    { key: 'receivedByName', label: 'Received By', render: (v) => v || '—' },
    { key: 'status', label: 'Status', width: '130px', render: (v) => <StatusPill value={v} color={STATUS_COLORS[v] || '#6b7280'} /> },
    { key: 'id', label: '', width: '130px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openDetail(row)}>View</button>
        {row.status !== 'cancelled' && row.status !== 'qc_completed' && <button className={styles.deleteBtn} onClick={() => handleCancel(row)}>Cancel</button>}
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Goods Receipts</h2>
          <p className={styles.pageSub}>{data.length} receipts</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="partially_qc">Partially QC</option>
            <option value="qc_completed">QC Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <button className={styles.primaryBtn} onClick={openCreate} disabled={!ready}>+ New Receipt</button>
        </div>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No goods receipts found" onRowClick={openDetail} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Goods Receipt" width={820}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="GRN Number" value={form.grnNumber} onChange={(e) => setForm({ ...form, grnNumber: e.target.value })} placeholder="e.g. GRN-0001" required />
            <FormField label="Purchase Order" type="select" value={form.purchaseOrderId} onChange={(e) => onSelectPo(e.target.value)} options={purchaseOrders.map((p) => ({ value: String(p.id), label: `${p.poNumber} — ${p.supplierName}` }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Received Date" type="date" value={form.receivedDate} onChange={(e) => setForm({ ...form, receivedDate: e.target.value })} required />
            <FormField label="Received By" type="select" value={form.receivedBy} onChange={(e) => setForm({ ...form, receivedBy: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} required />
          </div>
          <FormField label="Remarks" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 10, background: '#fafafa' }}>
            {loadingPo ? <p className={styles.emptyText}>Loading PO items...</p> : !poDetail ? (
              <p className={styles.emptyText}>Select a purchase order to add received items.</p>
            ) : (
              <>
                <p style={{ margin: '0 0 8px', fontSize: 12.5, color: '#6b7280' }}>
                  PO total: {money(poDetail.totalAmount)} · {poDetail.items?.length || 0} items
                </p>
                <ItemRowsEditor
                  columns={itemCols}
                  rows={form.items}
                  onChange={(items) => setForm({ ...form, items })}
                  newRow={() => ({ purchaseOrderItemId: '', receivedQuantity: '', batchNumber: '', purchasePrice: '', locationId: '' })}
                  addLabel="+ Add Received Item"
                />
              </>
            )}
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `GRN: ${detail.grnNumber}` : 'Goods Receipt'} width={560}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className={styles.detailRow}><span>Status</span><strong><StatusPill value={detail.status} color={STATUS_COLORS[detail.status] || '#6b7280'} /></strong></div>
            <div className={styles.detailRow}><span>PO</span><strong>{detail.poNumber || '—'}</strong></div>
            <div className={styles.detailRow}><span>Supplier</span><strong>{detail.supplierName || '—'}</strong></div>
            <div className={styles.detailRow}><span>Received</span><strong>{fmtDate(detail.receivedDate)} by {detail.receivedByName || '—'}</strong></div>
            {detail.remarks && <div className={styles.detailRow}><span>Remarks</span><strong>{detail.remarks}</strong></div>}
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Items</h4>
              {!detail.items?.length ? <p className={styles.emptyText}>No items.</p> : (
                <div style={{ borderTop: '1px solid #e5e7eb' }}>
                  {detail.items.map((it) => (
                    <div key={it.id} className={styles.compItem}>
                      <div>
                        <span className={styles.compName}>{it.rawMaterialName || '—'}</span>
                        <div className={styles.compAmount} style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>
                          batch {it.batchNumber || '—'} → {it.locationName || '—'} · {it.qcStatus ? <StatusPill value={it.qcStatus} color={STATUS_COLORS[it.qcStatus] || '#6b7280'} /> : null}
                        </div>
                      </div>
                      <span className={styles.compAmount}>{it.receivedQuantity} {it.unitSymbol || ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Inspections({ accessToken }) {
  const { employees, ready } = useDropdowns(accessToken);
  const [goodsReceipts, setGoodsReceipts] = useState([]);
  const [grDetail, setGrDetail] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function emptyForm() {
    return { goodsReceiptId: '', goodsReceiptItemId: '', inspectedBy: '', approvedQuantity: '', rejectedQuantity: '', status: 'approved', remarks: '', rejectionAction: '' };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getQualityInspections(accessToken));
      const grs = await getGoodsReceipts(accessToken);
      setGoodsReceipts(grs.filter((g) => ['draft', 'partially_qc'].includes(g.status)));
    } catch { /* empty */ }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const onSelectGr = async (grId) => {
    setForm((f) => ({ ...f, goodsReceiptId: grId, goodsReceiptItemId: '', approvedQuantity: '', rejectedQuantity: '' }));
    if (!grId) { setGrDetail(null); return; }
    try {
      const gr = await getGoodsReceipt(grId, accessToken);
      setGrDetail(gr);
    } catch (err) { alert(err.message); }
  };

  const pendingItems = (grDetail?.items || []).filter((it) => !it.qcStatus || it.qcStatus === 'pending');

  const openCreate = () => { setForm(emptyForm()); setGrDetail(null); setError(''); setModalOpen(true); };

  const onSelectItem = (itemId) => {
    const it = (grDetail?.items || []).find((i) => String(i.id) === String(itemId));
    setForm((f) => ({
      ...f,
      goodsReceiptItemId: itemId,
      approvedQuantity: it ? it.receivedQuantity : '',
      rejectedQuantity: '0',
    }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.goodsReceiptItemId || !form.inspectedBy || form.approvedQuantity === '' || form.rejectedQuantity === '') {
      setError('Item, inspector and quantities are required');
      return;
    }
    setSubmitting(true);
    try {
      await createQualityInspection({
        goodsReceiptItemId: Number(form.goodsReceiptItemId),
        inspectedBy: Number(form.inspectedBy),
        approvedQuantity: Number(form.approvedQuantity),
        rejectedQuantity: Number(form.rejectedQuantity),
        status: form.status,
        remarks: form.remarks || null,
        rejectionAction: form.rejectionAction || null,
      }, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to record inspection'); } finally { setSubmitting(false); }
  };

  const columns = [
    { key: 'rawMaterialName', label: 'Material' },
    { key: 'batchNumber', label: 'Batch', width: '110px' },
    { key: 'approvedQuantity', label: 'Approved', width: '100px', render: (v) => <strong style={{ color: '#16a34a' }}>{Number(v || 0).toLocaleString('en-IN')}</strong> },
    { key: 'rejectedQuantity', label: 'Rejected', width: '100px', render: (v) => <strong style={{ color: Number(v) > 0 ? '#DC2626' : '#6b7280' }}>{Number(v || 0).toLocaleString('en-IN')}</strong> },
    { key: 'inspectedBy', label: 'Inspector', render: (_, r) => `${r.firstName || ''} ${r.lastName || ''}`.trim() || '—' },
    { key: 'inspectedAt', label: 'Inspected', width: '130px', render: (v) => fmtDateTime(v) },
    { key: 'status', label: 'Status', width: '110px', render: (v) => <StatusPill value={v} color={STATUS_COLORS[v] || '#6b7280'} /> },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Quality Inspections</h2>
          <p className={styles.pageSub}>{data.length} inspections</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate} disabled={!ready}>+ New Inspection</button>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No quality inspections recorded" />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Record Quality Inspection" width={560}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <FormField label="Goods Receipt" type="select" value={form.goodsReceiptId} onChange={(e) => onSelectGr(e.target.value)} options={goodsReceipts.map((g) => ({ value: String(g.id), label: `${g.grnNumber} — ${g.supplierName || ''}` }))} placeholder="Select a receipt awaiting QC" required />
          {grDetail && (
            <FormField
              label="Receipt Item"
              type="select"
              value={form.goodsReceiptItemId}
              onChange={(e) => onSelectItem(e.target.value)}
              options={pendingItems.map((it) => ({ value: String(it.id), label: `${it.rawMaterialName} — batch ${it.batchNumber || '—'} (${it.receivedQuantity} ${it.unitSymbol || ''})` }))}
              required
            />
          )}
          <div className={styles.formGrid}>
            <FormField label="Approved Qty" type="number" min="0" step="any" value={form.approvedQuantity} onChange={(e) => setForm({ ...form, approvedQuantity: e.target.value })} required />
            <FormField label="Rejected Qty" type="number" min="0" step="any" value={form.rejectedQuantity} onChange={(e) => setForm({ ...form, rejectedQuantity: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Inspected By" type="select" value={form.inspectedBy} onChange={(e) => setForm({ ...form, inspectedBy: e.target.value })} options={employees.map((e) => ({ value: String(e.id), label: `${e.firstName} ${e.lastName || ''}` }))} required />
            <FormField label="Result" type="select" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} options={[{ value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} required />
          </div>
          {form.status === 'rejected' && (
            <FormField label="Rejection Action" type="select" value={form.rejectionAction} onChange={(e) => setForm({ ...form, rejectionAction: e.target.value })} options={[{ value: 'return_supplier', label: 'Return to supplier' }, { value: 'scrap', label: 'Scrap' }, { value: 'rejected_stock', label: 'Keep as rejected stock' }]} placeholder="Select action" />
          )}
          <FormField label="Remarks" type="textarea" value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Record Inspection'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}