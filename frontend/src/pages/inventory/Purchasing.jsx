import { useState } from 'react';
import moduleStyles from '../ModulePage.module.css';
import local from './Purchasing.module.css';
import PurchasingRequests from './PurchasingRequests';
import PurchasingOrders from './PurchasingOrders';
import PurchasingReceipts from './PurchasingReceipts';
import PurchasingQC from './PurchasingQC';

const TABS = [
  { key: 'requests', label: 'Purchase Requests', Component: PurchasingRequests },
  { key: 'orders', label: 'Purchase Orders', Component: PurchasingOrders },
  { key: 'receipts', label: 'Goods Receipts', Component: PurchasingReceipts },
  { key: 'qc', label: 'Quality Inspections', Component: PurchasingQC },
];

export default function Purchasing() {
  const [tab, setTab] = useState('requests');
  const Active = TABS.find((item) => item.key === tab).Component;

  return (
    <div>
      <div className={moduleStyles.pageHeader}>
        <div>
          <h1 className={moduleStyles.pageTitle}>Purchasing & QC</h1>
          <p className={moduleStyles.pageSub}>
            Requests → approvals → orders → receipts → quality checks. Approved stock posts automatically.
          </p>
        </div>
      </div>

      <div className={local.tabs} role="tablist" aria-label="Purchasing sections">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            className={`${local.tab} ${tab === item.key ? local.tabActive : ''}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Active />
    </div>
  );
}
