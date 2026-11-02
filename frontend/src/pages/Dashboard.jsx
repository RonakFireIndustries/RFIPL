import { useNavigate } from 'react-router-dom';
import styles from './Dashboard.module.css';
import { useInteractions } from '@/components/ui/interactions';

const QUICK_ACTIONS = [
  { to: '/employees', label: 'Add Employee', desc: 'Onboard a new employee', icon: '👤', accent: '#dc2626' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { success } = useInteractions();

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Dashboard</h1>
      <p className={styles.subtitle}>
        Welcome to the RFIPL HRMS Management System — jump straight into work.
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
