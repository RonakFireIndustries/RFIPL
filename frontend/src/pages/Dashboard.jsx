import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import { useInteractions } from '@/components/ui/interactions';

const QUICK_ACTIONS = [
  { to: '/purchase-orders', label: 'New Purchase Order', desc: 'Create a PO from a supplier', icon: '📦', accent: '#2563eb' },
  { to: '/sales-orders', label: 'New Sales Order', desc: 'Create an SO for a customer', icon: '🧾', accent: '#15803d' },
  { to: '/inventory/raw-materials/new', label: 'Add Raw Material', desc: 'Register material with SKU', icon: '🏭', accent: '#b45309' },
  { to: '/inventory/finished-products/new', label: 'Add Finished Product', desc: 'Register product with code', icon: '📦', accent: '#7c3aed' },
  { to: '/inventory/movements', label: 'Record Movement', desc: 'Stock in/out or adjustment', icon: '🔄', accent: '#0d9488' },
  { to: '/employees', label: 'Add Employee', desc: 'Onboard a new employee', icon: '👤', accent: '#dc2626' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { success } = useInteractions();

  return (
    <div>
      <h1 style={{ margin: '0 0 8px', fontSize: '24px', fontWeight: 600, color: '#111111' }}>
        Dashboard
      </h1>
      <p style={{ color: '#6b7280', fontSize: '14px' }}>
        Welcome to RFIPL HRMS & Inventory Management System — jump straight into work.
      </p>

      <div className={styles.grid}>
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.to}
            type="button"
            className={styles.card}
            onClick={() => { navigate(a.to); success(`Opening ${a.label.toLowerCase()}`); }}
            style={{ '--accent': a.accent }}
          >
            <span className={styles.icon}>{a.icon}</span>
            <span className={styles.cardBody}>
              <strong className={styles.cardLabel}>{a.label}</strong>
              <span className={styles.cardDesc}>{a.desc}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
