import { useState } from 'react';
import { TabBar } from './inventory/shared';
import MachinesSection from './inventory/machinesTools/MachinesSection';
import ToolsSection from './inventory/machinesTools/ToolsSection';
import ToolStockSection from './inventory/machinesTools/ToolStockSection';
import AssignmentsSection from './inventory/machinesTools/AssignmentsSection';
import styles from './ModulePage.module.css';

const TABS = [
  { key: 'machines', label: 'Machines' },
  { key: 'tools', label: 'Tools' },
  { key: 'stock', label: 'Tool Stock' },
  { key: 'assignments', label: 'Assignments' },
];

export default function MachinesToolsPage() {
  const [active, setActive] = useState('machines');

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Machines &amp; Tools</h1>
          <p className={styles.pageSub}>Machines, breakdowns, tools, tool stock and assignments</p>
        </div>
      </div>
      <TabBar tabs={TABS} current={active} onChange={setActive} />
      {active === 'machines' && <MachinesSection />}
      {active === 'tools' && <ToolsSection />}
      {active === 'stock' && <ToolStockSection />}
      {active === 'assignments' && <AssignmentsSection />}
    </div>
  );
}