import { useState } from 'react';
import { TabBar } from './inventory/shared';
import { TransfersSection, AdjustmentsSection, DamageLossSection } from './inventory/MovementsTab';
import NotificationRulesTab from './inventory/NotificationRulesTab';
import styles from './ModulePage.module.css';

const TABS = [
  { key: 'transfers', label: 'Stock Transfers' },
  { key: 'adjustments', label: 'Stock Adjustments' },
  { key: 'damage', label: 'Damage & Loss' },
  { key: 'alerts', label: 'Alerts' },
];

export default function MovementsPage() {
  const [active, setActive] = useState('transfers');

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Movements</h1>
          <p className={styles.pageSub}>Stock transfers, adjustments, damage &amp; loss and notification alerts</p>
        </div>
      </div>
      <TabBar tabs={TABS} current={active} onChange={setActive} />
      {active === 'transfers' && <TransfersSection />}
      {active === 'adjustments' && <AdjustmentsSection />}
      {active === 'damage' && <DamageLossSection />}
      {active === 'alerts' && <NotificationRulesTab />}
    </div>
  );
}