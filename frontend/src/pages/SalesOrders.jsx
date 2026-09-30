import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getSalesOrders, getSalesOrder, createSalesOrder, updateSalesOrder,
  submitSalesOrder, approveSalesOrder, rejectSalesOrder, cancelSalesOrder, deleteSalesOrder,
  addSalesOrderItem, updateSalesOrderItem, deleteSalesOrderItem,
  getCustomers, getFinishedProducts, getInventoryUnits,
} from '@/api/inventory';
import { getEmployees } from '@/api/dropdowns';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Drawer from '@/components/ui/Drawer';
import FormField from '@/components/ui/FormField';
import { ItemRowsEditor, StatusPill, STATUS_COLORS, fmtDate, money, todayKey } from './inventory/shared';
import styles from '@/pages/ModulePage.module.css';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_manager', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function SalesOrders() {
  const { accessToken } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [ready, setReady] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [origItems, setOrigItems] = useState({});
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionType, setActionType] = useState('approve');
  const [remarks, setRemarks] = useState('');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  function emptyForm() {
    return { salesOrderNumber: '', customerId: '', orderDate: todayKey(), expectedDispatchDate: '', status: 'draft', items: [] };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getSalesOrders(accessToken, { status: statusFilter || undefined }));
    } catch { /* empty */ }
    setLoading(false);
  }, [accessToken, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    Promise.all([
      getCustomers(accessToken, { isActive: 1 }),
      getFinishedProducts(accessToken),
      getInventoryUnits(accessToken),
      getEmployees(accessToken),
    ])
      .then(([c, p, u, e]) => { setCustomers(c); setProducts(p); setUnits(u); setEmployees(e); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [accessToken]);

  const openCreate = () => { setEditId(null); setOrigItems({}); setForm(emptyForm()); setError(''); setModalOpen(true); };

  const openEdit = async (row) => {
    setError('');
    try {
      const d = await getSalesOrder(row.id, accessToken);
      setEditId(d.id);
      const items = (d.items || []).map((it) => ({
        id: it.id,
        finishedProductId: String(it.finishedProductId),
        orderedQuantity: it.orderedQuantity,
        unitId: String(it.unitId),
        unitPrice: it.unitPrice,
      }));
      setOrigItems(Object.fromEntries(items.map((it) => [String(it.id), {
        finishedProductId: Number(it.finishedProductId),
        orderedQuantity: Number(it.orderedQuantity),
        unitId: Number(it.unitId),
        unitPrice: Number(it.unitPrice || 0),
      }])));
      setForm({
        salesOrderNumber: d.salesOrderNumber,
        customerId: String(d.customerId),
        orderDate: d.orderDate ? String(d.orderDate).slice(0, 10) : '',
        expectedDispatchDate: d.expectedDispatchDate ? String(d.expectedDispatchDate).slice(0, 10) : '',
        status: d.status,
        items,
      });
      setModalOpen(true);
    } catch (err) { alert(err.message); }
  };

  const saveEdit = async (payload) => {
    await updateSalesOrder(editId, {
      customerId: Number(payload.customerId),
      orderDate: payload.orderDate,
      expectedDispatchDate: payload.expectedDispatchDate || null,
    }, accessToken);
    for (const it of payload.items) {
      const vals = {
        finishedProductId: Number(it.finishedProductId),
        orderedQuantity: Number(it.orderedQuantity || 0),
        unitId: Number(it.unitId),
        unitPrice: Number(it.unitPrice || 0),
      };
      if (!it.id) {
        await addSalesOrderItem(editId, vals, accessToken);
      } else {
        const o = origItems[String(it.id)];
        if (!o || o.finishedProductId !== vals.finishedProductId || o.orderedQuantity !== vals.orderedQuantity || o.unitId !== vals.unitId || o.unitPrice !== vals.unitPrice) {
          await updateSalesOrderItem(editId, it.id, vals, accessToken);
        }
      }
    }
    for (const id of Object.keys(origItems)) {
      if (!payload.items.some((it) => String(it.id) === id)) {
        await deleteSalesOrderItem(editId, id, accessToken);
      }
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.salesOrderNumber || !form.customerId || !form.orderDate) { setError('SO number, customer and date are required'); return; }
    if (!form.items.length) { setError('Add at least one item'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        customerId: Number(form.customerId),
        expectedDispatchDate: form.expectedDispatchDate || null,
        createdBy: employees[0]?.id ? Number(employees[0].id) : undefined,
        items: form.items.map((it) => ({ finishedProductId: Number(it.finishedProductId), orderedQuantity: Number(it.orderedQuantity || 0), unitId: Number(it.unitId), unitPrice: Number(it.unitPrice || 0) })),
      };
      if (editId) await saveEdit(payload);
      else await createSalesOrder(payload, accessToken);
      setModalOpen(false);
      setEditId(null);
      load();
    } catch (err) { setError(err.message || 'Failed to save'); } finally { setSubmitting(false); }
  };

  const doAction = async () => {
    if (!actionTarget) return;
    setActionSubmitting(true);
    try {
      if (actionType === 'approve') await approveSalesOrder(actionTarget.id, { managerApprovedBy: employees[0]?.id ? Number(employees[0].id) : undefined, managerRemarks: remarks || undefined }, accessToken);
      else if (actionType === 'reject') await rejectSalesOrder(actionTarget.id, { managerRemarks: remarks || undefined }, accessToken);
      else if (actionType === 'cancel') await cancelSalesOrder(actionTarget.id, accessToken);
      setActionTarget(null);
      load();
    } catch (err) { alert(err.message); } finally { setActionSubmitting(false); }
  };

  const openDetail = async (row) => {
    try { setDetail(await getSalesOrder(row.id, accessToken)); } catch (err) { alert(err.message); }
  };

  const handleSubmitForApproval = async (row) => {
    try { await submitSalesOrder(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const handleDelete = async (row) => {
    if (!confirm('Delete this sales order?')) return;
    try { await deleteSalesOrder(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const itemCols = [
    { key: 'finishedProductId', label: 'Product', type: 'select', options: products.map((p) => ({ value: String(p.id), label: `${p.name} (${p.sku})` })) },
    { key: 'orderedQuantity', label: 'Qty', type: 'number', min: '0', step: 'any' },
    { key: 'unitId', label: 'Unit', type: 'select', options: units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.symbol})` })) },
    { key: 'unitPrice', label: 'Unit Price', type: 'number', min: '0', step: 'any' },
  ];

  const columns = [
    { key: 'salesOrderNumber', label: 'Number', width: '130px' },
    { key: 'customerName', label: 'Customer', render: (v, r) => (v ? `${v}${r.customerCode ? ` (${r.customerCode})` : ''}` : <span style={{ color: '#cbd5e1' }}>—</span>) },
    { key: 'orderDate', label: 'Order Date', width: '95px', render: (v) => fmtDate(v) },
    { key: 'expectedDispatchDate', label: 'Dispatch', width: '95px', render: (v) => (v ? fmtDate(v) : <span style={{ color: '#cbd5e1' }}>—</span>) },
    { key: 'totalAmount', label: 'Total', width: '110px', align: 'right', render: (v) => money(v) },
    { key: 'status', label: 'Status', width: '130px', render: (v) => <StatusPill value={v} color={STATUS_COLORS[v] || '#6b7280'} /> },
    { key: 'id', label: '', width: '230px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openDetail(row)}>View</button>
        {row.status === 'draft' && <button className={styles.editBtn} onClick={() => openEdit(row)}>Edit</button>}
        {row.status === 'draft' && <button className={styles.editBtn} onClick={() => handleSubmitForApproval(row)}>Submit</button>}
        {row.status === 'pending_manager' && (
          <>
            <button className={styles.editBtn} style={{ borderColor: '#16a34a', color: '#16a34a' }} onClick={() => { setActionTarget(row); setActionType('approve'); setRemarks(''); }}>Approve</button>
            <button className={styles.deleteBtn} onClick={() => { setActionTarget(row); setActionType('reject'); setRemarks(''); }}>Reject</button>
          </>
        )}
        {row.status === 'draft' && <button className={styles.deleteBtn} onClick={() => handleDelete(row)}>Del</button>}
        {['draft', 'pending_manager', 'approved'].includes(row.status) && <button className={styles.deleteBtn} onClick={() => { setActionTarget(row); setActionType('cancel'); setRemarks(''); }}>Cancel</button>}
      </div>
    )},
  ];

  return (
    <div style={{ padding: '24px 28px' }}>
      <div className={styles.pageHeader}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111111' }}>Sales Orders</h1>
          <p className={styles.pageSub}>{data.length} orders</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select className={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <button className={styles.primaryBtn} onClick={openCreate} disabled={!ready}>+ New SO</button>
        </div>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No sales orders found" onRowClick={openDetail} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Sales Order' : 'New Sales Order'} width={780}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="SO Number" value={form.salesOrderNumber} onChange={(e) => setForm({ ...form, salesOrderNumber: e.target.value })} placeholder="e.g. SO-0001" required />
            <FormField label="Customer" type="select" value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })} options={customers.map((c) => ({ value: String(c.id), label: `${c.companyName}${c.customerCode ? ` (${c.customerCode})` : ''}` }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Order Date" type="date" value={form.orderDate} onChange={(e) => setForm({ ...form, orderDate: e.target.value })} required />
            <FormField label="Expected Dispatch Date" type="date" value={form.expectedDispatchDate} onChange={(e) => setForm({ ...form, expectedDispatchDate: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 6 }}>Items</label>
            <ItemRowsEditor
              columns={itemCols}
              rows={form.items}
              onChange={(items) => setForm({ ...form, items })}
              newRow={() => ({ finishedProductId: '', orderedQuantity: '', unitId: '', unitPrice: '' })}
              addLabel="+ Add Item"
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : editId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `SO: ${detail.salesOrderNumber}` : 'Sales Order'} width={560}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className={styles.detailRow}><span>Status</span><strong><StatusPill value={detail.status} color={STATUS_COLORS[detail.status] || '#6b7280'} /></strong></div>
            <div className={styles.detailRow}><span>Customer</span><strong>{detail.customerName}{detail.customerCode ? ` (${detail.customerCode})` : ''}</strong></div>
            <div className={styles.detailRow}><span>Order Date</span><strong>{fmtDate(detail.orderDate)}</strong></div>
            {detail.expectedDispatchDate && <div className={styles.detailRow}><span>Expected Dispatch</span><strong>{fmtDate(detail.expectedDispatchDate)}</strong></div>}
            {detail.managerRemarks && <div className={styles.detailRow}><span>Manager Remarks</span><strong>{detail.managerRemarks}</strong></div>}
            <div className={styles.detailRow}><span>Created By</span><strong>{`${detail.firstName || ''} ${detail.lastName || ''}`.trim() || '—'}</strong></div>
            <div className={styles.detailRow}><span>Total</span><strong style={{ color: '#D4AF37' }}>{money(detail.totalAmount)}</strong></div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Items</h4>
              {!detail.items?.length ? <p className={styles.emptyText}>No items.</p> : (
                <div style={{ borderTop: '1px solid #e5e7eb' }}>
                  {detail.items.map((it) => (
                    <div key={it.id} className={styles.compItem}>
                      <span className={styles.compName}>{it.finishedProductName || '—'} <span style={{ color: '#9ca3af', fontWeight: 400 }}>({it.sku || ''})</span></span>
                      <span className={styles.compAmount}>{it.orderedQuantity} {it.unitSymbol || ''} × {money(it.unitPrice)}</span>
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
        <Modal isOpen onClose={() => setActionTarget(null)} title={`${actionType === 'approve' ? 'Approve' : actionType === 'reject' ? 'Reject' : 'Cancel'} Sales Order`} width={440}>
          <div className={styles.form}>
            {actionType !== 'approve' && <div style={{ fontSize: 13, color: '#6b7280' }}>You are {actionType === 'cancel' ? 'cancelling' : 'rejecting'} {actionTarget.salesOrderNumber}.</div>}
            {actionType !== 'cancel' && <FormField label="Remarks" type="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Review remarks (optional)" />}
            <div className={styles.formActions}>
              <button className={styles.cancelBtn} onClick={() => setActionTarget(null)}>Cancel</button>
              <button className={actionType === 'approve' ? styles.primaryBtn : styles.deleteBtn} disabled={actionSubmitting} onClick={doAction}>
                {actionSubmitting ? 'Submitting...' : actionType === 'approve' ? 'Approve' : actionType === 'reject' ? 'Reject' : 'Cancel Order'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}