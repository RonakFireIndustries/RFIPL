import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import {
  adjustRawMaterialStock,
  getLowStockItems,
  getRawMaterialStock,
  getRawMaterialStockSummary,
  setRawMaterialStock,
} from '@/api/inventory';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from '../ModulePage.module.css';
import local from './Inventory.module.css';
import { formatDateTime, formatQty } from './utils';

export default function Stock() {
  const { accessToken } = useAuth();
  const { success, error: toastError } = useInteractions();
  const navigate = useNavigate();

  const [stock, setStock] = useState([]);
  const [summary, setSummary] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('delta');
  const [quantity, setQuantity] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [stockRows, stockSummary, low] = await Promise.all([
        getRawMaterialStock(accessToken),
        getRawMaterialStockSummary(accessToken),
        getLowStockItems(accessToken),
      ]);
      setStock(stockRows);
      setSummary(stockSummary);
      setLowStock(low);
    } catch (err) {
      toastError(err.message || 'Failed to load stock');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const lowStockIds = useMemo(() => new Set(lowStock.map((row) => String(row.id))), [lowStock]);

  const openAdjust = (row, nextMode = 'delta') => {
    setSelected(row);
    setMode(nextMode);
    setQuantity('');
    setRemarks('');
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    if (!selected) return;

    if (quantity === '' || Number.isNaN(Number(quantity))) {
      setFormError('Enter a quantity');
      return;
    }
    if (mode === 'delta' && Number(quantity) === 0) {
      setFormError('Enter a non-zero adjustment (use a negative value to remove stock)');
      return;
    }
    if (mode === 'set' && Number(quantity) < 0) {
      setFormError('Quantity cannot be negative');
      return;
    }

    setSubmitting(true);
    try {
      if (mode === 'delta') {
        await adjustRawMaterialStock(
          {
            rawMaterialId: selected.rawMaterialId,
            batchId: selected.batchId,
            quantity,
            remarks: remarks || 'Manual stock update',
          },
          accessToken
        );
        success(`Stock for ${selected.rawMaterialName} adjusted by ${formatQty(quantity)}`);
      } else {
        await setRawMaterialStock(
          selected.id,
          { quantity, remarks: remarks || 'Stock quantity set manually' },
          accessToken
        );
        success(`Stock for ${selected.rawMaterialName} set to ${formatQty(quantity)}`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to update stock');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    {
      key: 'rawMaterialName',
      label: 'Material',
      render: (value, row) => (
        <div>
          <span className={local.materialName}>{value || '—'}</span>
          <span className={local.materialSku}>{row.sku}</span>
        </div>
      ),
    },
    { key: 'batchNumber', label: 'Batch', width: '140px', render: (value) => value || '—' },
    {
      key: 'quantity',
      label: 'Quantity',
      width: '150px',
      align: 'right',
      render: (value, row) => (
        <span className={local.mono}>
          {formatQty(value)} {row.unitSymbol || ''}
        </span>
      ),
    },
    {
      key: 'rawMaterialId',
      label: 'Level',
      width: '120px',
      render: (_, row) =>
        lowStockIds.has(String(row.rawMaterialId)) ? (
          <span className={styles.badgeRed}>Low stock</span>
        ) : (
          <span className={styles.badgeGreen}>OK</span>
        ),
    },
    {
      key: 'updatedAt',
      label: 'Last updated',
      width: '170px',
      render: (value) => formatDateTime(value),
    },
    {
      key: 'id',
      label: '',
      width: '150px',
      render: (_, row) => (
        <div className={styles.actions}>
          <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); openAdjust(row, 'delta'); }}>
            Adjust
          </button>
          <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); openAdjust(row, 'set'); }}>
            Set
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Stock</h1>
          <p className={styles.pageSub}>Single store — one quantity per material and batch</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => navigate('/inventory/batches')}>
          + Record Batch
        </button>
      </div>

      <div className={local.statsGrid}>
        <div className={local.statCard}>
          <span className={local.statLabel}>Stock rows</span>
          <span className={local.statValue}>{stock.length}</span>
          <span className={local.statHint}>Material + batch combinations</span>
        </div>
        <div className={local.statCard}>
          <span className={local.statLabel}>Materials tracked</span>
          <span className={local.statValue}>{summary.length}</span>
          <span className={local.statHint}>Active raw materials</span>
        </div>
        <div className={local.statCard}>
          <span className={local.statLabel}>Low stock</span>
          <span className={local.statValue}>{lowStock.length}</span>
          <span className={local.statHint}>Below minimum level</span>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={stock}
          searchable
          searchKeys={['rawMaterialName', 'sku', 'batchNumber']}
          searchPlaceholder="Search by material, SKU or batch..."
          emptyMessage="No stock yet. Receive a batch to create stock rows."
        />
      )}

      {lowStock.length > 0 && (
        <div className={`${local.panel} ${local.sectionGap}`}>
          <div className={local.panelHeader}>
            <div>
              <h2 className={local.panelTitle}>Low stock</h2>
              <p className={local.panelSub}>Materials at or below their minimum stock level.</p>
            </div>
          </div>
          <Table
            columns={[
              {
                key: 'name',
                label: 'Material',
                render: (value, row) => (
                  <div>
                    <span className={local.materialName}>{value}</span>
                    <span className={local.materialSku}>{row.sku}</span>
                  </div>
                ),
              },
              {
                key: 'totalStock',
                label: 'In stock',
                align: 'right',
                render: (value, row) => <span className={local.mono}>{formatQty(value)} {row.unitSymbol || ''}</span>,
              },
              {
                key: 'minimumStockLevel',
                label: 'Minimum',
                align: 'right',
                render: (value, row) => <span className={local.mono}>{formatQty(value)} {row.unitSymbol || ''}</span>,
              },
              {
                key: 'reorderLevel',
                label: 'Reorder at',
                align: 'right',
                render: (value, row) => <span className={local.mono}>{formatQty(value)} {row.unitSymbol || ''}</span>,
              },
            ]}
            data={lowStock}
            emptyMessage="Nothing is below its minimum level."
          />
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={mode === 'delta' ? 'Adjust stock' : 'Set stock quantity'}
      >
        {selected && (
          <form onSubmit={handleSubmit} className={styles.form}>
            {formError && <div className={styles.error}>{formError}</div>}

            <div className={local.note}>
              <strong>{selected.rawMaterialName}</strong> · Batch {selected.batchNumber || '—'} · Current
              quantity {formatQty(selected.quantity)} {selected.unitSymbol || ''}
            </div>

            <FormField
              label={mode === 'delta' ? 'Adjustment (+ / -)' : 'New quantity'}
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={mode === 'delta' ? 'e.g. 25 or -10' : 'e.g. 100'}
              required
            />

            <FormField
              label="Remarks"
              type="textarea"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={mode === 'delta' ? 'Reason for adjustment' : 'Reason for setting this quantity'}
            />

            <p className={local.hint}>
              {mode === 'delta'
                ? 'Positive values add stock, negative values remove stock. Movement is recorded in the ledger.'
                : 'Sets the exact quantity for this batch and records the difference in the ledger.'}
            </p>

            <div className={styles.formActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
              <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                {submitting ? 'Saving...' : mode === 'delta' ? 'Apply adjustment' : 'Set quantity'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
