import { useEffect, useMemo, useState } from 'react';
import styles from './ItemCreateWizard.module.css';
import { useInteractions } from './interactions';
import {
  getInventoryUnits, getInventoryCategories, getSuppliers, getStockLocations,
  createRawMaterial, createFinishedProduct,
} from '@/api/inventory';

const RAW_STEPS = [
  { key: 'basics', label: 'Details' },
  { key: 'classify', label: 'Classify' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'stock', label: 'Stock & Site' },
  { key: 'review', label: 'Review' },
];
const FINISHED_STEPS = [
  { key: 'basics', label: 'Details' },
  { key: 'classify', label: 'Classify' },
  { key: 'pricing', label: 'Pricing' },
  { key: 'stock', label: 'Stock & Site' },
  { key: 'review', label: 'Review' },
];

function emptyForm(isRaw) {
  return {
    sku: '',
    name: '',
    hsnCode: '',
    dimension: '',
    unitId: '',
    categoryId: '',
    subCategory: '',
    supplierId: '',
    purchasePrice: '',
    sellingPrice: '',
    openingStock: 0,
    siteId: '',
    status: '1',
    description: '',
  };
}

export default function ItemCreateWizard({ isRaw, accessToken, employees, onDone, onCancel }) {
  const { toast, success, error, confirm } = useInteractions();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => emptyForm(isRaw));
  const [units, setUnits] = useState([]);
  const [cats, setCats] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [sites, setSites] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const label = isRaw ? 'Raw Material' : 'Finished Product';

  useEffect(() => {
    setErrorMsg('');
    Promise.all([
      getInventoryUnits(accessToken),
      getInventoryCategories(accessToken, { inventoryType: isRaw ? 'raw_material' : 'finished_product' }),
      getSuppliers(accessToken),
      getStockLocations(accessToken),
    ])
      .then(([u, c, s, loc]) => { setUnits(u); setCats(c); setSuppliers(s); setSites(loc); })
      .catch(() => {});
  }, [accessToken, isRaw]);

  const steps = isRaw ? RAW_STEPS : FINISHED_STEPS;
  const stepCount = steps.length;
  const canReview = !!form.name?.trim() && !!form.unitId && !(Number(form.openingStock) > 0 && !form.siteId);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const next = () => { setErrorMsg(''); if (step < stepCount - 1) setStep((s) => s + 1); };
  const back = () => { if (step > 0) setStep((s) => s - 1); };

  const submit = async () => {
    if (!canReview) { setErrorMsg('Fill required fields and choose a site when opening stock is set.'); return; }
    setSubmitting(true);
    setErrorMsg('');
    try {
      const base = {
        sku: form.sku?.trim() || null, // empty => auto-generate
        name: form.name.trim(),
        hsnCode: form.hsnCode?.trim() || null,
        dimension: form.dimension?.trim() || null,
        categoryId: form.categoryId ? Number(form.categoryId) : null,
        unitId: Number(form.unitId),
        description: form.description?.trim() || null,
        sellingPrice: form.sellingPrice === '' ? null : Number(form.sellingPrice),
        openingStock: Number(form.openingStock || 0),
        siteId: form.siteId ? Number(form.siteId) : null,
        isActive: form.status === '1',
        subCategory: form.subCategory?.trim() || null,
      };
      const body = isRaw ? {
        ...base,
        defaultPurchasePrice: form.purchasePrice === '' ? null : Number(form.purchasePrice),
        supplierId: form.supplierId ? Number(form.supplierId) : null,
        minimumStockLevel: 0,
        reorderLevel: 0,
      } : base;

      if (isRaw) await createRawMaterial(body, accessToken);
      else await createFinishedProduct(body, accessToken);
      success(`${label} created`);
      onDone?.();
    } catch (err) {
      setErrorMsg(err.message || 'Failed to create item');
      error(err.message || 'Failed to create item');
    } finally {
      setSubmitting(false);
    }
  };

  const f = (key) => ({
    value: form[key] ?? '',
    onChange: (e) => set({ [key]: e.target.value }),
  });

  const renderBasics = () => (
    <>
      <h2 className={styles.stepTitle}>Step 1 · Details</h2>
      <p className={styles.stepHint}>SKU is generated automatically if left blank.</p>
      <div className={styles.grid}>
        <div className={styles.field}>
          <label>SKU</label>
          <input {...f('sku')} placeholder="Auto-generated" />
        </div>
        <div className={styles.field}>
          <label>Product Name *</label>
          <input {...f('name')} placeholder="e.g. Mild Steel Sheet 3mm" />
        </div>
        <div className={styles.field}>
          <label>HSN Code</label>
          <input {...f('hsnCode')} placeholder="e.g. 7208" />
        </div>
        <div className={styles.field}>
          <label>Dimension</label>
          <input {...f('dimension')} placeholder="e.g. 4' x 8' x 3mm" />
        </div>
      </div>
    </>
  );

  const renderClassify = () => (
    <>
      <h2 className={styles.stepTitle}>Step 2 · Classify</h2>
      <div className={styles.grid}>
        <div className={styles.field}>
          <label>Unit *</label>
          <select {...f('unitId')}>
            <option value="">Select Unit</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.symbol})</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label>Category</label>
          <select {...f('categoryId')}>
            <option value="">Select Category</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label>Sub Category</label>
          <input {...f('subCategory')} placeholder="e.g. Sheet, Coil" />
        </div>
      </div>
    </>
  );

  const renderPricing = () => (
    <>
      <h2 className={styles.stepTitle}>Step 3 · Pricing</h2>
      <div className={styles.grid}>
        {isRaw && (
          <div className={styles.field}>
            <label>Supplier</label>
            <select {...f('supplierId')}>
              <option value="">Select Supplier</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.companyName}</option>)}
            </select>
          </div>
        )}
        <div className={styles.field}>
          <label>Purchase Price {isRaw ? '' : '(if applicable)'}</label>
          <input type="number" min="0" step="any" {...f('purchasePrice')} placeholder="0.00" />
        </div>
        <div className={styles.field}>
          <label>Selling Price</label>
          <input type="number" min="0" step="any" {...f('sellingPrice')} placeholder="0.00" />
        </div>
      </div>
    </>
  );

  const renderStock = () => (
    <>
      <h2 className={styles.stepTitle}>Step 4 · Stock & Site</h2>
      <div className={styles.grid}>
        <div className={styles.field}>
          <label>Opening Stock</label>
          <input type="number" min="0" step="any" {...f('openingStock')} />
        </div>
        <div className={styles.field}>
          <label>Store At (Site) {Number(form.openingStock) > 0 && <span className={styles.req}>* required when opening stock &gt; 0</span>}</label>
          <select {...f('siteId')}>
            <option value="">Select Site</option>
            {sites.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div className={styles.field}>
          <label>Status</label>
          <select {...f('status')}>
            <option value="1">Active</option>
            <option value="0">Inactive</option>
          </select>
        </div>
        <div className={styles.field}>
          <label>Description</label>
          <textarea {...f('description')} rows="3" placeholder="Optional notes" />
        </div>
      </div>
    </>
  );

  const renderReview = () => {
    const rows = [
      ['SKU', form.sku?.trim() || (<em>auto-generated</em>)],
      ['Name', form.name],
      ['HSN Code', form.hsnCode],
      ['Dimension', form.dimension],
      ['Unit', units.find((u) => String(u.id) === String(form.unitId))?.name || form.unitId],
      ['Category', cats.find((c) => String(c.id) === String(form.categoryId))?.name || '—'],
      ['Sub Category', form.subCategory],
      ['Supplier', suppliers.find((s) => String(s.id) === String(form.supplierId))?.companyName || '—'],
      ['Purchase Price', form.purchasePrice],
      ['Selling Price', form.sellingPrice],
      ['Opening Stock', form.openingStock],
      ['Site', sites.find((s) => String(s.id) === String(form.siteId))?.name || '—'],
      ['Status', form.status === '1' ? 'Active' : 'Inactive'],
    ];
    return (
      <>
        <h2 className={styles.stepTitle}>Step 5 · Review</h2>
        <div className={styles.review}>
          {rows.map(([k, v]) => (
            <div key={k} className={styles.reviewRow}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      </>
    );
  };

  return (
    <div className={styles.wizard}>
      <div className={styles.stepper}>
        {steps.map((s, i) => (
          <button
            key={s.key}
            type="button"
            className={`${styles.step} ${i <= step ? styles.stepDone : ''} ${i === step ? styles.stepCurrent : ''}`}
            onClick={() => { if (i < step) setStep(i); }}
          >
            {i + 1}. {s.label}
          </button>
        ))}
      </div>

      <div className={styles.body}>
        {step === 0 && renderBasics()}
        {step === 1 && renderClassify()}
        {step === 2 && renderPricing()}
        {step === 3 && renderStock()}
        {step === 4 && renderReview()}
        {errorMsg && <div className={styles.error}>{errorMsg}</div>}
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.ghost} onClick={back} disabled={step === 0}>Back</button>
        {step < stepCount - 1 ? (
          <button type="button" className={styles.primary} onClick={next}>Next</button>
        ) : (
          <button type="button" className={styles.primary} onClick={submit} disabled={submitting}>
            {submitting ? 'Creating...' : `Create ${label}`}
          </button>
        )}
      </div>
    </div>
  );
}
