import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import {
  getLowStockItems,
  getRawMaterialBatches,
  getRawMaterialLedger,
  getRawMaterialStock,
  getRawMaterialStockSummary,
  getSuppliers,
} from '@/api/inventory';
import Table from '@/components/ui/Table';
import styles from '../ModulePage.module.css';
import local from './Inventory.module.css';
import { formatDateTime, formatQty, titleCase } from './utils';

const QUICK_LINKS = [
  { to: '/inventory/purchasing', icon: '🧾', title: 'Purchasing & QC', desc: 'Requests, orders, receipts and inspections' },
  { to: '/inventory/production', icon: '🏭', title: 'Finished Goods & Production', desc: 'Products, BOMs, orders, stock and history' },
  { to: '/inventory/raw-materials', icon: '📦', title: 'Raw materials', desc: 'Add materials, SKUs and supplier pricing' },
  { to: '/inventory/batches', icon: '🧾', title: 'Receive a batch', desc: 'Record new stock with batch and rate' },
  { to: '/inventory/stock', icon: '📊', title: 'Current stock', desc: 'Adjust quantities and watch low stock' },
  { to: '/inventory/ledger', icon: '📜', title: 'Stock ledger', desc: 'Every movement with user and timestamp' },
  { to: '/inventory/units', icon: '⚖️', title: 'Units', desc: 'Units of measure and conversions' },
  { to: '/inventory/suppliers', icon: '🚚', title: 'Suppliers', desc: 'Vendor master and GST details' },
];

function movementBadge(type) {
  if (['opening_stock', 'purchase_receipt', 'qc_approved', 'transfer_in'].includes(type)) {
    return styles.badgeGreen;
  }
  if (['damage', 'loss', 'return_supplier', 'qc_rejected', 'transfer_out', 'production_consumption'].includes(type)) {
    return styles.badgeRed;
  }
  return local.badgeAmber;
}

export default function InventoryOverview() {
  const { accessToken } = useAuth();
  const { error: toastError } = useInteractions();
  const navigate = useNavigate();

  const [summary, setSummary] = useState([]);
  const [lowStock, setLowStock] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [batches, setBatches] = useState([]);
  const [stock, setStock] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [stockSummary, low, supplierList, batchList, stockRows, ledger] = await Promise.all([
        getRawMaterialStockSummary(accessToken),
        getLowStockItems(accessToken),
        getSuppliers(accessToken),
        getRawMaterialBatches(accessToken),
        getRawMaterialStock(accessToken),
        getRawMaterialLedger(accessToken),
      ]);
      setSummary(stockSummary);
      setLowStock(low);
      setSuppliers(supplierList);
      setBatches(batchList);
      setStock(stockRows);
      setRecent(ledger.slice(0, 6));
    } catch (err) {
      toastError(err.message || 'Failed to load inventory overview');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Inventory</h1>
          <p className={styles.pageSub}>Raw material stock at a glance</p>
        </div>
        <button className={styles.primaryBtn} onClick={() => navigate('/inventory/batches')}>
          + Record Batch
        </button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <>
          <div className={local.statsGrid}>
            <div className={local.statCard}>
              <span className={local.statLabel}>Raw materials</span>
              <span className={local.statValue}>{summary.length}</span>
              <span className={local.statHint}>Active materials</span>
            </div>
            <div className={local.statCard}>
              <span className={local.statLabel}>Stock rows</span>
              <span className={local.statValue}>{stock.length}</span>
              <span className={local.statHint}>Material + batch</span>
            </div>
            <div className={local.statCard}>
              <span className={local.statLabel}>Batches</span>
              <span className={local.statValue}>{batches.length}</span>
              <span className={local.statHint}>Received lots</span>
            </div>
            <div className={local.statCard}>
              <span className={local.statLabel}>Suppliers</span>
              <span className={local.statValue}>{suppliers.length}</span>
              <span className={local.statHint}>Vendor records</span>
            </div>
            <div className={local.statCard}>
              <span className={local.statLabel}>Low stock</span>
              <span className={local.statValue}>{lowStock.length}</span>
              <span className={local.statHint}>Need reordering</span>
            </div>
          </div>

          <div className={local.quickGrid}>
            {QUICK_LINKS.map((link) => (
              <button
                key={link.to}
                type="button"
                className={local.quickCard}
                onClick={() => navigate(link.to)}
              >
                <span className={local.quickIcon}>{link.icon}</span>
                <span>
                  <span className={local.quickTitle}>{link.title}</span>
                  <span className={local.quickDesc}>{link.desc}</span>
                </span>
              </button>
            ))}
          </div>

          {lowStock.length > 0 && (
            <div className={`${local.panel} ${local.sectionGap}`}>
              <div className={local.panelHeader}>
                <div>
                  <h2 className={local.panelTitle}>Low stock</h2>
                  <p className={local.panelSub}>Materials at or below their minimum stock level.</p>
                </div>
                <button className={styles.editBtn} onClick={() => navigate('/inventory/stock')}>
                  Open stock
                </button>
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
                    render: (value, row) => (
                      <span className={local.mono}>{formatQty(value)} {row.unitSymbol || ''}</span>
                    ),
                  },
                  {
                    key: 'minimumStockLevel',
                    label: 'Minimum',
                    align: 'right',
                    render: (value, row) => (
                      <span className={local.mono}>{formatQty(value)} {row.unitSymbol || ''}</span>
                    ),
                  },
                  {
                    key: 'reorderLevel',
                    label: 'Reorder at',
                    align: 'right',
                    render: (value, row) => (
                      <span className={local.mono}>{formatQty(value)} {row.unitSymbol || ''}</span>
                    ),
                  },
                ]}
                data={lowStock}
                emptyMessage="Nothing is below its minimum level."
              />
            </div>
          )}

          <div className={`${local.panel} ${local.sectionGap}`}>
            <div className={local.panelHeader}>
              <div>
                <h2 className={local.panelTitle}>Recent stock movements</h2>
                <p className={local.panelSub}>The latest entries from the stock ledger.</p>
              </div>
              <button className={styles.editBtn} onClick={() => navigate('/inventory/ledger')}>
                Open ledger
              </button>
            </div>
            <Table
              columns={[
                {
                  key: 'transactionAt',
                  label: 'When',
                  width: '180px',
                  render: (value) => formatDateTime(value),
                },
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
                {
                  key: 'transactionType',
                  label: 'Movement',
                  width: '170px',
                  render: (value) => <span className={movementBadge(value)}>{titleCase(value)}</span>,
                },
                {
                  key: 'quantityIn',
                  label: 'In',
                  width: '100px',
                  align: 'right',
                  render: (value) => (Number(value) > 0 ? <span className={local.mono}>{formatQty(value)}</span> : '—'),
                },
                {
                  key: 'quantityOut',
                  label: 'Out',
                  width: '100px',
                  align: 'right',
                  render: (value) => (Number(value) > 0 ? <span className={local.mono}>{formatQty(value)}</span> : '—'),
                },
                { key: 'batchNumber', label: 'Batch', width: '130px', render: (value) => value || '—' },
              ]}
              data={recent}
              emptyMessage="No stock movements yet."
            />
          </div>
        </>
      )}
    </div>
  );
}
