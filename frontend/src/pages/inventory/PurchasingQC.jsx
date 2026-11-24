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
  createQualityInspection,
  getGoodsReceipt,
  getGoodsReceipts,
  getQualityInspections,
} from '@/api/inventory';
import { formatDateTime, formatQty } from './utils';
import { DetailField, StatusBadge } from './PurchasingShared';

function statusFor(approved, rejected) {
  if (approved > 0 && rejected > 0) return 'partially_approved';
  if (rejected > 0) return 'rejected';
  return 'approved';
}

export default function PurchasingQC() {
  const { accessToken } = useAuth();
  const { success, error: toastError } = useInteractions();
  const navigate = useNavigate();

  const [inspections, setInspections] = useState([]);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  const [detail, setDetail] = useState(null);
  const [inspectItem, setInspectItem] = useState(null);
  const [approvedQuantity, setApprovedQuantity] = useState('');
  const [rejectedQuantity, setRejectedQuantity] = useState('0');
  const [rejectionAction, setRejectionAction] = useState('rejected_stock');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [inspectionRows, receiptRows] = await Promise.all([
        getQualityInspections(accessToken),
        getGoodsReceipts(accessToken),
      ]);
      const detailed = await Promise.all(receiptRows.map((row) => getGoodsReceipt(row.id, accessToken)));
      const pendingRows = detailed.flatMap((grn) =>
        (grn.items || [])
          .filter((item) => item.qcStatus === 'pending' && grn.status !== 'cancelled')
          .map((item) => ({
            ...item,
            grnNumber: grn.grnNumber,
            receivedDate: grn.receivedDate,
            supplierName: grn.supplierName,
            grnStatus: grn.status,
          }))
      );
      setInspections(inspectionRows);
      setPending(pendingRows);
    } catch (err) {
      toastError(err.message || 'Failed to load quality inspections');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => { load(); }, [load]);

  const openInspect = (item) => {
    setInspectItem(item);
    setApprovedQuantity(item.receivedQuantity);
    setRejectedQuantity('0');
    setRejectionAction('rejected_stock');
    setRemarks('');
    setFormError('');
  };

  const handleInspect = async (e) => {
    e.preventDefault();
    if (!inspectItem) return;
    const approved = Number(approvedQuantity || 0);
    const rejected = Number(rejectedQuantity || 0);
    if (approved < 0 || rejected < 0 || approved + rejected === 0) {
      setFormError('Enter an approved or rejected quantity');
      return;
    }
    if (approved + rejected > Number(inspectItem.receivedQuantity)) {
      setFormError('Inspected quantity exceeds the received quantity');
      return;
    }

    setSubmitting(true);
    try {
      await createQualityInspection({
        goodsReceiptItemId: inspectItem.id,
        approvedQuantity: approved,
        rejectedQuantity: rejected,
        status: statusFor(approved, rejected),
        rejectionAction: rejected > 0 ? rejectionAction : null,
        remarks: remarks || null,
      }, accessToken);
      success('Inspection saved. Approved quantity is now in stock.');
      setInspectItem(null);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to save inspection');
    } finally {
      setSubmitting(false);
    }
  };

  const historyColumns = [
    {
      key: 'inspectedAt',
      label: 'Inspected',
      render: (value, row) => (
        <div>
          <span className={local.docNumber}>{row.grnNumber}</span>
          <span className={local.subtleBlock}>{formatDateTime(value)}</span>
        </div>
      ),
    },
    { key: 'rawMaterialName', label: 'Material', render: (value, row) => <div>{value || '—'}<span className={local.subtleBlock}>{row.sku}</span></div> },
    { key: 'batchNumber', label: 'Batch' },
    { key: 'status', label: 'Result', width: '150px', render: (value) => <StatusBadge status={value} /> },
    { key: 'approvedQuantity', label: 'Approved', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
    { key: 'rejectedQuantity', label: 'Rejected', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
    { key: 'inspectedByEmail', label: 'Inspected by', render: (value) => value || '—' },
  ];

  const pendingColumns = [
    { key: 'grnNumber', label: 'GRN' },
    { key: 'rawMaterialName', label: 'Material', render: (value, row) => <div>{value}<span className={local.subtleBlock}>{row.sku}</span></div> },
    { key: 'batchNumber', label: 'Batch' },
    { key: 'receivedQuantity', label: 'Received', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
    {
      key: 'id',
      label: '',
      width: '110px',
      render: (_, row) => (
        <div className={moduleStyles.actions} onClick={(e) => e.stopPropagation()}>
          <button className={moduleStyles.editBtn} onClick={() => openInspect(row)}>Inspect</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={moduleStyles.pageHeader}>
        <div>
          <h2 className={local.sectionTitle}>Quality Inspections</h2>
          <p className={moduleStyles.pageSub}>Approved quantity posts to batch stock and the movement ledger.</p>
        </div>
        <button className={moduleStyles.editBtn} onClick={() => navigate('/inventory/stock')}>View stock</button>
      </div>

      <div className={local.workflowStrip}>
        <div className={local.step}>
          <span className={local.stepLabel}>Pending lines</span>
          <span className={local.stepValue}>{pending.length}</span>
        </div>
        <div className={local.step}>
          <span className={local.stepLabel}>Inspections recorded</span>
          <span className={local.stepValue}>{inspections.length}</span>
        </div>
        <div className={local.step}>
          <span className={local.stepLabel}>Approved units</span>
          <span className={local.stepValue}>
            {formatQty(inspections.reduce((sum, row) => sum + Number(row.approvedQuantity || 0), 0))}
          </span>
        </div>
        <div className={local.step}>
          <span className={local.stepLabel}>Rejected units</span>
          <span className={local.stepValue}>
            {formatQty(inspections.reduce((sum, row) => sum + Number(row.rejectedQuantity || 0), 0))}
          </span>
        </div>
      </div>

      {loading ? (
        <div className={moduleStyles.loading}>Loading...</div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className={`${local.panel} ${local.sectionGap}`}>
              <div className={local.panelHeader}>
                <div>
                  <h3 className={local.sectionTitle}>Pending receipt lines</h3>
                  <p className={local.hint}>Inspect each line once. Approved quantity becomes available stock.</p>
                </div>
              </div>
              <Table columns={pendingColumns} data={pending} emptyMessage="No pending lines." />
            </div>
          )}

          <div>
            <h3 className={local.sectionTitle}>Inspection history</h3>
            <Table
              columns={historyColumns}
              data={inspections}
              onRowClick={setDetail}
              searchable
              searchKeys={['grnNumber', 'rawMaterialName', 'batchNumber', 'status', 'inspectedByEmail']}
              searchPlaceholder="Search inspections..."
              emptyMessage="No inspections recorded yet."
            />
          </div>
        </>
      )}

      <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title={`QC · ${detail?.grnNumber || 'inspection'}`} wide>
        {detail && (
          <div>
            <div className={local.detailGrid}>
              <DetailField label="Result"><StatusBadge status={detail.status} /></DetailField>
              <DetailField label="Material">{detail.rawMaterialName || '—'}</DetailField>
              <DetailField label="Batch">{detail.batchNumber || '—'}</DetailField>
              <DetailField label="Inspected">{formatDateTime(detail.inspectedAt)}</DetailField>
              <DetailField label="Inspected by">{detail.inspectedByEmail || '—'}</DetailField>
              <DetailField label="Rejection action">{detail.rejectionAction ? detail.rejectionAction.replace('_', ' ') : '—'}</DetailField>
            </div>
            <div className={local.detailGrid}>
              <DetailField label="Approved">{formatQty(detail.approvedQuantity)} {detail.unitSymbol}</DetailField>
              <DetailField label="Rejected">{formatQty(detail.rejectedQuantity)} {detail.unitSymbol}</DetailField>
            </div>
            {detail.remarks && <p className={local.note}>{detail.remarks}</p>}
            <div className={moduleStyles.formActions}>
              <button className={moduleStyles.editBtn} onClick={() => navigate('/inventory/stock')}>View stock</button>
              <button className={moduleStyles.cancelBtn} onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(inspectItem)} onClose={() => setInspectItem(null)} title="Record quality inspection">
        {inspectItem && (
          <form onSubmit={handleInspect} className={moduleStyles.form}>
            {formError && <div className={moduleStyles.error}>{formError}</div>}
            <p className={local.note}>
              {inspectItem.grnNumber} · {inspectItem.rawMaterialName} · Batch {inspectItem.batchNumber}<br />
              Received {formatQty(inspectItem.receivedQuantity)} {inspectItem.unitSymbol}
            </p>
            <div className={moduleStyles.formGrid}>
              <FormField label="Approved quantity" type="number" value={approvedQuantity}
                onChange={(e) => setApprovedQuantity(e.target.value)} required />
              <FormField label="Rejected quantity" type="number" value={rejectedQuantity}
                onChange={(e) => setRejectedQuantity(e.target.value)} required />
            </div>
            <FormField
              label="Rejected action"
              type="select"
              value={rejectionAction}
              onChange={(e) => setRejectionAction(e.target.value)}
              options={[
                { value: 'rejected_stock', label: 'Move to rejected stock' },
                { value: 'return_supplier', label: 'Return to supplier' },
              ]}
            />
            <FormField label="Remarks" type="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
            <div className={moduleStyles.formActions}>
              <button type="button" className={moduleStyles.cancelBtn} onClick={() => setInspectItem(null)}>Cancel</button>
              <button type="submit" className={moduleStyles.primaryBtn} disabled={submitting}>
                {submitting ? 'Saving...' : 'Save inspection'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
