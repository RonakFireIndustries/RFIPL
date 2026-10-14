import { useState } from 'react';
import { FinishedProductsSection, BillsOfMaterialsSection } from './inventory/MaterialsTab';
import { FinishedStockSection } from './inventory/StockTab';
import ProductionTab from './inventory/ProductionTab';
import { TabBar } from './inventory/shared';
import styles from './ModulePage.module.css';

const TABS = [
  { key: 'products', label: 'Finished Products' },
  { key: 'bom', label: 'Bills of Materials' },
  { key: 'stock', label: 'Stock' },
  { key: 'production', label: 'Production' },
];

export default function FinishedProductsPage() {
  const [active, setActive] = useState('products');

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Finished Product Inventory</h1>
          <p className={styles.pageSub}>Finished goods, BOMs, stock and production orders</p>
        </div>
      </div>
      <TabBar tabs={TABS} current={active} onChange={setActive} />
      {active === 'products' && <FinishedProductsSection />}
      {active === 'bom' && <BillsOfMaterialsSection />}
      {active === 'stock' && <FinishedStockSection />}
      {active === 'production' && <ProductionTab />}
    </div>
  );
}