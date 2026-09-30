import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getNotificationRules, updateNotificationRule } from '@/api/inventory';
import Table from '@/components/ui/Table';
import { StatusPill } from './shared';
import styles from '@/pages/ModulePage.module.css';

export default function NotificationRulesTab() {
  const { accessToken } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getNotificationRules(accessToken)); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const toggle = async (row) => {
    try {
      const updated = await updateNotificationRule(row.id, { isEnabled: row.isEnabled ? 0 : 1 }, accessToken);
      setData((d) => d.map((r) => (r.id === row.id ? updated : r)));
    } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'notificationType', label: 'Notification Type', render: (v) => <StatusPill value={String(v || '').replace(/_/g, ' ')} color="#6b7280" capitalize={false} /> },
    { key: 'isEnabled', label: 'Status', width: '110px', render: (v) => (
      <StatusPill value={v ? 'enabled' : 'disabled'} color={v ? '#16a34a' : '#6b7280'} capitalize={false} />
    )},
    { key: 'id', label: '', width: '140px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => toggle(row)}>{row.isEnabled ? 'Disable' : 'Enable'}</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Notification Rules</h2>
          <p className={styles.pageSub}>Toggles which inventory alerts are pushed to employees</p>
        </div>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No notification rules configured" />
      )}
    </div>
  );
}