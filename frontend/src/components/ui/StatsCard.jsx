import styles from './StatsCard.module.css';

export default function StatsCard({ label, value, color = '#6b7280', onClick, active }) {
  return (
    <div
      className={`${styles.card} ${onClick ? styles.clickable : ''} ${active ? styles.active : ''}`}
      onClick={onClick}
    >
      <div className={styles.value} style={{ color }}>{value}</div>
      <div className={styles.label}>{label}</div>
    </div>
  );
}