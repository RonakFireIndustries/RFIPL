import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import moduleStyles from '../ModulePage.module.css';
import local from './Purchasing.module.css';
import {
  createBom,
  deleteBom,
  getBillOfMaterials,
  getBillsOfMaterials,
  getFinishedProducts,
  getInventoryUnits,
  getRawMaterials,
  updateBom,
} from '@/api/inventory';
import { formatQty } from './utils';

function newLine(unitId = '') {
  return {
    key: `${Date.now()}-${Math.random()}`,
    rawMaterialId: '',
    requiredQuantity: '',
    unitId,
    wastagePercentage: '0',
  };
}

export default function ProductionBOMs() {
  const { accessToken } = useAuth();
  const { success, error: toastError } = useInteractions();

  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [finishedProductId, setFinishedProductId] = useState('');
  const [bomName, setBomName] = useState('');
  const [outputQuantity, setOutputQuantity] = useState('1');
  const [outputUnitId, setOutputUnitId] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [lines, setLines] = useState([newLine()]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [bomRows, productRows, materialRows, unitRows] = await Promise.all([
        getBillsOfMaterials(accessToken),
        getFinishedProducts(accessToken),
        getRawMaterials(accessToken),
        getInventoryUnits(accessToken),
      ]);
      setRows(bomRows);
      setProducts(productRows);
      setMaterials(materialRows);
      setUnits(unitRows);
    } catch (err) {
      toastError(err.message || 'Failed to load bills of materials');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFinishedProductId('');
    setBomName('');
    setOutputQuantity('1');
    setOutputUnitId(units[0] ? String(units[0].id) : '');
    setIsActive(true);
    setLines([newLine()]);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = async (row) => {
    try {
      const full = await getBillOfMaterials(row.id, accessToken);
      setEditing(full);
      setFinishedProductId(String(full.finishedProductId || ''));
      setBomName(full.name || '');
      setOutputQuantity(full.outputQuantity ?? '1');
      setOutputUnitId(String(full.outputUnitId || ''));
      setIsActive(Number(full.isActive) === 1);
      setLines((full.items || []).map((item) => ({
        key: `${Date.now()}-${Math.random()}`,
        rawMaterialId: String(item.rawMaterialId),
        requiredQuantity: item.requiredQuantity,
        unitId: String(item.unitId),
        wastagePercentage: item.wastagePercentage ?? '0',
      })));
      setFormError('');
      setFormOpen(true);
    } catch (err) {
      toastError(err.message || 'Failed to open BOM');
    }
  };

  const changeProduct = (id) => {
    setFinishedProductId(id);
    const product = products.find((p) => String(p.id) === String(id));
    if (product?.unitId) setOutputUnitId(String(product.unitId));
  };

  const changeLine = (key, field, value) => {
    setLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      const next = { ...line, [field]: value };
      if (field === 'rawMaterialId') {
        const material = materials.find((m) => String(m.id) === String(value));
        if (material?.unitId) next.unitId = String(material.unitId);
      }
      return next;
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!finishedProductId || !bomName.trim() || !outputUnitId) {
      setFormError('Product, BOM name and output unit are required');
      return;
    }
    if (!(Number(outputQuantity) > 0)) {
      setFormError('Output quantity must be greater than zero');
      return;
    }
    if (lines.length === 0) {
      setFormError('Add at least one material');
      return;
    }
    if (lines.some((line) => !line.rawMaterialId || !line.unitId || !(Number(line.requiredQuantity) > 0))) {
      setFormError('Every line needs a material, unit and quantity greater than zero');
      return;
    }

    const items = lines.map((line) => ({
      rawMaterialId: line.rawMaterialId,
      requiredQuantity: line.requiredQuantity,
      unitId: line.unitId,
      wastagePercentage: line.wastagePercentage === '' ? 0 : line.wastagePercentage,
    }));

    setSubmitting(true);
    try {
      if (editing) {
        await updateBom(editing.id, {
          name: bomName.trim(),
          outputQuantity,
          outputUnitId,
          isActive: isActive ? 1 : 0,
          items,
        }, accessToken);
        success(`${editing.bomNumber} updated`);
      } else {
        const created = await createBom({
          finishedProductId,
          name: bomName.trim(),
          outputQuantity,
          outputUnitId,
          items,
        }, accessToken);
        success(`${created.bomNumber} created as the active version`);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to save BOM');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!window.confirm(`Delete ${row.bomNumber} · ${row.name}?`)) return;
    try {
      await deleteBom(row.id, accessToken);
      success(`${row.bomNumber} deleted`);
      await load();
    } catch (err) {
      toastError(err.message || 'Failed to delete BOM');
    }
  };

  const columns = [
    {
      key: 'bomNumber',
      label: 'BOM',
      render: (value, row) => (
        <div>
          <span className={local.docNumber}>{value}</span>
          <span className={local.subtleBlock}>Version {row.versionNumber}</span>
        </div>
      ),
    },
    {
      key: 'finishedProductName',
      label: 'Finished product',
      render: (value, row) => (
        <div>
          <span>{value || '—'}</span>
          <span className={local.subtleBlock}>{row.finishedProductSku}</span>
        </div>
      ),
    },
    { key: 'name', label: 'Recipe' },
    {
      key: 'outputQuantity',
      label: 'Output',
      align: 'right',
      render: (value, row) => `${formatQty(value)} ${row.outputUnitSymbol || ''}`,
    },
    {
      key: 'isActive',
      label: 'Status',
      width: '120px',
      render: (value) => (Number(value) === 1
        ? <span className={moduleStyles.badgeGreen}>Active</span>
        : <span className={moduleStyles.badgeGray}>Inactive</span>),
    },
    {
      key: 'id',
      label: 'Actions',
      width: '150px',
      render: (_, row) => (
        <div className={moduleStyles.actions} onClick={(e) => e.stopPropagation()}>
          <button className={moduleStyles.editBtn} onClick={() => openEdit(row)}>Edit</button>
          <button className={moduleStyles.deleteBtn} onClick={() => handleDelete(row)}>Delete</button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={moduleStyles.pageHeader}>
        <div>
          <h2 className={local.sectionTitle}>Bills of Materials</h2>
          <p className={moduleStyles.pageSub}>
            One active version per product. Creating a new version automatically deactivates the previous one.
          </p>
        </div>
        <button className={moduleStyles.primaryBtn} onClick={openCreate}>+ New BOM</button>
      </div>

      {loading ? (
        <div className={moduleStyles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={rows}
          onRowClick={openEdit}
          searchable
          searchKeys={['bomNumber', 'finishedProductName', 'finishedProductSku', 'name']}
          searchPlaceholder="Search BOMs..."
          emptyMessage="No bills of materials yet. Create one for a finished product."
        />
      )}

      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `${editing.bomNumber} · v${editing.versionNumber}` : 'New bill of materials'}
        wide
      >
        <form onSubmit={handleSubmit} className={moduleStyles.form}>
          {formError && <div className={moduleStyles.error}>{formError}</div>}

          <div className={moduleStyles.formGrid}>
            <FormField
              label="Finished product"
              type="select"
              value={finishedProductId}
              onChange={(e) => changeProduct(e.target.value)}
              options={products.map((p) => ({ value: p.id, label: `${p.sku} · ${p.name}` }))}
              required
              disabled={Boolean(editing)}
            />
            <FormField
              label="BOM name"
              value={bomName}
              onChange={(e) => setBomName(e.target.value)}
              placeholder="e.g. Standard 10-unit recipe"
              required
            />
            <FormField
              label="Output quantity"
              type="number"
              value={outputQuantity}
              onChange={(e) => setOutputQuantity(e.target.value)}
              required
            />
            <FormField
              label="Output unit"
              type="select"
              value={outputUnitId}
              onChange={(e) => setOutputUnitId(e.target.value)}
              options={units.map((u) => ({ value: u.id, label: `${u.name} (${u.symbol})` }))}
              required
            />
          </div>

          <label className={local.checkboxLine}>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            Active BOM version
          </label>

          <div>
            <h3 className={local.sectionTitle}>Materials</h3>
            <div className={local.lineHeader}>
              <span>Raw material</span>
              <span>Required</span>
              <span>Unit</span>
              <span>Wastage %</span>
              <span />
            </div>
            <div className={local.lineItems}>
              {lines.map((line) => (
                <div className={local.lineRow} key={line.key}>
                  <select value={line.rawMaterialId} onChange={(e) => changeLine(line.key, 'rawMaterialId', e.target.value)}>
                    <option value="">Select material...</option>
                    {materials.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="0.0001"
                    step="0.0001"
                    value={line.requiredQuantity}
                    onChange={(e) => changeLine(line.key, 'requiredQuantity', e.target.value)}
                    placeholder="0"
                  />
                  <select value={line.unitId} onChange={(e) => changeLine(line.key, 'unitId', e.target.value)}>
                    <option value="">Unit</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                  </select>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={line.wastagePercentage}
                    onChange={(e) => changeLine(line.key, 'wastagePercentage', e.target.value)}
                    placeholder="0"
                  />
                  <button
                    type="button"
                    className={local.dangerSmall}
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              className={`${local.smallBtn} ${local.addLineBtn}`}
              onClick={() => setLines((current) => [...current, newLine()])}
            >
              + Add material
            </button>
          </div>

          <p className={local.hint}>
            BOM numbers are generated automatically as BOM-0001, BOM-0002… Wastage is applied when an order is completed.
          </p>

          <div className={moduleStyles.formActions}>
            <button type="button" className={moduleStyles.cancelBtn} onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" className={moduleStyles.primaryBtn} disabled={submitting}>
              {submitting ? 'Saving...' : editing ? 'Update BOM' : 'Create BOM'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
