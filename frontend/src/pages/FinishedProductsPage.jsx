import { useState } from 'react';
import { FinishedProductsSection, BillsOfMaterialsSection } from './inventory/MaterialsTab';
import { FinishedStockSection } from './inventory/StockTab';
import ProductionTab from './inventory/ProductionTab';
import { TabBar } from './inventory/shared';

const TABS = [
  { key: 'products', label: 'Finished Products' },
  { key: 'bom', label: 'Bills of Materials' },
  { key: 'stock', label: 'Stock' },
  { key: 'production', label: 'Production' },
];

export default function FinishedProductsPage() {
  const [active, setActive] = useState('products');

  return (
    <div style={{ padding: '24px 28px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: '#111111' }}>Finished Product Inventory</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#9ca3af' }}>
          Finished goods, BOMs, stock and production orders
        </p>
      </div>
      <TabBar tabs={TABS} current={active} onChange={setActive} />
      {active === 'products' && <FinishedProductsSection />}
      {active === 'bom' && <BillsOfMaterialsSection />}
      {active === 'stock' && <FinishedStockSection />}
      {active === 'production' && <ProductionTab />}
    </div>
  );
}