import { useState } from 'react';
import moduleStyles from '../ModulePage.module.css';
import local from './Purchasing.module.css';
import ProductionProducts from './ProductionProducts';
import ProductionBOMs from './ProductionBOMs';
import ProductionOrders from './ProductionOrders';
import ProductionStock from './ProductionStock';
import ProductionHistory from './ProductionHistory';

const TABS = [
  { key: 'products', label: 'Finished Products', Component: ProductionProducts },
  { key: 'boms', label: 'Bills of Materials', Component: ProductionBOMs },
  { key: 'orders', label: 'Production Orders', Component: ProductionOrders },
  { key: 'stock', label: 'Finished Stock', Component: ProductionStock },
  { key: 'history', label: 'Movement History', Component: ProductionHistory },
];

export default function Production() {
  const [tab, setTab] = useState('orders');
  const Active = TABS.find((item) => item.key === tab).Component;

  return (
    <div>
      <div className={moduleStyles.pageHeader}>
        <div>
          <h1 className={moduleStyles.pageTitle}>Finished Goods & Production</h1>
          <p className={moduleStyles.pageSub}>
            Products, BOM versions, production runs and batch-tracked finished stock.
            Completing an order consumes raw materials FIFO and posts finished stock automatically.
          </p>
        </div>
      </div>

      <div className={local.tabs} role="tablist" aria-label="Production sections">
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
