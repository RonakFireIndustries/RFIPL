import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import moduleStyles from '../ModulePage.module.css';
import local from './Purchasing.module.css';
import {
  adjustFinishedStock,
  getFinishedBatches,
  getFinishedStock,
  getFinishedStockSummary,
  setFinishedStock,
} from '@/api/inventory';
import { formatDate, formatMoney, formatQty } from './utils';

export default function ProductionStock() {
  const { accessToken } = useAuth();
  const { success, error: toastError } = useInteractions();

  const [summary, setSummary] = useState([]);
  const [stockRows, setStockRows] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  const [adjusting, setAdjusting] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [summaryRows, stockList, batchList] = await Promise.all([
        getFinishedStockSummary(accessToken),
        getFinishedStock(accessToken),
        getFinishedBatches(accessToken),
      ]);
      setSummary(summaryRows);
      setStockRows(stockList);
      setBatches(batchList);
    } catch (err) {
      toastError(err.message || 'Failed to load finished goods stock');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => { load(); }, [load]);

  const lowStock = summary.filter((row) => (
    Number(row.minimumStockLevel) > 0 && Number(row.quantity) < Number(row.minimumStockLevel)
  ));

  const openAdjust = (mode, row) => {
    setAdjusting({ mode, row });
    setQuantity(mode === 'set' ? String(row.quantity) : '');
    setRemarks('');
    setFormError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!adjusting) return;
    setFormError('');
    const value = Number(quantity);
    if (quantity === '' || !Number.isFinite(value)) {
      setFormError('Enter a valid quantity');
      return;
    }
    if (adjusting.mode === 'adjust' && value === 0) {
      setFormError('Adjustment quantity cannot be zero');
      return;
    }
    if (adjusting.mode === 'set' && value < 0) {
      setFormError('Quantity cannot be negative');
      return;
    }

    setSubmitting(true);
    try {
      if (adjusting.mode === 'set') {
        await setFinishedStock(adjusting.row.id, {
          quantity: value,
          remarks: remarks || `Stock set to ${value} for batch ${adjusting.row.batchNumber}`,
        }, accessToken);
        success(`${adjusting.row.batchNumber} quantity set to ${value}`);
      } else {
        await adjustFinishedStock({
          finishedProductId: adjusting.row.finishedProductId,
          batchId: adjusting.row.batchId,
          quantity: value,
          remarks: remarks || `Manual adjustment for batch ${adjusting.row.batchNumber}`,
        }, accessToken);
        success(`${adjusting.row.batchNumber} adjusted by ${value > 0 ? '+' : ''}${value}`);
      }
      setAdjusting(null);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to update finished stock');
    } finally {
      setSubmitting(false);
    }
  };

  const summaryColumns = [
    {
      key: 'name',
      label: 'Product',
      render: (value, row) => (
        <div>
          <span>{value}</span>
          <span className={local.subtleBlock}>{row.sku}</span>
        </div>
      ),
    },
    { key: 'quantity', label: 'In stock', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
    { key: 'minimumStockLevel', label: 'Minimum', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
    { key: 'batchCount', label: 'Batches', align: 'right', render: (v) => formatQty(v) },
    {
      key: 'id',
      label: 'Status',
      width: '120px',
      render: (_, row) => (Number(row.quantity) < Number(row.minimumStockLevel)
        ? <span className={local.badgeAmber}>Low stock</span>
        : <span className={moduleStyles.badgeGreen}>OK</span>),
    },
  ];

  const batchColumns = [
    {
      key: 'batchNumber',
      label: 'Batch',
      render: (value, row) => (
        <div>
          <span className={local.docNumber}>{value}</span>
          <span className={local.subtleBlock}>{row.productionNumber || 'Manual batch'}</span>
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
    { key: 'manufacturingDate', label: 'Manufactured', render: (v) => formatDate(v) },
    { key: 'originalQuantity', label: 'Original', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
    { key: 'currentQuantity', label: 'Current', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
    { key: 'manualCost', label: 'Unit cost', align: 'right', render: (v) => formatMoney(v) },
  ];

  const stockColumns = [
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
    { key: 'batchNumber', label: 'Batch' },
    { key: 'manufacturingDate', label: 'Manufactured', render: (v) => formatDate(v) },
    { key: 'quantity', label: 'Quantity', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
    { key: 'manualCost', label: 'Unit cost', align: 'right', render: (v) => formatMoney(v) },
    {
      key: 'id',
      label: 'Actions',
      width: '180px',
      render: (_, row) => (
        <div className={moduleStyles.actions} onClick={(e) => e.stopPropagation()}>
          <button className={moduleStyles.editBtn} onClick={() => openAdjust('adjust', row)}>Adjust</button>
          <button className={moduleStyles.editBtn} onClick={() => openAdjust('set', row)}>Set</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={moduleStyles.pageHeader}>
        <div>
          <h2 className={local.sectionTitle}>Finished Stock</h2>
          <p className={moduleStyles.pageSub}>Batch-tracked finished goods. Every adjustment is written to the finished stock ledger.</p>
        </div>
      </div>

      <div className={local.workflowStrip}>
        <div className={local.step}>
          <span className={local.stepLabel}>Products</span>
          <span className={local.stepValue}>{summary.length}</span>
        </div>
        <div className={local.step}>
          <span className={local.stepLabel}>Batches</span>
          <span className={local.stepValue}>{batches.length}</span>
        </div>
        <div className={local.step}>
          <span className={local.stepLabel}>Stock rows</span>
          <span className={local.stepValue}>{stockRows.length}</span>
        </div>
        <div className={local.step}>
          <span className={local.stepLabel}>Low stock</span>
          <span className={local.stepValue}>{lowStock.length}</span>
        </div>
      </div>

      {loading ? (
        <div className={moduleStyles.loading}>Loading...</div>
      ) : (
        <>
          <div className={local.panel}>
            <div className={local.panelHeader}>
              <div>
                <h3 className={local.sectionTitle}>Stock summary</h3>
                <p className={local.hint}>Quantity is summed across all batches for each product.</p>
              </div>
            </div>
            <Table columns={summaryColumns} data={summary} emptyMessage="No finished products yet." />
          </div>

          <div className={`${local.panel} ${local.sectionGap}`}>
            <div className={local.panelHeader}>
              <div>
                <h3 className={local.sectionTitle}>Batch quantities</h3>
                <p className={local.hint}>Batches are created when production orders are completed.</p>
              </div>
            </div>
            <Table
              columns={batchColumns}
              data={batches}
              searchable
              searchKeys={['batchNumber', 'finishedProductName', 'sku', 'productionNumber']}
              searchPlaceholder="Search batches..."
              emptyMessage="No finished batches yet."
            />
          </div>

          <div className={`${local.panel} ${local.sectionGap}`}>
            <div className={local.panelHeader}>
              <div>
                <h3 className={local.sectionTitle}>Current stock by batch</h3>
                <p className={local.hint}>Use Adjust for a signed delta or Set to enter an exact quantity.</p>
              </div>
            </div>
            <Table
              columns={stockColumns}
              data={stockRows}
              searchable
              searchKeys={['finishedProductName', 'sku', 'batchNumber']}
              searchPlaceholder="Search finished stock..."
              emptyMessage="No finished stock yet. Complete a production order to post stock."
            />
          </div>
        </>
      )}

      <Modal
        isOpen={Boolean(adjusting)}
        onClose={() => setAdjusting(null)}
        title={adjusting?.mode === 'set' ? `Set quantity · ${adjusting.row.batchNumber}` : `Adjust stock · ${adjusting?.row.batchNumber || ''}`}
      >
        {adjusting && (
          <form onSubmit={handleSubmit} className={moduleStyles.form}>
            {formError && <div className={moduleStyles.error}>{formError}</div>}
            <p className={local.note}>
              {adjusting.row.finishedProductName} · Batch {adjusting.row.batchNumber}<br />
              Current quantity: {formatQty(adjusting.row.quantity)} {adjusting.row.unitSymbol || ''}
            </p>
            <FormField
              label={adjusting.mode === 'set' ? 'New quantity' : 'Adjustment (±)'}
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={adjusting.mode === 'set' ? '0' : 'e.g. 5 or -5'}
              required
            />
            <FormField label="Remarks" type="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
            <div className={moduleStyles.formActions}>
              <button type="button" className={moduleStyles.cancelBtn} onClick={() => setAdjusting(null)}>Cancel</button>
              <button type="submit" className={moduleStyles.primaryBtn} disabled={submitting}>
                {submitting ? 'Saving...' : adjusting.mode === 'set' ? 'Set quantity' : 'Apply adjustment'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
