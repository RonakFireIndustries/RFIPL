import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getRawMaterials, getRawMaterial, createRawMaterial, updateRawMaterial, deleteRawMaterial,
  addMaterialSupplier, updateMaterialSupplier, removeMaterialSupplier,
  getFinishedProducts, createFinishedProduct, updateFinishedProduct, deleteFinishedProduct,
  getBoms, getBom, createBom, updateBom, deleteBom,
} from '@/api/inventory';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Drawer from '@/components/ui/Drawer';
import FormField from '@/components/ui/FormField';
import { useMasterData, ItemRowsEditor, StatusPill, money } from './shared';
import styles from '@/pages/ModulePage.module.css';

export function RawMaterialsSection() {
  const { accessToken } = useAuth();
  const { units, categories, suppliers } = useMasterData(accessToken, 'raw_material');
  return <RawMaterials accessToken={accessToken} cats={categories} units={units} suppliers={suppliers} />;
}

function RawMaterials({ accessToken, cats, units, suppliers }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);
  const [linkForm, setLinkForm] = useState({ supplierId: '', supplierItemCode: '', purchasePrice: '', isPreferred: false });
  const [linkError, setLinkError] = useState('');

  function emptyForm() {
    return { sku: '', name: '', categoryId: '', unitId: '', description: '', minimumStockLevel: 0, reorderLevel: 0, defaultPurchasePrice: '', isActive: true };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getRawMaterials(accessToken)); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setError(''); setModalOpen(true); };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ sku: row.sku, name: row.name, categoryId: row.categoryId ?? '', unitId: row.unitId ?? '', description: row.description || '', minimumStockLevel: row.minimumStockLevel ?? 0, reorderLevel: row.reorderLevel ?? 0, defaultPurchasePrice: row.defaultPurchasePrice ?? '', isActive: !!row.isActive });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.sku || !form.name || !form.unitId) { setError('SKU, name and unit are required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || null,
        unitId: Number(form.unitId),
        minimumStockLevel: Number(form.minimumStockLevel || 0),
        reorderLevel: Number(form.reorderLevel || 0),
        defaultPurchasePrice: form.defaultPurchasePrice === '' ? null : Number(form.defaultPurchasePrice),
        isActive: form.isActive ? 1 : 0,
      };
      if (editing) await updateRawMaterial(editing.id, payload, accessToken);
      else await createRawMaterial(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to save'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete raw material "${row.name}"?`)) return;
    try { await deleteRawMaterial(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const openDetail = async (row) => {
    try {
      const d = await getRawMaterial(row.id, accessToken);
      setDetail(d);
      setLinkForm({ supplierId: '', supplierItemCode: '', purchasePrice: '', isPreferred: false });
      setLinkError('');
    } catch (err) { alert(err.message); }
  };

  const addLink = async (e) => {
    e.preventDefault();
    setLinkError('');
    if (!linkForm.supplierId) { setLinkError('Select a supplier'); return; }
    try {
      await addMaterialSupplier(detail.id, {
        supplierId: Number(linkForm.supplierId),
        supplierItemCode: linkForm.supplierItemCode || null,
        purchasePrice: linkForm.purchasePrice === '' ? null : Number(linkForm.purchasePrice),
        isPreferred: linkForm.isPreferred,
      }, accessToken);
      const d = await getRawMaterial(detail.id, accessToken);
      setDetail(d);
      setLinkForm({ supplierId: '', supplierItemCode: '', purchasePrice: '', isPreferred: false });
    } catch (err) { setLinkError(err.message || 'Failed to link supplier'); }
  };

  const removeLink = async (link) => {
    if (!confirm('Remove this supplier link?')) return;
    try { await removeMaterialSupplier(detail.id, link.id, accessToken); setDetail(await getRawMaterial(detail.id, accessToken)); } catch (err) { alert(err.message); }
  };

  const togglePreferred = async (link) => {
    try {
      await updateMaterialSupplier(detail.id, link.id, {
        supplierItemCode: link.supplierItemCode || null,
        purchasePrice: link.purchasePrice || null,
        isPreferred: !link.isPreferred,
      }, accessToken);
      setDetail(await getRawMaterial(detail.id, accessToken));
    } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'sku', label: 'SKU', width: '120px' },
    { key: 'name', label: 'Name' },
    { key: 'categoryName', label: 'Category', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'unitSymbol', label: 'Unit', width: '70px', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'minimumStockLevel', label: 'Min Lvl', width: '80px' },
    { key: 'reorderLevel', label: 'Reorder', width: '80px' },
    { key: 'defaultPurchasePrice', label: 'Price', width: '100px', render: (v) => (v ? money(v) : <span style={{ color: '#cbd5e1' }}>—</span>) },
    { key: 'isActive', label: 'Status', width: '90px', render: (v) => <span className={v ? styles.badgeGreen : styles.badgeGray}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'id', label: '', width: '160px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openDetail(row)}>Suppliers</button>
        <button className={styles.editBtn} onClick={() => openEdit(row)}>Edit</button>
        <button className={styles.deleteBtn} onClick={() => handleDelete(row)}>Del</button>
      </div>
    )},
  ];

  const availableSuppliers = suppliers.filter((s) => !detail?.suppliers?.some((l) => l.supplierId === s.id));

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Raw Materials</h2>
          <p className={styles.pageSub}>{data.length} materials</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Material</button>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No raw materials found" onRowClick={openDetail} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Raw Material' : 'New Raw Material'} width={560}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            <FormField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Category" type="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} options={cats.map((c) => ({ value: String(c.id), label: c.name }))} placeholder="None" />
            <FormField label="Unit" type="select" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} options={units.map((c) => ({ value: String(c.id), label: `${c.name} (${c.symbol})` }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Minimum Stock Level" type="number" min="0" value={form.minimumStockLevel} onChange={(e) => setForm({ ...form, minimumStockLevel: e.target.value })} />
            <FormField label="Reorder Level" type="number" min="0" value={form.reorderLevel} onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })} />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Default Purchase Price" type="number" min="0" step="any" value={form.defaultPurchasePrice} onChange={(e) => setForm({ ...form, defaultPurchasePrice: e.target.value })} placeholder="Leave blank to skip" />
            <FormField label="Active" type="select" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })} options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
          </div>
          <FormField label="Description" type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `${detail.name} (${detail.sku})` : 'Raw Material'} width={540}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div className={styles.detailRow}><span>Category</span><strong>{detail.categoryName || '—'}</strong></div>
              <div className={styles.detailRow}><span>Unit</span><strong>{detail.unitName || '—'}</strong></div>
              <div className={styles.detailRow}><span>Min / Reorder Level</span><strong>{detail.minimumStockLevel} / {detail.reorderLevel}</strong></div>
              {detail.defaultPurchasePrice && <div className={styles.detailRow}><span>Default Price</span><strong>{money(detail.defaultPurchasePrice)}</strong></div>}
              {detail.description && <div className={styles.detailRow}><span>Description</span><strong>{detail.description}</strong></div>}
            </div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Suppliers</h4>
              {!detail.suppliers?.length ? (
                <p className={styles.emptyText}>No suppliers linked.</p>
              ) : (
                detail.suppliers.map((l) => (
                  <div key={l.id} className={styles.compItem}>
                    <div>
                      <span className={styles.compName}>
                        {l.companyName} {l.isPreferred && <StatusPill value="preferred" color="#D4AF37" capitalize={false} />}
                      </span>
                      <div className={styles.compAmount} style={{ fontSize: 12, color: '#9ca3af', fontWeight: 400 }}>
                        {l.supplierItemCode ? `Item code: ${l.supplierItemCode}` : ''} {l.purchasePrice ? ` · ${money(l.purchasePrice)}` : ''}
                      </div>
                    </div>
                    <div className={styles.actions}>
                      <button className={styles.editBtn} onClick={() => togglePreferred(l)}>{l.isPreferred ? 'Unset' : 'Pref'}</button>
                      <button className={styles.deleteBtn} onClick={() => removeLink(l)}>Del</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            <form onSubmit={addLink} className={styles.form} style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
              {linkError && <div className={styles.error}>{linkError}</div>}
              <div className={styles.formGrid}>
                <FormField label="Supplier" type="select" value={linkForm.supplierId} onChange={(e) => setLinkForm({ ...linkForm, supplierId: e.target.value })} options={availableSuppliers.map((s) => ({ value: String(s.id), label: s.companyName }))} required />
                <FormField label="Supplier Item Code" value={linkForm.supplierItemCode} onChange={(e) => setLinkForm({ ...linkForm, supplierItemCode: e.target.value })} />
              </div>
              <div className={styles.formGrid}>
                <FormField label="Purchase Price" type="number" min="0" step="any" value={linkForm.purchasePrice} onChange={(e) => setLinkForm({ ...linkForm, purchasePrice: e.target.value })} />
                <label className={styles.checkLabel} style={{ alignSelf: 'flex-end', paddingBottom: 10 }}>
                  <input type="checkbox" checked={linkForm.isPreferred} onChange={(e) => setLinkForm({ ...linkForm, isPreferred: e.target.checked })} />
                  Preferred supplier
                </label>
              </div>
              <div className={styles.formActions}>
                <button type="submit" className={styles.primaryBtn}>Link Supplier</button>
              </div>
            </form>
          </div>
        )}
      </Drawer>
    </div>
  );
}

