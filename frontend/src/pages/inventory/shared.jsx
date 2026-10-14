/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect } from 'react';
import { getInventoryCategories, getInventoryUnits, getSuppliers } from '@/api/inventory';
import styles from '@/pages/ModulePage.module.css';

export function useMasterData(accessToken, categoryType) {
  const [units, setUnits] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([
      getInventoryUnits(accessToken),
      categoryType ? getInventoryCategories(accessToken, { inventoryType: categoryType }) : Promise.resolve([]),
      getSuppliers(accessToken),
    ])
      .then(([u, c, s]) => { setUnits(u); setCategories(c); setSuppliers(s); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, [accessToken, categoryType]);

  return { units, categories, suppliers, ready };
}

export function TabBar({ tabs, current, onChange }) {
  return (
    <div className={styles.tabs}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`${styles.tab} ${current === t.key ? styles.tabActive : ''}`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export const inputStyle = {
  padding: '9px 11px',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-md)',
  fontSize: 'var(--fs-md)',
  color: 'var(--gray-700)',
  background: 'var(--surface)',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const rowGutter = { display: 'flex', flexDirection: 'column', gap: 0 };

export function ItemRowsEditor({ columns, rows, onChange, newRow, addLabel = '+ Add Item' }) {
  const setRow = (i, patch) => onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i) => onChange(rows.filter((_, idx) => idx !== i));
  const add = () => onChange([...rows, newRow()]);

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 12, background: 'var(--surface-alt)' }}>
      {rows.length === 0 && (
        <p style={{ color: 'var(--faint)', fontSize: 13, margin: '0 0 10px' }}>No items added yet.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.map((row, i) => (
          <div
            key={i}
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr)) 32px`,
              gap: 8,
              alignItems: 'end',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--gray-100)',
              borderRadius: 'var(--r-md)',
              padding: 8,
            }}
          >
            {columns.map((c) => {
              const opts = typeof c.options === 'function' ? c.options(row, rows) : c.options;
              return (
                <div key={c.key} style={rowGutter}>
                  <label style={{ fontSize: 11.5, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>
                    {c.label}
                  </label>
                  {c.type === 'select' ? (
                    <select
                      style={inputStyle}
                      value={row[c.key] ?? ''}
                      onChange={(e) => setRow(i, { [c.key]: e.target.value })}
                    >
                      <option value="">Select...</option>
                      {(opts || []).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      style={inputStyle}
                      type={c.type || 'text'}
                      step={c.step}
                      min={c.min}
                      value={row[c.key] ?? ''}
                      placeholder={c.placeholder || ''}
                      onChange={(e) => setRow(i, { [c.key]: c.type === 'number' ? Number(e.target.value) : e.target.value })}
                    />
                  )}
                </div>
              );
            })}
            <button
              onClick={() => removeRow(i)}
              style={{
                height: 34,
                width: 32,
                border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)',
                background: 'var(--surface)',
                color: 'var(--danger)',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
              }}
              title="Remove"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={add}
        style={{
          marginTop: 10,
          padding: '6px 14px',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--r-md)',
          background: 'var(--surface)',
          color: 'var(--accent-strong)',
          fontWeight: 600,
          fontSize: 12.5,
          cursor: 'pointer',
        }}
      >
        {addLabel}
      </button>
    </div>
  );
}

export function StatusPill({ value, color = '#6b7280', capitalize = true }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 10,
        fontSize: 12,
        fontWeight: 600,
        color,
        background: `${color}16`,
        textTransform: capitalize ? 'capitalize' : 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {value === null || value === undefined || value === '' ? '—' : String(value).replace(/_/g, ' ')}
    </span>
  );
}

export const STATUS_COLORS = {
  draft: '#6b7280',
  planned: '#3b82f6',
  pending: '#f59e0b',
  pending_manager: '#f59e0b',
  pending_admin: '#f59e0b',
  manager_approved: '#8b5cf6',
  approved: '#16a34a',
  rejected: '#DC2626',
  cancelled: '#6b7280',
  in_progress: '#3b82f6',
  started: '#3b82f6',
  completed: '#16a34a',
  qc_completed: '#16a34a',
  partially_qc: '#f59e0b',
  partially_received: '#f59e0b',
  received: '#16a34a',
  applied: '#8b5cf6',
};

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

export function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function money(n) {
  const v = Number(n || 0);
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

export const INV_TYPES_LABEL = {
  raw_material: 'Raw Material',
  finished_product: 'Finished Product',
  tool: 'Tool',
  machine: 'Machine',
};

export function invTypeLabel(v) {
  return INV_TYPES_LABEL[v] || v || '—';
}

export function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}