import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import { getRawMaterialLedger, getRawMaterials } from '@/api/inventory';
import Table from '@/components/ui/Table';
import styles from '../ModulePage.module.css';
import local from './Inventory.module.css';
import { formatDateTime, formatMoney, formatQty, titleCase } from './utils';

const LEDGER_TYPES = [
  'opening_stock',
  'purchase_receipt',
  'qc_approved',
  'qc_rejected',
  'production_consumption',
  'transfer_out',
  'transfer_in',
  'adjustment',
  'damage',
  'loss',
  'return_supplier',
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

export default function Ledger() {
  const { accessToken } = useAuth();
  const { error: toastError } = useInteractions();

  const [ledger, setLedger] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  const [filters, setFilters] = useState({
    rawMaterialId: '',
    transactionType: '',
    fromDate: '',
    toDate: '',
  });

  const load = useCallback(async () => {
    try {
      const [entries, materialList] = await Promise.all([
        getRawMaterialLedger(accessToken, filters),
        getRawMaterials(accessToken),
      ]);
      setLedger(entries);
      setMaterials(materialList);
    } catch (err) {
      toastError(err.message || 'Failed to load stock ledger');
    } finally {
      setLoading(false);
    }
  }, [accessToken, filters, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const unitByMaterial = useMemo(() => {
    const map = new Map();
    materials.forEach((material) => map.set(String(material.id), material.unitSymbol || ''));
    return map;
  }, [materials]);

  const hasFilters = Object.values(filters).some(Boolean);

  const columns = [
    {
      key: 'transactionAt',
      label: 'When',
      width: '170px',
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
    { key: 'batchNumber', label: 'Batch', width: '120px', render: (value) => value || '—' },
    {
      key: 'transactionType',
      label: 'Movement',
      width: '170px',
      render: (value) => <span className={movementBadge(value)}>{titleCase(value)}</span>,
    },
    {
      key: 'quantityIn',
      label: 'In',
      width: '110px',
      align: 'right',
      render: (value, row) => (
        <span className={local.mono}>
          {Number(value) > 0 ? `${formatQty(value)} ${unitByMaterial.get(String(row.rawMaterialId)) || ''}` : '—'}
        </span>
      ),
    },
    {
      key: 'quantityOut',
      label: 'Out',
      width: '110px',
      align: 'right',
      render: (value, row) => (
        <span className={local.mono}>
          {Number(value) > 0 ? `${formatQty(value)} ${unitByMaterial.get(String(row.rawMaterialId)) || ''}` : '—'}
        </span>
      ),
    },
    {
      key: 'unitCost',
      label: 'Unit cost',
      width: '110px',
      align: 'right',
      render: (value) => <span className={local.mono}>{formatMoney(value)}</span>,
    },
    {
      key: 'createdByEmail',
      label: 'By',
      width: '190px',
      render: (value) => value || <span className={local.subtle}>System</span>,
    },
    { key: 'remarks', label: 'Remarks', render: (value) => value || '—' },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Stock Ledger</h1>
          <p className={styles.pageSub}>{ledger.length} movements</p>
        </div>
      </div>

      <div className={local.filterBar}>
        <div className={local.filterField}>
          <label className={local.filterLabel}>Material</label>
          <select
            className={local.filterInput}
            value={filters.rawMaterialId}
            onChange={(e) => setFilters({ ...filters, rawMaterialId: e.target.value })}
          >
            <option value="">All materials</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} ({material.sku})
              </option>
            ))}
          </select>
        </div>

        <div className={local.filterField}>
          <label className={local.filterLabel}>Movement type</label>
          <select
            className={local.filterInput}
            value={filters.transactionType}
            onChange={(e) => setFilters({ ...filters, transactionType: e.target.value })}
          >
            <option value="">All movements</option>
            {LEDGER_TYPES.map((type) => (
              <option key={type} value={type}>{titleCase(type)}</option>
            ))}
          </select>
        </div>

        <div className={local.filterField}>
          <label className={local.filterLabel}>From</label>
          <input
            className={local.filterInput}
            type="date"
            value={filters.fromDate}
            onChange={(e) => setFilters({ ...filters, fromDate: e.target.value })}
          />
        </div>

        <div className={local.filterField}>
          <label className={local.filterLabel}>To</label>
          <input
            className={local.filterInput}
            type="date"
            value={filters.toDate}
            onChange={(e) => setFilters({ ...filters, toDate: e.target.value })}
          />
        </div>

        {hasFilters && (
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => setFilters({ rawMaterialId: '', transactionType: '', fromDate: '', toDate: '' })}
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={ledger}
          searchable
          searchKeys={['rawMaterialName', 'sku', 'batchNumber', 'transactionType', 'createdByEmail', 'remarks']}
          searchPlaceholder="Search by material, batch, movement or user..."
          emptyMessage="No stock movements match the filters."
        />
      )}
    </div>
  );
}
