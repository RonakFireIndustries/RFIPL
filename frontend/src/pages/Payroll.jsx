import { useState } from 'react';
import PayrollPeriodsTab from './payroll/PayrollPeriodsTab';
import SalaryComponentsTab from './payroll/SalaryComponentsTab';
import SalaryStructuresTab from './payroll/SalaryStructuresTab';
import PayrollManagementTab from './payroll/PayrollManagementTab';
import styles from './Payroll.module.css';

const TABS = [
  { key: 'periods', label: 'Payroll Periods' },
  { key: 'components', label: 'Salary Components' },
  { key: 'structures', label: 'Salary Structures' },
  { key: 'payroll', label: 'Payroll' },
];

export default function Payroll() {
  const [tab, setTab] = useState('periods');

  return (
    <div>
      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.tabContent}>
        {tab === 'periods' && <PayrollPeriodsTab />}
        {tab === 'components' && <SalaryComponentsTab />}
        {tab === 'structures' && <SalaryStructuresTab />}
        {tab === 'payroll' && <PayrollManagementTab />}
      </div>
    </div>
  );
}