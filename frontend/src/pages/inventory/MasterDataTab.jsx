import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getInventoryUnits, createInventoryUnit, updateInventoryUnit, deleteInventoryUnit,
  getInventoryUnit, createUnitConversion, deleteUnitConversion,
  getInventoryCategories, createInventoryCategory, updateInventoryCategory, deleteInventoryCategory,
  getSuppliers, createSupplier, updateSupplier, deleteSupplier,
} from '@/api/inventory';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Drawer from '@/components/ui/Drawer';
import FormField from '@/components/ui/FormField';
import styles from '@/pages/ModulePage.module.css';

const UNIT_TYPES = [
  { value: 'weight', label: 'Weight' },
  { value: 'length', label: 'Length' },
  { value: 'volume', label: 'Volume' },
  { value: 'quantity', label: 'Quantity' },
  { value: 'other', label: 'Other' },
];

const INV_TYPES = [
  { value: 'raw_material', label: 'Raw Material' },
  { value: 'finished_product', label: 'Finished Product' },
  { value: 'tool', label: 'Tool' },
];

function TabBar({ tabs, current, onChange }) {
  return (
    <div className={styles.tabs} style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          style={{
            padding: '8px 16px',
            background: 'none',
            border: 'none',
            borderBottom: `2px solid ${current === t.key ? '#D4AF37' : 'transparent'}`,
            color: current === t.key ? '#D4AF37' : '#6b7280',
            fontWeight: current === t.key ? 600 : 500,
            fontSize: 13.5,
            cursor: 'pointer',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default function MasterDataTab() {
  const { accessToken } = useAuth();
  const [section, setSection] = useState('units');

  const [units, setUnits] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(true);

  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState(null);
  const [unitForm, setUnitForm] = useState({ name: '', symbol: '', unitType: 'quantity', isBaseUnit: false, isActive: true });
  const [unitError, setUnitError] = useState('');
  const [unitSubmitting, setUnitSubmitting] = useState(false);
  const [unitDetail, setUnitDetail] = useState(null);
  const [convForm, setConvForm] = useState({ toUnitId: '', conversionFactor: '' });
  const [convError, setConvError] = useState('');

  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', inventoryType: 'raw_material', description: '', isActive: true });
  const [catError, setCatError] = useState('');
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [cats, setCats] = useState([]);

  const [supModalOpen, setSupModalOpen] = useState(false);
  const [editingSup, setEditingSup] = useState(null);
  const [supForm, setSupForm] = useState({ supplierCode: '', companyName: '', contactPerson: '', phone: '', email: '', address: '', city: '', state: '', country: 'India', pincode: '', gstNumber: '', panNumber: '', isActive: true });
  const [supError, setSupError] = useState('');
  const [supSubmitting, setSupSubmitting] = useState(false);
  const [suppliers, setSuppliers] = useState([]);

  const loadUnits = useCallback(async () => {
    setLoadingUnits(true);
    try { setUnits(await getInventoryUnits(accessToken)); } catch { /* empty */ }
    setLoadingUnits(false);
  }, [accessToken]);

  const loadCats = useCallback(async () => {
    try { setCats(await getInventoryCategories(accessToken)); } catch { /* empty */ }
  }, [accessToken]);

  const loadSuppliers = useCallback(async () => {
    try { setSuppliers(await getSuppliers(accessToken)); } catch { /* empty */ }
  }, [accessToken]);

  useEffect(() => {
    loadUnits(); loadCats(); loadSuppliers();
  }, [loadUnits, loadCats, loadSuppliers, accessToken]);

  const openUnitCreate = () => { setEditingUnit(null); setUnitForm({ name: '', symbol: '', unitType: 'quantity', isBaseUnit: false, isActive: true }); setUnitError(''); setUnitModalOpen(true); };
  const openUnitEdit = (row) => { setEditingUnit(row); setUnitForm({ name: row.name || row.symbol, symbol: row.symbol || row.name, unitType: row.unitType, isBaseUnit: !!row.isBaseUnit, isActive: !!row.isActive }); setUnitError(''); setUnitModalOpen(true); };

  const submitUnit = async (e) => {
    e.preventDefault();
    setUnitError('');
    setUnitSubmitting(true);
    try {
      const payload = { ...unitForm, isBaseUnit: unitForm.isBaseUnit ? 1 : 0, isActive: unitForm.isActive ? 1 : 0 };
      if (editingUnit) await updateInventoryUnit(editingUnit.id, payload, accessToken);
      else await createInventoryUnit(payload, accessToken);
      setUnitModalOpen(false);
      loadUnits();
    } catch (err) { setUnitError(err.message || 'Failed to save unit'); } finally { setUnitSubmitting(false); }
  };

  const openUnitDetail = async (row) => {
    try {
      const d = await getInventoryUnit(row.id, accessToken);
      setUnitDetail(d);
      setConvForm({ toUnitId: '', conversionFactor: '' });
      setConvError('');
    } catch (err) { alert(err.message); }
  };

  const addConversion = async (e) => {
    e.preventDefault();
    setConvError('');
    if (!convForm.toUnitId || !convForm.conversionFactor) { setConvError('Target unit and factor are required'); return; }
    try {
      await createUnitConversion(unitDetail.id, { toUnitId: Number(convForm.toUnitId), conversionFactor: Number(convForm.conversionFactor) }, accessToken);
      const d = await getInventoryUnit(unitDetail.id, accessToken);
      setUnitDetail(d);
      setConvForm({ toUnitId: '', conversionFactor: '' });
    } catch (err) { setConvError(err.message || 'Failed to add conversion'); }
  };

  const removeConversion = async (cv) => {
    if (!confirm('Remove this conversion?')) return;
    try {
      await deleteUnitConversion(unitDetail.id, cv.id, accessToken);
      const d = await getInventoryUnit(unitDetail.id, accessToken);
      setUnitDetail(d);
    } catch (err) { alert(err.message); }
  };

  const deleteUnit = async (row) => {
    if (!confirm(`Delete unit "${row.name}"?`)) return;
    try { await deleteInventoryUnit(row.id, accessToken); loadUnits(); } catch (err) { alert(err.message); }
  };

  const openCatCreate = () => { setEditingCat(null); setCatForm({ name: '', inventoryType: 'raw_material', description: '', isActive: true }); setCatError(''); setCatModalOpen(true); };
  const openCatEdit = (row) => { setEditingCat(row); setCatForm({ name: row.name, inventoryType: row.inventoryType, description: row.description || '', isActive: !!row.isActive }); setCatError(''); setCatModalOpen(true); };

  const submitCat = async (e) => {
    e.preventDefault();
    setCatError('');
    setCatSubmitting(true);
    try {
      const payload = { ...catForm, isActive: catForm.isActive ? 1 : 0 };
      if (editingCat) await updateInventoryCategory(editingCat.id, payload, accessToken);
      else await createInventoryCategory(payload, accessToken);
      setCatModalOpen(false);
      loadCats();
    } catch (err) { setCatError(err.message || 'Failed to save category'); } finally { setCatSubmitting(false); }
  };

  const deleteCat = async (row) => {
    if (!confirm(`Delete category "${row.name}"?`)) return;
    try { await deleteInventoryCategory(row.id, accessToken); loadCats(); } catch (err) { alert(err.message); }
  };

  const openSupCreate = () => { setEditingSup(null); setSupForm({ supplierCode: '', companyName: '', contactPerson: '', phone: '', email: '', address: '', city: '', state: '', country: 'India', pincode: '', gstNumber: '', panNumber: '', isActive: true }); setSupError(''); setSupModalOpen(true); };
  const openSupEdit = (row) => {
    setEditingSup(row);
    setSupForm({ supplierCode: row.supplierCode, companyName: row.companyName, contactPerson: row.contactPerson || '', phone: row.phone || '', email: row.email || '', address: row.address || '', city: row.city || '', state: row.state || '', country: row.country || 'India', pincode: row.pincode || '', gstNumber: row.gstNumber || '', panNumber: row.panNumber || '', isActive: !!row.isActive });
    setSupError('');
    setSupModalOpen(true);
  };

  const submitSup = async (e) => {
    e.preventDefault();
    setSupError('');
    if (!supForm.supplierCode || !supForm.companyName) { setSupError('Supplier code and company name are required'); return; }
    setSupSubmitting(true);
    try {
      const payload = { ...supForm, isActive: supForm.isActive ? 1 : 0 };
      if (editingSup) await updateSupplier(editingSup.id, payload, accessToken);
      else await createSupplier(payload, accessToken);
      setSupModalOpen(false);
      loadSuppliers();
    } catch (err) { setSupError(err.message || 'Failed to save supplier'); } finally { setSupSubmitting(false); }
  };

  const deleteSup = async (row) => {
    if (!confirm(`Delete supplier "${row.companyName}"?`)) return;
    try { await deleteSupplier(row.id, accessToken); loadSuppliers(); } catch (err) { alert(err.message); }
  };

  const unitCols = [
    { key: 'name', label: 'Name', render: (v, r) => v || r.symbol },
    { key: 'symbol', label: 'Symbol', width: '90px', render: (v, r) => v || r.name },
    { key: 'unitType', label: 'Type', width: '110px', render: (v) => <span style={{ textTransform: 'capitalize' }}>{v}</span> },
    { key: 'isBaseUnit', label: 'Base', width: '70px', render: (v) => (v ? <span className={styles.badgeGreen}>Yes</span> : <span style={{ color: '#cbd5e1' }}>—</span>) },
    { key: 'isActive', label: 'Status', width: '90px', render: (v) => <span className={v ? styles.badgeGreen : styles.badgeGray}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'id', label: '', width: '150px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openUnitDetail(row)}>Convert</button>
        <button className={styles.editBtn} onClick={() => openUnitEdit(row)}>Edit</button>
        <button className={styles.deleteBtn} onClick={() => deleteUnit(row)}>Del</button>
      </div>
    )},
  ];

  const catCols = [
    { key: 'name', label: 'Name' },
    { key: 'inventoryType', label: 'Type', width: '150px', render: (v) => (INV_TYPES.find((t) => t.value === v)?.label || v) },
    { key: 'description', label: 'Description' },
    { key: 'isActive', label: 'Status', width: '90px', render: (v) => <span className={v ? styles.badgeGreen : styles.badgeGray}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'id', label: '', width: '130px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openCatEdit(row)}>Edit</button>
        <button className={styles.deleteBtn} onClick={() => deleteCat(row)}>Del</button>
      </div>
    )},
  ];

  const supCols = [
    { key: 'supplierCode', label: 'Code', width: '100px' },
    { key: 'companyName', label: 'Company' },
    { key: 'contactPerson', label: 'Contact', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'phone', label: 'Phone', width: '130px', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'city', label: 'City', width: '110px', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'gstNumber', label: 'GST', width: '150px', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'isActive', label: 'Status', width: '90px', render: (v) => <span className={v ? styles.badgeGreen : styles.badgeGray}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'id', label: '', width: '130px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openSupEdit(row)}>Edit</button>
        <button className={styles.deleteBtn} onClick={() => deleteSup(row)}>Del</button>
      </div>
    )},
  ];

  return (
    <div>
      <TabBar
        tabs={[
          { key: 'units', label: 'Units' },
          { key: 'categories', label: 'Categories' },
          { key: 'suppliers', label: 'Suppliers' },
        ]}
        current={section}
        onChange={setSection}
      />

      {section === 'units' && (
        <div>
          <div className={styles.pageHeader}>
            <div>
              <h2 className={styles.pageTitle}>Units of Measurement</h2>
              <p className={styles.pageSub}>{units.length} units</p>
            </div>
            <button className={styles.primaryBtn} onClick={openUnitCreate}>+ New Unit</button>
          </div>
          {loadingUnits ? <div className={styles.loading}>Loading...</div> : (
            <Table columns={unitCols} data={units} emptyMessage="No units found" />
          )}
        </div>
      )}

      {section === 'categories' && (
        <div>
          <div className={styles.pageHeader}>
            <div>
              <h2 className={styles.pageTitle}>Inventory Categories</h2>
              <p className={styles.pageSub}>{cats.length} categories</p>
            </div>
            <button className={styles.primaryBtn} onClick={openCatCreate}>+ New Category</button>
          </div>
          <Table columns={catCols} data={cats} emptyMessage="No categories found" />
        </div>
      )}

      {section === 'suppliers' && (
        <div>
          <div className={styles.pageHeader}>
            <div>
              <h2 className={styles.pageTitle}>Suppliers</h2>
              <p className={styles.pageSub}>{suppliers.length} suppliers</p>
            </div>
            <button className={styles.primaryBtn} onClick={openSupCreate}>+ New Supplier</button>
          </div>
          <Table columns={supCols} data={suppliers} emptyMessage="No suppliers found" />
        </div>
      )}

      <Modal isOpen={unitModalOpen} onClose={() => setUnitModalOpen(false)} title={editingUnit ? 'Edit Unit' : 'New Unit'}>
        <form onSubmit={submitUnit} className={styles.form}>
          {unitError && <div className={styles.error}>{unitError}</div>}
          <div className={styles.formGrid}>
            <FormField label="Name" value={unitForm.name} onChange={(e) => setUnitForm((p) => ({ ...p, name: e.target.value, symbol: p.symbol || e.target.value.trim().toUpperCase() }))} placeholder="e.g. Kilogram" required />
            <FormField label="Symbol" value={unitForm.symbol} onChange={(e) => setUnitForm({ ...unitForm, symbol: e.target.value })} placeholder="e.g. KG" required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Unit Type" type="select" value={unitForm.unitType} onChange={(e) => setUnitForm({ ...unitForm, unitType: e.target.value })} options={UNIT_TYPES} required />
            <div className={styles.checkGroup}>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={unitForm.isBaseUnit} onChange={(e) => setUnitForm({ ...unitForm, isBaseUnit: e.target.checked })} />
                Base unit
              </label>
              <label className={styles.checkLabel}>
                <input type="checkbox" checked={unitForm.isActive} onChange={(e) => setUnitForm({ ...unitForm, isActive: e.target.checked })} />
                Active
              </label>
            </div>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setUnitModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={unitSubmitting}>{unitSubmitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!unitDetail} onClose={() => setUnitDetail(null)} title={unitDetail ? `Conversions: ${unitDetail.name} (${unitDetail.symbol})` : 'Conversions'} width={480}>
        {unitDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              {!unitDetail.conversions?.length ? (
                <p className={styles.emptyText}>No conversions yet.</p>
              ) : (
                unitDetail.conversions.map((cv) => (
                  <div key={cv.id} className={styles.compItem}>
                    <span className={styles.compName}>
                      1 {cv.fromUnitSymbol || cv.fromUnitName} = {cv.conversionFactor} {cv.toUnitSymbol || cv.toUnitName}
                    </span>
                    <button className={styles.deleteBtn} onClick={() => removeConversion(cv)}>Remove</button>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={addConversion} className={styles.form} style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
              {convError && <div className={styles.error}>{convError}</div>}
              <div className={styles.formGrid}>
                <FormField label="Target Unit" type="select" value={convForm.toUnitId} onChange={(e) => setConvForm({ ...convForm, toUnitId: e.target.value })} options={units.filter((u) => u.id !== unitDetail.id).map((u) => ({ value: String(u.id), label: `${u.name} (${u.symbol})` }))} required />
                <FormField label="Factor" type="number" step="any" min="0" value={convForm.conversionFactor} onChange={(e) => setConvForm({ ...convForm, conversionFactor: e.target.value })} placeholder="e.g. 1000" required />
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn}>Add Conversion</button>
              </div>
            </form>
          </div>
        )}
      </Drawer>

      <Modal isOpen={catModalOpen} onClose={() => setCatModalOpen(false)} title={editingCat ? 'Edit Category' : 'New Category'}>
        <form onSubmit={submitCat} className={styles.form}>
          {catError && <div className={styles.error}>{catError}</div>}
          <FormField label="Name" value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} required />
          <div className={styles.formGrid}>
            <FormField label="Inventory Type" type="select" value={catForm.inventoryType} onChange={(e) => setCatForm({ ...catForm, inventoryType: e.target.value })} options={INV_TYPES} required />
            <FormField label="Active" type="select" value={catForm.isActive ? '1' : '0'} onChange={(e) => setCatForm({ ...catForm, isActive: e.target.value === '1' })} options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
          </div>
          <FormField label="Description" type="textarea" value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setCatModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={catSubmitting}>{catSubmitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={supModalOpen} onClose={() => setSupModalOpen(false)} title={editingSup ? 'Edit Supplier' : 'New Supplier'} width={620}>
        <form onSubmit={submitSup} className={styles.form}>
          {supError && <div className={styles.error}>{supError}</div>}
          <div className={styles.formGrid}>
            <FormField label="Supplier Code" value={supForm.supplierCode} onChange={(e) => setSupForm({ ...supForm, supplierCode: e.target.value })} required />
            <FormField label="Company Name" value={supForm.companyName} onChange={(e) => setSupForm({ ...supForm, companyName: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Contact Person" value={supForm.contactPerson} onChange={(e) => setSupForm({ ...supForm, contactPerson: e.target.value })} />
            <FormField label="Phone" value={supForm.phone} onChange={(e) => setSupForm({ ...supForm, phone: e.target.value })} />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Email" type="email" value={supForm.email} onChange={(e) => setSupForm({ ...supForm, email: e.target.value })} />
            <FormField label="Address" value={supForm.address} onChange={(e) => setSupForm({ ...supForm, address: e.target.value })} />
          </div>
          <div className={styles.formGrid}>
            <FormField label="City" value={supForm.city} onChange={(e) => setSupForm({ ...supForm, city: e.target.value })} />
            <FormField label="State" value={supForm.state} onChange={(e) => setSupForm({ ...supForm, state: e.target.value })} />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Country" value={supForm.country} onChange={(e) => setSupForm({ ...supForm, country: e.target.value })} />
            <FormField label="Pincode" value={supForm.pincode} onChange={(e) => setSupForm({ ...supForm, pincode: e.target.value })} />
          </div>
          <div className={styles.formGrid}>
            <FormField label="GST Number" value={supForm.gstNumber} onChange={(e) => setSupForm({ ...supForm, gstNumber: e.target.value })} />
            <FormField label="PAN Number" value={supForm.panNumber} onChange={(e) => setSupForm({ ...supForm, panNumber: e.target.value })} />
          </div>
          <FormField label="Active" type="select" value={supForm.isActive ? '1' : '0'} onChange={(e) => setSupForm({ ...supForm, isActive: e.target.value === '1' })} options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setSupModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={supSubmitting}>{supSubmitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}