export function FinishedProductsSection() {
  const { accessToken } = useAuth();
  const { units, categories } = useMasterData(accessToken, 'finished_product');
  return <FinishedProducts accessToken={accessToken} cats={categories} units={units} />;
}

function FinishedProducts({ accessToken, cats, units }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ sku: '', name: '', categoryId: '', unitId: '', description: '', minimumStockLevel: 0, sellingPrice: '', isActive: true });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getFinishedProducts(accessToken)); } catch { /* empty */ }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ sku: '', name: '', categoryId: '', unitId: '', description: '', minimumStockLevel: 0, sellingPrice: '', isActive: true }); setError(''); setModalOpen(true); };
  const openEdit = (row) => {
    setEditing(row);
    setForm({ sku: row.sku, name: row.name, categoryId: row.categoryId ?? '', unitId: row.unitId ?? '', description: row.description || '', minimumStockLevel: row.minimumStockLevel ?? 0, sellingPrice: row.sellingPrice ?? '', isActive: !!row.isActive });
    setError('');
    setModalOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.sku || !form.name || !form.unitId) { setError('SKU, name and unit are required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        categoryId: form.categoryId || null,
        unitId: Number(form.unitId),
        minimumStockLevel: Number(form.minimumStockLevel || 0),
        sellingPrice: form.sellingPrice === '' ? null : Number(form.sellingPrice),
        isActive: form.isActive ? 1 : 0,
      };
      if (editing) await updateFinishedProduct(editing.id, payload, accessToken);
      else await createFinishedProduct(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to save'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete finished product "${row.name}"?`)) return;
    try { await deleteFinishedProduct(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'sku', label: 'SKU', width: '120px' },
    { key: 'name', label: 'Name' },
    { key: 'categoryName', label: 'Category', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'unitSymbol', label: 'Unit', width: '70px', render: (v) => v || <span style={{ color: '#cbd5e1' }}>—</span> },
    { key: 'minimumStockLevel', label: 'Min Lvl', width: '80px' },
    { key: 'sellingPrice', label: 'Selling Price', width: '120px', render: (v) => (v ? money(v) : <span style={{ color: '#cbd5e1' }}>—</span>) },
    { key: 'isActive', label: 'Status', width: '90px', render: (v) => <span className={v ? styles.badgeGreen : styles.badgeGray}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'id', label: '', width: '130px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openEdit(row)}>Edit</button>
        <button className={styles.deleteBtn} onClick={() => handleDelete(row)}>Del</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Finished Products</h2>
          <p className={styles.pageSub}>{data.length} products</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Product</button>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No finished products found" />
      )}
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Finished Product' : 'New Finished Product'} width={540}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            <FormField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Category" type="select" value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} options={cats.map((c) => ({ value: String(c.id), label: c.name }))} placeholder="None" />
            <FormField label="Unit" type="select" value={form.unitId} onChange={(e) => setForm({ ...form, unitId: e.target.value })} options={units.map((c) => ({ value: String(c.id), label: `${c.name} (${c.symbol})` }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Minimum Stock Level" type="number" min="0" value={form.minimumStockLevel} onChange={(e) => setForm({ ...form, minimumStockLevel: e.target.value })} />
            <FormField label="Selling Price" type="number" min="0" step="any" value={form.sellingPrice} onChange={(e) => setForm({ ...form, sellingPrice: e.target.value })} />
          </div>
          <FormField label="Description" type="textarea" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <FormField label="Active" type="select" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })} options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function BillsOfMaterialsSection() {
  const { accessToken } = useAuth();
  const { units } = useMasterData(accessToken, null);
  return <BillsOfMaterials accessToken={accessToken} units={units} />;
}

function BillsOfMaterials({ accessToken, units }) {
  const [data, setData] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState(null);

  function emptyForm() {
    return { bomNumber: '', finishedProductId: '', name: '', outputQuantity: 1, outputUnitId: '', versionNumber: 1, items: [] };
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getBoms(accessToken));
      setRawMaterials(await getRawMaterials(accessToken));
      setProducts(await getFinishedProducts(accessToken));
    } catch { /* empty */ }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setError(''); setModalOpen(true); };
  const openEdit = async (row) => {
    try {
      const d = await getBom(row.id, accessToken);
      setEditing(row);
      setForm({
        bomNumber: d.bomNumber,
        finishedProductId: d.finishedProductId ?? '',
        name: d.name,
        outputQuantity: d.outputQuantity ?? 1,
        outputUnitId: d.outputUnitId ?? '',
        versionNumber: d.versionNumber ?? 1,
        items: (d.items || []).map((it) => ({ rawMaterialId: String(it.rawMaterialId), requiredQuantity: it.requiredQuantity, unitId: String(it.unitId), wastagePercentage: it.wastagePercentage ?? 0 })),
      });
      setError('');
      setModalOpen(true);
    } catch (err) { alert(err.message); }
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.bomNumber || !form.finishedProductId || !form.name || !form.outputUnitId) { setError('BOM number, product, name and output unit are required'); return; }
    if (!form.items.length) { setError('Add at least one BOM item'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        finishedProductId: Number(form.finishedProductId),
        outputQuantity: Number(form.outputQuantity || 1),
        outputUnitId: Number(form.outputUnitId),
        versionNumber: Number(form.versionNumber || 1),
        items: form.items.map((it) => ({ rawMaterialId: Number(it.rawMaterialId), requiredQuantity: Number(it.requiredQuantity || 0), unitId: Number(it.unitId), wastagePercentage: Number(it.wastagePercentage || 0) })),
      };
      if (editing) await updateBom(editing.id, payload, accessToken);
      else await createBom(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) { setError(err.message || 'Failed to save'); } finally { setSubmitting(false); }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete BOM "${row.name}"?`)) return;
    try { await deleteBom(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const openDetail = async (row) => {
    try { setDetail(await getBom(row.id, accessToken)); } catch (err) { alert(err.message); }
  };

  const columns = [
    { key: 'bomNumber', label: 'Number', width: '120px' },
    { key: 'name', label: 'Name' },
    { key: 'finishedProductName', label: 'Product' },
    { key: 'outputQuantity', label: 'Output Qty', width: '90px' },
    { key: 'versionNumber', label: 'Ver', width: '60px' },
    { key: 'isActive', label: 'Status', width: '90px', render: (v) => <span className={v ? styles.badgeGreen : styles.badgeGray}>{v ? 'Active' : 'Inactive'}</span> },
    { key: 'id', label: '', width: '150px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={() => openDetail(row)}>View</button>
        <button className={styles.editBtn} onClick={() => openEdit(row)}>Edit</button>
        <button className={styles.deleteBtn} onClick={() => handleDelete(row)}>Del</button>
      </div>
    )},
  ];

  let itemColumns = [
    { key: 'rawMaterialId', label: 'Raw Material', type: 'select', options: rawMaterials.map((m) => ({ value: String(m.id), label: `${m.name} (${m.sku})` })) },
    { key: 'requiredQuantity', label: 'Qty', type: 'number', min: '0', step: 'any' },
    { key: 'unitId', label: 'Unit', type: 'select', options: units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.symbol})` })) },
    { key: 'wastagePercentage', label: 'Wastage %', type: 'number', min: '0', step: 'any' },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h2 className={styles.pageTitle}>Bills of Materials</h2>
          <p className={styles.pageSub}>{data.length} BOMs</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New BOM</button>
      </div>
      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No bills of materials found" onRowClick={openDetail} />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit BOM' : 'New BOM'} width={720}>
        <form onSubmit={submit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.formGrid}>
            <FormField label="BOM Number" value={form.bomNumber} onChange={(e) => setForm({ ...form, bomNumber: e.target.value })} required />
            <FormField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Finished Product" type="select" value={form.finishedProductId} onChange={(e) => setForm({ ...form, finishedProductId: e.target.value })} options={products.map((p) => ({ value: String(p.id), label: `${p.name} (${p.sku})` }))} required />
            <FormField label="Output Unit" type="select" value={form.outputUnitId} onChange={(e) => setForm({ ...form, outputUnitId: e.target.value })} options={units.map((u) => ({ value: String(u.id), label: `${u.name} (${u.symbol})` }))} required />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Output Quantity (per run)" type="number" min="0" step="any" value={form.outputQuantity} onChange={(e) => setForm({ ...form, outputQuantity: e.target.value })} />
            <FormField label="Version" type="number" min="1" value={form.versionNumber} onChange={(e) => setForm({ ...form, versionNumber: e.target.value })} />
          </div>
          <div>
            <label style={{ fontSize: 13, color: '#374151', fontWeight: 500, display: 'block', marginBottom: 6 }}>BOM Items</label>
            <ItemRowsEditor
              columns={itemColumns}
              rows={form.items}
              onChange={(items) => setForm({ ...form, items })}
              newRow={() => ({ rawMaterialId: '', requiredQuantity: '', unitId: '', wastagePercentage: 0 })}
              addLabel="+ Add Material"
            />
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Modal>

      <Drawer isOpen={!!detail} onClose={() => setDetail(null)} title={detail ? `BOM: ${detail.name}` : 'BOM'} width={520}>
        {detail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className={styles.detailRow}><span>Number</span><strong>{detail.bomNumber}</strong></div>
            <div className={styles.detailRow}><span>Product</span><strong>{detail.finishedProductName || '—'}</strong></div>
            <div className={styles.detailRow}><span>Output Qty</span><strong>{detail.outputQuantity} {detail.outputUnitSymbol || ''}</strong></div>
            <div className={styles.detailRow}><span>Version</span><strong>{detail.versionNumber}</strong></div>
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 13, color: '#6b7280', textTransform: 'uppercase' }}>Materials</h4>
              {!detail.items?.length ? <p className={styles.emptyText}>No items.</p> : (
                detail.items.map((it) => (
                  <div key={it.id} className={styles.compItem}>
                    <span className={styles.compName}>{it.rawMaterialName || '—'}</span>
                    <span className={styles.compAmount}>{it.requiredQuantity} {it.unitSymbol || ''}{it.wastagePercentage ? ` (+${it.wastagePercentage}% wastage)` : ''}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}