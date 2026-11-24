import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import { useInteractions } from '@/components/ui/interactions';

const QUICK_ACTIONS = [
  { to: '/employees', label: 'Add Employee', desc: 'Onboard a new employee', icon: '👤', accent: '#dc2626' },
  { to: '/inventory/raw-materials', label: 'Add Raw Material', desc: 'Create a material with supplier pricing', icon: '📦', accent: '#0284c7' },
  { to: '/inventory/batches', label: 'Record Batch', desc: 'Receive stock into inventory', icon: '🧾', accent: '#16a34a' },
  { to: '/inventory/stock', label: 'View Stock', desc: 'Check quantities and low stock', icon: '📊', accent: '#7c3aed' },
  { to: '/inventory/purchasing', label: 'Purchasing & QC', desc: 'Requests, orders, receipts and inspections', icon: '🧾', accent: '#0d9488' },
  { to: '/inventory/production', label: 'Finished Goods & Production', desc: 'Products, BOMs, orders and finished stock', icon: '🏭', accent: '#ea580c' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { success } = useInteractions();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.subtitle}>
        Welcome to the RFIPL Management System — HRMS and inventory in one place.
      </p>

      <div className={styles.grid}>
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.to}
            type="button"
            className={styles.card}
            onClick={() => { navigate(a.to); success(`Opening ${a.label.toLowerCase()}`); }}
            style={{ '--card-accent': a.accent }}
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
