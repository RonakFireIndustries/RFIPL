import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import moduleStyles from '../ModulePage.module.css';
import local from './Purchasing.module.css';
import {
  approvePurchaseOrder,
  cancelPurchaseOrder,
  createPurchaseOrder,
  deletePurchaseOrder,
  getInventoryUnits,
  getPurchaseOrders,
  getPurchaseRequests,
  getRawMaterials,
  getSuppliers,
  rejectPurchaseOrder,
  submitPurchaseOrder,
} from '@/api/inventory';
import { formatDate, formatMoney, titleCase, todayISO } from './utils';
import { DetailField, StatusBadge } from './PurchasingShared';

function newLine() {
  return {
    key: `${Date.now()}-${Math.random()}`,
    rawMaterialId: '',
    orderedQuantity: '',
    unitId: '',
    unitPrice: '',
  };
}

export default function PurchasingOrders() {
  const { accessToken } = useAuth();
  const { success, error: toastError } = useInteractions();

  const [rows, setRows] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [purchaseRequestId, setPurchaseRequestId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [orderDate, setOrderDate] = useState(todayISO());
  const [expectedDate, setExpectedDate] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [detail, setDetail] = useState(null);
  const [decision, setDecision] = useState(null);
  const [remarks, setRemarks] = useState('');

  const load = useCallback(async () => {
    try {
      const [orders, supplierRows, materialRows, unitRows, requestRows] = await Promise.all([
        getPurchaseOrders(accessToken),
        getSuppliers(accessToken),
        getRawMaterials(accessToken),
        getInventoryUnits(accessToken),
        getPurchaseRequests(accessToken),
      ]);
      setRows(orders);
      setSuppliers(supplierRows);
      setMaterials(materialRows);
      setUnits(unitRows);
      setRequests(requestRows);
    } catch (err) {
      toastError(err.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setPurchaseRequestId('');
    setSupplierId('');
    setOrderDate(todayISO());
    setExpectedDate('');
    setLines([newLine()]);
    setFormError('');
    setCreateOpen(true);
  };

  const applyRequest = (id) => {
    setPurchaseRequestId(id);
    const request = requests.find((r) => String(r.id) === String(id));
    if (!request) return;
    const requestRows = request.items || [];
    if (requestRows.length) {
      setLines(requestRows.map((item) => ({
        key: `${Date.now()}-${Math.random()}`,
        rawMaterialId: String(item.rawMaterialId),
        orderedQuantity: item.quantity,
        unitId: String(item.unitId),
        unitPrice: '',
      })));
    }
  };

  const changeLine = (key, field, value) => {
    setLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      const next = { ...line, [field]: value };
      if (field === 'rawMaterialId') {
        const material = materials.find((m) => String(m.id) === String(value));
        if (material) next.unitId = String(material.unitId || '');
      }
      return next;
    }));
  };

  const estimatedTotal = lines.reduce((sum, line) => {
    const value = Number(line.unitPrice) * Number(line.orderedQuantity);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!supplierId) {
      setFormError('Select a supplier');
      return;
    }
    const items = lines
      .filter((line) => line.rawMaterialId)
      .map((line) => ({
        rawMaterialId: line.rawMaterialId,
        orderedQuantity: line.orderedQuantity,
        unitId: line.unitId,
        unitPrice: line.unitPrice,
      }));
    if (items.length === 0) {
      setFormError('Add at least one material line');
      return;
    }
    if (items.some((item) => !item.orderedQuantity || !item.unitId || item.unitPrice === '')) {
      setFormError('Every line needs quantity, unit and price');
      return;
    }

    setSubmitting(true);
    try {
      await createPurchaseOrder({
        purchaseRequestId: purchaseRequestId || null,
        supplierId,
        orderDate,
        expectedDeliveryDate: expectedDate || null,
        items,
      }, accessToken);
      success('Purchase order created as draft');
      setCreateOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to create purchase order');
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (action, row) => {
    try {
      if (action === 'submit') await submitPurchaseOrder(row.id, accessToken);
      if (action === 'cancel') await cancelPurchaseOrder(row.id, accessToken);
      if (action === 'delete') {
        if (!window.confirm(`Delete ${row.poNumber}?`)) return;
        await deletePurchaseOrder(row.id, accessToken);
      }
      success(`${row.poNumber} ${action === 'delete' ? 'deleted' : action === 'cancel' ? 'cancelled' : 'submitted'}`);
      setDetail(null);
      await load();
    } catch (err) {
      toastError(err.message || `Failed to ${action} order`);
    }
  };

  const openDecision = (type, row) => {
    setDecision({ type, row });
    setRemarks('');
  };

  const handleDecision = async (e) => {
    e.preventDefault();
    if (!decision) return;
    try {
      const payload = { adminRemarks: remarks || null };
      if (decision.type === 'approve') await approvePurchaseOrder(decision.row.id, payload, accessToken);
      else await rejectPurchaseOrder(decision.row.id, payload, accessToken);
      success(`${decision.row.poNumber} ${decision.type === 'approve' ? 'approved' : 'rejected'}`);
      setDecision(null);
      setDetail(null);
      await load();
    } catch (err) {
      toastError(err.message || 'Failed to update order');
    }
  };

  const columns = [
    {
      key: 'poNumber',
      label: 'Order',
      render: (value, row) => (
        <div>
          <span className={local.docNumber}>{value}</span>
          <span className={local.subtleBlock}>{formatDate(row.orderDate)}</span>
        </div>
      ),
    },
    { key: 'supplierName', label: 'Supplier', render: (value) => value || '—' },
    { key: 'requestNumber', label: 'Request', render: (value) => value || '—' },
    { key: 'totalAmount', label: 'Value', align: 'right', render: (value) => formatMoney(value) },
    { key: 'status', label: 'Status', width: '150px', render: (value) => <StatusBadge status={value} /> },
    {
      key: 'id',
      label: 'Actions',
      width: '250px',
      render: (_, row) => (
        <div className={moduleStyles.actions} onClick={(e) => e.stopPropagation()}>
          {row.status === 'draft' && (
            <>
              <button className={moduleStyles.editBtn} onClick={() => runAction('submit', row)}>Submit</button>
              <button className={moduleStyles.deleteBtn} onClick={() => runAction('delete', row)}>Delete</button>
            </>
          )}
          {row.status === 'pending_admin' && (
            <>
              <button className={moduleStyles.editBtn} onClick={() => openDecision('approve', row)}>Approve</button>
              <button className={moduleStyles.deleteBtn} onClick={() => openDecision('reject', row)}>Reject</button>
            </>
          )}
          {['approved', 'partially_received'].includes(row.status) && (
            <button className={moduleStyles.deleteBtn} onClick={() => runAction('cancel', row)}>Cancel</button>
          )}
          {['received', 'rejected', 'cancelled'].includes(row.status) && <span className={local.progressText}>Closed</span>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={moduleStyles.pageHeader}>
        <div>
          <h2 className={local.sectionTitle}>Purchase Orders</h2>
          <p className={moduleStyles.pageSub}>Draft → admin approval → supplier order → receiving.</p>
        </div>
        <button className={moduleStyles.primaryBtn} onClick={openCreate}>+ New Order</button>
      </div>

      {loading ? (
        <div className={moduleStyles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={rows}
          onRowClick={setDetail}
          searchable
          searchKeys={['poNumber', 'supplierName', 'requestNumber', 'status']}
          searchPlaceholder="Search orders..."
          emptyMessage="No purchase orders yet. Create one from an approved request or directly."
        />
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New purchase order" wide>
        <form onSubmit={handleCreate} className={moduleStyles.form}>
          {formError && <div className={moduleStyles.error}>{formError}</div>}

          <div className={moduleStyles.formGrid}>
            <FormField
              label="Purchase request"
              type="select"
              value={purchaseRequestId}
              onChange={(e) => applyRequest(e.target.value)}
              options={requests
                .filter((r) => ['manager_approved', 'converted_to_po'].includes(r.status))
                .map((r) => ({ value: r.id, label: `${r.requestNumber} · ${r.status.replace('_', ' ')}` }))}
              placeholder="Optional"
            />
            <FormField
              label="Supplier"
              type="select"
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              options={suppliers.map((s) => ({ value: s.id, label: s.companyName }))}
              required
            />
            <FormField label="Order date" type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} required />
            <FormField label="Expected delivery" type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} />
          </div>

          <div>
            <div className={local.lineHeader}>
              <span>Material</span>
              <span>Quantity</span>
              <span>Unit</span>
              <span>Unit price</span>
              <span />
            </div>
            <div className={local.lineItems}>
              {lines.map((line) => (
                <div className={local.lineRow} key={line.key}>
                  <select value={line.rawMaterialId} onChange={(e) => changeLine(line.key, 'rawMaterialId', e.target.value)}>
                    <option value="">Select material...</option>
                    {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
                  </select>
                  <input type="number" min="0" step="0.0001" value={line.orderedQuantity}
                    onChange={(e) => changeLine(line.key, 'orderedQuantity', e.target.value)} placeholder="0" />
                  <select value={line.unitId} onChange={(e) => changeLine(line.key, 'unitId', e.target.value)}>
                    <option value="">Unit</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                  </select>
                  <input type="number" min="0" step="0.01" value={line.unitPrice}
                    onChange={(e) => changeLine(line.key, 'unitPrice', e.target.value)} placeholder="₹0.00" />
                  <button type="button" className={local.dangerSmall}
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className={`${local.smallBtn} ${local.addLineBtn}`} onClick={() => setLines((current) => [...current, newLine()])}>
              + Add line
            </button>
          </div>

          <p className={local.hint}>
            PO numbers are generated automatically. Unit prices are entered manually; estimated value: <strong>{formatMoney(estimatedTotal)}</strong>.
          </p>

          <div className={moduleStyles.formActions}>
            <button type="button" className={moduleStyles.cancelBtn} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className={moduleStyles.primaryBtn} disabled={submitting}>
              {submitting ? 'Saving...' : 'Create order'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.poNumber || 'Purchase order'} wide>
        {detail && (
          <div>
            <div className={local.detailGrid}>
              <DetailField label="Status"><StatusBadge status={detail.status} /></DetailField>
              <DetailField label="Supplier">{detail.supplierName || '—'}</DetailField>
              <DetailField label="Order date">{formatDate(detail.orderDate)}</DetailField>
              <DetailField label="Expected">{formatDate(detail.expectedDeliveryDate)}</DetailField>
              <DetailField label="Value">{formatMoney(detail.totalAmount)}</DetailField>
              <DetailField label="Request">{detail.requestNumber || '—'}</DetailField>
            </div>
            <h3 className={local.sectionTitle}>Items</h3>
            <Table
              columns={[
                { key: 'rawMaterialName', label: 'Material' },
                { key: 'orderedQuantity', label: 'Ordered', align: 'right', render: (v, r) => `${v} ${r.unitSymbol || ''}` },
                { key: 'receivedQuantity', label: 'Received', align: 'right', render: (v, r) => `${v} ${r.unitSymbol || ''}` },
                { key: 'unitPrice', label: 'Price', align: 'right', render: (v) => formatMoney(v) },
                { key: 'totalAmount', label: 'Total', align: 'right', render: (v) => formatMoney(v) },
              ]}
              data={detail.items || []}
              emptyMessage="No items."
            />
            <div className={moduleStyles.formActions}>
              {detail.status === 'draft' && (
                <button className={moduleStyles.primaryBtn} onClick={() => runAction('submit', detail)}>Submit for approval</button>
              )}
              {detail.status === 'pending_admin' && (
                <>
                  <button className={moduleStyles.primaryBtn} onClick={() => openDecision('approve', detail)}>Approve</button>
                  <button className={moduleStyles.deleteBtn} onClick={() => openDecision('reject', detail)}>Reject</button>
                </>
              )}
              {['approved', 'partially_received'].includes(detail.status) && (
                <button className={moduleStyles.deleteBtn} onClick={() => runAction('cancel', detail)}>Cancel order</button>
              )}
              <button className={moduleStyles.cancelBtn} onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(decision)} onClose={() => setDecision(null)} title={`${titleCase(decision?.type)} purchase order`}>
        {decision && (
          <form onSubmit={handleDecision} className={moduleStyles.form}>
            <p className={local.note}>{decision.row.poNumber} · {decision.row.supplierName || 'Supplier'}</p>
            <FormField label="Remarks" type="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional approval note" />
            <div className={moduleStyles.formActions}>
              <button type="button" className={moduleStyles.cancelBtn} onClick={() => setDecision(null)}>Cancel</button>
              <button type="submit" className={moduleStyles.primaryBtn}>Confirm {decision.type}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
