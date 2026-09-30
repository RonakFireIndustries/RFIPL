import { useState } from 'react';
import { TabBar } from './inventory/shared';
import { TransfersSection, AdjustmentsSection, DamageLossSection } from './inventory/MovementsTab';
import NotificationRulesTab from './inventory/NotificationRulesTab';

const TABS = [
  { key: 'transfers', label: 'Stock Transfers' },
  { key: 'adjustments', label: 'Stock Adjustments' },
  { key: 'damage', label: 'Damage & Loss' },
  { key: 'alerts', label: 'Alerts' },
];

export default function MovementsPage() {
  const [active, setActive] = useState('transfers');

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111111' }}>Movements</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
          Stock transfers, adjustments, damage &amp; loss and notification alerts
        </p>
      </div>
      <TabBar tabs={TABS} current={active} onChange={setActive} />
      {active === 'transfers' && <TransfersSection />}
      {active === 'adjustments' && <AdjustmentsSection />}
      {active === 'damage' && <DamageLossSection />}
      {active === 'alerts' && <NotificationRulesTab />}
    </div>
  );
}