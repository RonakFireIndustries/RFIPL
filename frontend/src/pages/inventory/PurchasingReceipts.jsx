import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import moduleStyles from '../ModulePage.module.css';
import local from './Purchasing.module.css';
import {
  cancelGoodsReceipt,
  createGoodsReceipt,
  createQualityInspection,
  getGoodsReceipt,
  getGoodsReceipts,
  getPurchaseOrders,
} from '@/api/inventory';
import { formatDate, formatMoney, formatQty } from './utils';
import { DetailField, StatusBadge } from './PurchasingShared';

function statusFor(approved, rejected) {
  if (approved > 0 && rejected > 0) return 'partially_approved';
  if (rejected > 0) return 'rejected';
  return 'approved';
}

export default function PurchasingReceipts() {
  const { accessToken } = useAuth();
  const { success, error: toastError } = useInteractions();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState('grn');
  const [selectedPoId, setSelectedPoId] = useState('');
  const [receivedDate, setReceivedDate] = useState('');
  const [remarks, setRemarks] = useState('');
  const [receiptLines, setReceiptLines] = useState([]);
  const [qcLines, setQcLines] = useState({});
  const [createdGrn, setCreatedGrn] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    try {
      const [receiptRows, orderRows] = await Promise.all([
        getGoodsReceipts(accessToken),
        getPurchaseOrders(accessToken),
      ]);
      const detailed = await Promise.all(receiptRows.map((row) => getGoodsReceipt(row.id, accessToken)));
      setRows(detailed);
      setOrders(orderRows);
    } catch (err) {
      toastError(err.message || 'Failed to load goods receipts');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setStep('grn');
    setSelectedPoId('');
    setReceivedDate(new Date().toISOString().slice(0, 10));
    setRemarks('');
    setReceiptLines([]);
    setQcLines({});
    setCreatedGrn(null);
    setFormError('');
    setWizardOpen(true);
  };

  const openQcFor = async (grn) => {
    try {
      const full = grn.items ? grn : await getGoodsReceipt(grn.id, accessToken);
      const pending = (full.items || []).filter((item) => item.qcStatus === 'pending');
      if (pending.length === 0) {
        toastError('All lines on this receipt already have a QC result');
        return;
      }
      setCreatedGrn(full);
      setQcLines(Object.fromEntries(pending.map((item) => [item.id, {
        approvedQuantity: item.receivedQuantity,
        rejectedQuantity: 0,
        rejectionAction: 'rejected_stock',
        remarks: '',
      }])));
      setStep('qc');
      setFormError('');
      setWizardOpen(true);
    } catch (err) {
      toastError(err.message || 'Failed to open QC');
    }
  };

  const selectPurchaseOrder = (id) => {
    setSelectedPoId(id);
    const order = orders.find((po) => String(po.id) === String(id));
    if (!order) {
      setReceiptLines([]);
      return;
    }
    setReceiptLines((order.items || [])
      .map((item) => ({
        key: `${Date.now()}-${item.id}`,
        purchaseOrderItemId: item.id,
        rawMaterialId: item.rawMaterialId,
        materialName: item.rawMaterialName,
        sku: item.sku,
        unitId: item.unitId,
        unitSymbol: item.unitSymbol,
        remaining: Number(item.orderedQuantity) - Number(item.receivedQuantity),
        batchNumber: '',
        receivedQuantity: '',
        purchasePrice: '',
      }))
      .filter((line) => line.remaining > 0));
  };

  const changeReceiptLine = (key, field, value) => {
    setReceiptLines((current) => current.map((line) => (
      line.key === key ? { ...line, [field]: value } : line
    )));
  };

  const changeQcLine = (id, field, value) => {
    setQcLines((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  };

  const handleCreateGrn = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!selectedPoId) {
      setFormError('Select an approved purchase order');
      return;
    }
    const active = receiptLines.filter((line) => line.receivedQuantity !== '');
    if (active.length === 0) {
      setFormError('Enter a received quantity for at least one line');
      return;
    }
    if (active.some((line) => !line.batchNumber || !line.purchasePrice)) {
      setFormError('Every received line needs a batch number and purchase price');
      return;
    }
    if (active.some((line) => Number(line.receivedQuantity) <= 0 || Number(line.receivedQuantity) > line.remaining)) {
      setFormError('Received quantity must be positive and cannot exceed the remaining order quantity');
      return;
    }

    setSubmitting(true);
    try {
      const created = await createGoodsReceipt({
        purchaseOrderId: selectedPoId,
        receivedDate,
        remarks: remarks || null,
        items: active.map((line) => ({
          purchaseOrderItemId: line.purchaseOrderItemId,
          rawMaterialId: line.rawMaterialId,
          batchNumber: line.batchNumber,
          receivedQuantity: line.receivedQuantity,
          unitId: line.unitId,
          purchasePrice: line.purchasePrice,
        })),
      }, accessToken);
      const full = await getGoodsReceipt(created.id, accessToken);
      setCreatedGrn(full);
      setQcLines(Object.fromEntries((full.items || []).map((item) => [item.id, {
        approvedQuantity: item.receivedQuantity,
        rejectedQuantity: 0,
        rejectionAction: 'rejected_stock',
        remarks: '',
      }])));
      setStep('qc');
      setFormError('');
      success(`${created.grnNumber} created — record QC for its lines`);
    } catch (err) {
      setFormError(err.message || 'Failed to create goods receipt');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQc = async (e) => {
    e.preventDefault();
    if (!createdGrn) return;
    setFormError('');

    const pendingItems = (createdGrn.items || []).filter((item) => item.qcStatus === 'pending');
    const entries = pendingItems
      .map((item) => ({ item, values: qcLines[item.id] }))
      .filter(({ values }) => values && (Number(values.approvedQuantity) > 0 || Number(values.rejectedQuantity) > 0));

    if (entries.length === 0) {
      setFormError('Enter an approved or rejected quantity for at least one line');
      return;
    }

    setSubmitting(true);
    try {
      for (const { item, values } of entries) {
        const approved = Number(values.approvedQuantity || 0);
        const rejected = Number(values.rejectedQuantity || 0);
        if (approved + rejected > Number(item.receivedQuantity)) {
          throw new Error(`Inspected quantity for ${item.batchNumber} exceeds received quantity`);
        }
        await createQualityInspection({
          goodsReceiptItemId: item.id,
          approvedQuantity: approved,
          rejectedQuantity: rejected,
          status: statusFor(approved, rejected),
          rejectionAction: rejected > 0 ? values.rejectionAction : null,
          remarks: values.remarks || null,
        }, accessToken);
      }
      success('QC recorded. Approved quantity is now in stock.');
      setWizardOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to record QC');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (row) => {
    if (!window.confirm(`Cancel ${row.grnNumber}?`)) return;
    try {
      await cancelGoodsReceipt(row.id, accessToken);
      success(`${row.grnNumber} cancelled`);
      setDetail(null);
      await load();
    } catch (err) {
      toastError(err.message || 'Failed to cancel receipt');
    }
  };

  const availableOrders = orders.filter((po) => ['approved', 'partially_received'].includes(po.status));

  const columns = [
    {
      key: 'grnNumber',
      label: 'GRN',
      render: (value, row) => (
        <div>
          <span className={local.docNumber}>{value}</span>
          <span className={local.subtleBlock}>{formatDate(row.receivedDate)}</span>
        </div>
      ),
    },
    { key: 'poNumber', label: 'Purchase order', render: (value) => value || '—' },
    { key: 'supplierName', label: 'Supplier', render: (value) => value || '—' },
    { key: 'status', label: 'Status', width: '150px', render: (value) => <StatusBadge status={value} /> },
    {
      key: 'qc',
      label: 'QC lines',
      width: '120px',
      render: (_, row) => {
        const items = row.items || [];
        const pending = items.filter((item) => item.qcStatus === 'pending').length;
        return pending ? <span className={local.progressText}>{pending} pending</span> : <span className={moduleStyles.badgeGreen}>Done</span>;
      },
    },
    {
      key: 'id',
      label: 'Actions',
      width: '190px',
      render: (_, row) => (
        <div className={moduleStyles.actions} onClick={(e) => e.stopPropagation()}>
          {(row.items || []).some((item) => item.qcStatus === 'pending') && (
            <button className={moduleStyles.editBtn} onClick={() => openQcFor(row)}>Record QC</button>
          )}
          {!['qc_completed', 'cancelled'].includes(row.status) && (
            <button className={moduleStyles.deleteBtn} onClick={() => handleCancel(row)}>Cancel</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={moduleStyles.pageHeader}>
        <div>
          <h2 className={local.sectionTitle}>Goods Receipts</h2>
          <p className={moduleStyles.pageSub}>Create a GRN from an approved PO, then record QC in the next step.</p>
        </div>
        <button className={moduleStyles.primaryBtn} onClick={openCreate}>+ New GRN</button>
      </div>

      {loading ? (
        <div className={moduleStyles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={rows}
          onRowClick={setDetail}
          searchable
          searchKeys={['grnNumber', 'poNumber', 'supplierName', 'status']}
          searchPlaceholder="Search receipts..."
          emptyMessage="No goods receipts yet. Receive stock against an approved purchase order."
        />
      )}

      <Modal isOpen={wizardOpen} onClose={() => setWizardOpen(false)} title={step === 'grn' ? 'New goods receipt' : `QC for ${createdGrn?.grnNumber || 'receipt'}`} wide>
        {formError && <div className={moduleStyles.error}>{formError}</div>}

        {step === 'grn' ? (
          <form onSubmit={handleCreateGrn} className={moduleStyles.form}>
            <p className={local.note}>Step 1 of 2 — record what arrived. You will inspect each line in step 2.</p>
            <div className={moduleStyles.formGrid}>
              <FormField
                label="Approved purchase order"
                type="select"
                value={selectedPoId}
                onChange={(e) => selectPurchaseOrder(e.target.value)}
                options={availableOrders.map((po) => ({ value: po.id, label: `${po.poNumber} · ${po.supplierName || 'Supplier'}` }))}
                required
              />
              <FormField label="Received date" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} required />
            </div>
            <FormField label="Remarks" type="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />

            {receiptLines.length > 0 && (
              <div>
                <div className={local.lineHeader}>
                  <span>Material / batch</span>
                  <span>Remaining</span>
                  <span>Received</span>
                  <span>Purchase price</span>
                  <span />
                </div>
                <div className={local.lineItems}>
                  {receiptLines.map((line) => (
                    <div className={local.lineRow} key={line.key}>
                      <label className={local.lineLabel}>
                        {line.materialName} ({line.sku})
                        <input
                          value={line.batchNumber}
                          onChange={(e) => changeReceiptLine(line.key, 'batchNumber', e.target.value)}
                          placeholder="Batch / lot number"
                        />
                      </label>
                      <span className={local.lineTotal}>{formatQty(line.remaining)} {line.unitSymbol}</span>
                      <input type="number" min="0.0001" step="0.0001" value={line.receivedQuantity}
                        onChange={(e) => changeReceiptLine(line.key, 'receivedQuantity', e.target.value)} placeholder="0" />
                      <input type="number" min="0" step="0.01" value={line.purchasePrice}
                        onChange={(e) => changeReceiptLine(line.key, 'purchasePrice', e.target.value)} placeholder="₹0.00" />
                      <span />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className={local.hint}>
              GRN numbers are generated automatically. Single store — no location selection needed.
            </p>
            <div className={moduleStyles.formActions}>
              <button type="button" className={moduleStyles.cancelBtn} onClick={() => setWizardOpen(false)}>Cancel</button>
              <button type="submit" className={moduleStyles.primaryBtn} disabled={submitting}>
                {submitting ? 'Saving...' : 'Create GRN & continue to QC'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleQc} className={moduleStyles.form}>
            <p className={local.note}>Step 2 of 2 — split each received line into approved and rejected quantity. Approved stock is posted immediately.</p>
            {(createdGrn?.items || []).map((item) => {
              const values = qcLines[item.id] || {};
              return (
                <div className={local.qcRow} key={item.id}>
                  <div>
                    <label>{item.rawMaterialName} · Batch {item.batchNumber}</label>
                    <span className={local.progressText}>Received {formatQty(item.receivedQuantity)} {item.unitSymbol}</span>
                  </div>
                  <div>
                    <label>Approved</label>
                    <input type="number" min="0" step="0.0001" value={values.approvedQuantity ?? item.receivedQuantity}
                      onChange={(e) => changeQcLine(item.id, 'approvedQuantity', e.target.value)} />
                  </div>
                  <div>
                    <label>Rejected</label>
                    <input type="number" min="0" step="0.0001" value={values.rejectedQuantity ?? 0}
                      onChange={(e) => changeQcLine(item.id, 'rejectedQuantity', e.target.value)} />
                  </div>
                  <div>
                    <label>Rejected action</label>
                    <select value={values.rejectionAction || 'rejected_stock'}
                      onChange={(e) => changeQcLine(item.id, 'rejectionAction', e.target.value)}>
                      <option value="rejected_stock">Rejected stock</option>
                      <option value="return_supplier">Return to supplier</option>
                    </select>
                  </div>
                </div>
              );
            })}
            <div className={moduleStyles.formActions}>
              <button type="button" className={moduleStyles.cancelBtn} onClick={() => setWizardOpen(false)}>Finish later</button>
              <button type="submit" className={moduleStyles.primaryBtn} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save inspections'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.grnNumber || 'Goods receipt'} wide>
        {detail && (
          <div>
            <div className={local.detailGrid}>
              <DetailField label="Status"><StatusBadge status={detail.status} /></DetailField>
              <DetailField label="Purchase order">{detail.poNumber || '—'}</DetailField>
              <DetailField label="Supplier">{detail.supplierName || '—'}</DetailField>
              <DetailField label="Received">{formatDate(detail.receivedDate)}</DetailField>
            </div>
            {detail.remarks && <p className={local.note}>{detail.remarks}</p>}
            <h3 className={local.sectionTitle}>Lines</h3>
            <Table
              columns={[
                { key: 'rawMaterialName', label: 'Material' },
                { key: 'batchNumber', label: 'Batch' },
                { key: 'receivedQuantity', label: 'Received', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
                { key: 'approvedQuantity', label: 'Approved', align: 'right', render: (v) => formatQty(v) },
                { key: 'rejectedQuantity', label: 'Rejected', align: 'right', render: (v) => formatQty(v) },
                { key: 'purchasePrice', label: 'Price', align: 'right', render: (v) => formatMoney(v) },
                { key: 'qcStatus', label: 'QC', render: (v) => <StatusBadge status={v} /> },
              ]}
              data={detail.items || []}
              emptyMessage="No lines."
            />
            <div className={moduleStyles.formActions}>
              <button className={moduleStyles.editBtn} onClick={() => navigate('/inventory/stock')}>View stock</button>
              <button className={moduleStyles.cancelBtn} onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
