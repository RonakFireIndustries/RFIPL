import { useState } from 'react';
import MasterDataTab from './inventory/MasterDataTab';
import StoreLocationsSection from './inventory/StoreLocationsSection';
import { RawMaterialsSection } from './inventory/MaterialsTab';
import { RawStockSection } from './inventory/StockTab';
import PurchasingTab from './inventory/PurchasingTab';
import { TabBar } from './inventory/shared';
import styles from './ModulePage.module.css';

const TABS = [
  { key: 'master', label: 'Master Data' },
  { key: 'materials', label: 'Raw Materials' },
  { key: 'locations', label: 'Store Locations' },
  { key: 'stock', label: 'Stock' },
  { key: 'purchasing', label: 'Purchasing' },
];

export default function RawMaterialPage() {
  const [active, setActive] = useState('master');

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Raw Material Inventory</h1>
          <p className={styles.pageSub}>Master data, raw materials, stock and procurement</p>
        </div>
      </div>
      <TabBar tabs={TABS} current={active} onChange={setActive} />
      {active === 'master' && <MasterDataTab />}
      {active === 'materials' && <RawMaterialsSection />}
      {active === 'locations' && <StoreLocationsSection />}
      {active === 'stock' && <RawStockSection />}
      {active === 'purchasing' && <PurchasingTab />}
    </div>
  );
}