import { useState } from 'react';
import { TabBar } from './inventory/shared';
import MachinesSection from './inventory/machinesTools/MachinesSection';
import ToolsSection from './inventory/machinesTools/ToolsSection';
import ToolStockSection from './inventory/machinesTools/ToolStockSection';
import AssignmentsSection from './inventory/machinesTools/AssignmentsSection';

const TABS = [
  { key: 'machines', label: 'Machines' },
  { key: 'tools', label: 'Tools' },
  { key: 'stock', label: 'Tool Stock' },
  { key: 'assignments', label: 'Assignments' },
];

export default function MachinesToolsPage() {
  const [active, setActive] = useState('machines');

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111111' }}>Machines &amp; Tools</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
          Machines, breakdowns, tools, tool stock and assignments
        </p>
      </div>
      <TabBar tabs={TABS} current={active} onChange={setActive} />
      {active === 'machines' && <MachinesSection />}
      {active === 'tools' && <ToolsSection />}
      {active === 'stock' && <ToolStockSection />}
      {active === 'assignments' && <AssignmentsSection />}
    </div>
  );
}