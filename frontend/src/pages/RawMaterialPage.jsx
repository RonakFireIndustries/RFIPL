import { useState } from 'react';
import MasterDataTab from './inventory/MasterDataTab';
import StoreLocationsSection from './inventory/StoreLocationsSection';
import { RawMaterialsSection } from './inventory/MaterialsTab';
import { RawStockSection } from './inventory/StockTab';
import PurchasingTab from './inventory/PurchasingTab';
import { TabBar } from './inventory/shared';

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
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111111' }}>Raw Material Inventory</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
          Master data, raw materials, stock and procurement
        </p>
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