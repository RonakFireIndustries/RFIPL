import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import moduleStyles from '../ModulePage.module.css';
import local from './Purchasing.module.css';
import {
  cancelProductionOrder,
  completeProductionOrder,
  createProductionOrder,
  deleteProductionOrder,
  getBillsOfMaterials,
  getFinishedProducts,
  getInventoryUnits,
  getProductionOrder,
  getProductionOrders,
  planProductionOrder,
  startProductionOrder,
  updateProductionOrder,
} from '@/api/inventory';
import { getDepartments } from '@/api/departments';
import { formatDate, formatDateTime, formatQty, titleCase, todayISO } from './utils';
import { DetailField, StatusBadge } from './PurchasingShared';

function newOutput(productId, unitId, productionNumber, index) {
  return {
    key: `${Date.now()}-${Math.random()}`,
    finishedProductId: productId ? String(productId) : '',
    outputQuantity: '1',
    unitId: unitId ? String(unitId) : '',
    batchNumber: `${productionNumber}-B${index + 1}`,
    manufacturingDate: todayISO(),
    manualCost: '',
  };
}

export default function ProductionOrders() {
  const { accessToken } = useAuth();
  const { success, error: toastError } = useInteractions();

  const [rows, setRows] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [boms, setBoms] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [departmentId, setDepartmentId] = useState('');
  const [bomId, setBomId] = useState('');
  const [plannedStart, setPlannedStart] = useState('');
  const [plannedCompletion, setPlannedCompletion] = useState('');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [detail, setDetail] = useState(null);
  const [completeFor, setCompleteFor] = useState(null);
  const [outputLines, setOutputLines] = useState([]);
  const [completeError, setCompleteError] = useState('');
  const [completing, setCompleting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [orders, departmentRows, bomRows, productRows, unitRows] = await Promise.all([
        getProductionOrders(accessToken),
        getDepartments(accessToken),
        getBillsOfMaterials(accessToken),
        getFinishedProducts(accessToken),
        getInventoryUnits(accessToken),
      ]);
      setRows(orders);
      setDepartments(departmentRows);
      setBoms(bomRows);
      setProducts(productRows);
      setUnits(unitRows);
    } catch (err) {
      toastError(err.message || 'Failed to load production orders');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => { load(); }, [load]);

  const activeBoms = boms.filter((bom) => Number(bom.isActive) === 1);

  const openCreate = () => {
    setEditing(null);
    setDepartmentId('');
    setBomId(activeBoms[0] ? String(activeBoms[0].id) : '');
    setPlannedStart(todayISO());
    setPlannedCompletion('');
    setRemarks('');
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setDepartmentId(row.departmentId ? String(row.departmentId) : '');
    setBomId(row.bomId ? String(row.bomId) : '');
    setPlannedStart(row.plannedStartDate || '');
    setPlannedCompletion(row.plannedCompletionDate || '');
    setRemarks(row.remarks || '');
    setFormError('');
    setFormOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    const payload = {
      departmentId: departmentId || null,
      bomId: bomId || null,
      plannedStartDate: plannedStart || null,
      plannedCompletionDate: plannedCompletion || null,
      remarks: remarks || null,
    };

    setSubmitting(true);
    try {
      if (editing) {
        await updateProductionOrder(editing.id, payload, accessToken);
        success(`${editing.productionNumber} updated`);
      } else {
        const created = await createProductionOrder(payload, accessToken);
        success(`${created.productionNumber} created as draft`);
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to save production order');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (row) => {
    try {
      setDetail(await getProductionOrder(row.id, accessToken));
    } catch (err) {
      toastError(err.message || 'Failed to load production order');
    }
  };

  const runAction = async (action, row) => {
    try {
      if (action === 'plan') {
        await planProductionOrder(row.id, {
          plannedStartDate: row.plannedStartDate,
          plannedCompletionDate: row.plannedCompletionDate,
        }, accessToken);
      }
      if (action === 'start') await startProductionOrder(row.id, accessToken);
      if (action === 'cancel') await cancelProductionOrder(row.id, accessToken);
      if (action === 'delete') {
        if (!window.confirm(`Delete ${row.productionNumber}?`)) return;
        await deleteProductionOrder(row.id, accessToken);
      }
      success(`${row.productionNumber} ${action === 'delete' ? 'deleted' : action === 'cancel' ? 'cancelled' : action === 'plan' ? 'planned' : 'started'}`);
      setDetail(null);
      await load();
    } catch (err) {
      toastError(err.message || `Failed to ${action} production order`);
    }
  };

  const openComplete = (row) => {
    const bom = boms.find((item) => String(item.id) === String(row.bomId));
    const productId = row.finishedProductId || bom?.finishedProductId || '';
    const product = products.find((item) => String(item.id) === String(productId));
    const unitId = row.bomOutputUnitId || product?.unitId || units[0]?.id || '';
    const firstOutput = newOutput(productId, unitId, row.productionNumber, 0);
    firstOutput.outputQuantity = row.bomOutputQuantity || '1';
    setOutputLines([firstOutput]);
    setCompleteFor(row);
    setCompleteError('');
  };

  const changeOutput = (key, field, value) => {
    setOutputLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      const next = { ...line, [field]: value };
      if (field === 'finishedProductId') {
        const product = products.find((p) => String(p.id) === String(value));
        if (product?.unitId) next.unitId = String(product.unitId);
      }
      return next;
    }));
  };

  const handleComplete = async (e) => {
    e.preventDefault();
    setCompleteError('');
    if (outputLines.length === 0) {
      setCompleteError('Add at least one output');
      return;
    }
    if (outputLines.some((line) => (
      !line.finishedProductId || !line.unitId || !line.batchNumber.trim()
      || !line.manufacturingDate || !(Number(line.outputQuantity) > 0)
    ))) {
      setCompleteError('Every output needs a product, quantity, unit, batch and manufacturing date');
      return;
    }

    const outputs = outputLines.map((line) => ({
      finishedProductId: line.finishedProductId,
      outputQuantity: line.outputQuantity,
      unitId: line.unitId,
      batchNumber: line.batchNumber.trim(),
      manufacturingDate: line.manufacturingDate,
      manualCost: line.manualCost === '' ? null : line.manualCost,
    }));

    setCompleting(true);
    try {
      const completed = await completeProductionOrder(completeFor.id, { outputs }, accessToken);
      success(`${completeFor.productionNumber} completed — stock posted`);
      setCompleteFor(null);
      setDetail(completed);
      await load();
    } catch (err) {
      setCompleteError(err.message || 'Failed to complete production order');
    } finally {
      setCompleting(false);
    }
  };

  const columns = [
    {
      key: 'productionNumber',
      label: 'Order',
      render: (value, row) => (
        <div>
          <span className={local.docNumber}>{value}</span>
          <span className={local.subtleBlock}>{row.remarks || 'No remarks'}</span>
        </div>
      ),
    },
    {
      key: 'bomNumber',
      label: 'BOM / product',
      render: (value, row) => (
        <div>
          <span>{value || '—'}</span>
          <span className={local.subtleBlock}>{row.finishedProductName || 'No product'}</span>
        </div>
      ),
    },
    { key: 'departmentName', label: 'Department', render: (value) => value || '—' },
    { key: 'plannedCompletionDate', label: 'Planned', render: (value) => formatDate(value) },
    { key: 'status', label: 'Status', width: '150px', render: (value) => <StatusBadge status={value} /> },
    {
      key: 'id',
      label: 'Actions',
      width: '330px',
      render: (_, row) => (
        <div className={moduleStyles.actions} onClick={(e) => e.stopPropagation()}>
          {row.status === 'draft' && (
            <>
              <button className={moduleStyles.editBtn} onClick={() => openEdit(row)}>Edit</button>
              <button className={moduleStyles.editBtn} onClick={() => runAction('plan', row)}>Plan</button>
              <button className={moduleStyles.editBtn} onClick={() => runAction('start', row)}>Start</button>
              <button className={moduleStyles.deleteBtn} onClick={() => runAction('delete', row)}>Delete</button>
            </>
          )}
          {row.status === 'planned' && (
            <>
              <button className={moduleStyles.editBtn} onClick={() => runAction('start', row)}>Start</button>
              <button className={moduleStyles.editBtn} onClick={() => openComplete(row)}>Complete</button>
            </>
          )}
          {row.status === 'in_progress' && (
            <button className={moduleStyles.editBtn} onClick={() => openComplete(row)}>Complete</button>
          )}
          {!['completed', 'cancelled'].includes(row.status) && (
            <button className={moduleStyles.deleteBtn} onClick={() => runAction('cancel', row)}>Cancel</button>
          )}
          {['completed', 'cancelled'].includes(row.status) && <span className={local.progressText}>Closed</span>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={moduleStyles.pageHeader}>
        <div>
          <h2 className={local.sectionTitle}>Production Orders</h2>
          <p className={moduleStyles.pageSub}>Draft → planned → in progress → completed. Completing an order posts stock automatically.</p>
        </div>
        <button className={moduleStyles.primaryBtn} onClick={openCreate}>+ New Order</button>
      </div>

      {loading ? (
        <div className={moduleStyles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={rows}
          onRowClick={openDetail}
          searchable
          searchKeys={['productionNumber', 'bomNumber', 'finishedProductName', 'departmentName', 'status']}
          searchPlaceholder="Search production orders..."
          emptyMessage="No production orders yet."
        />
      )}

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? `Edit ${editing.productionNumber}` : 'New production order'}>
        <form onSubmit={handleFormSubmit} className={moduleStyles.form}>
          {formError && <div className={moduleStyles.error}>{formError}</div>}
          <div className={moduleStyles.formGrid}>
            <FormField
              label="Department"
              type="select"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
              placeholder="Optional"
            />
            <FormField
              label="Bill of materials"
              type="select"
              value={bomId}
              onChange={(e) => setBomId(e.target.value)}
              options={activeBoms.map((bom) => ({
                value: bom.id,
                label: `${bom.bomNumber} · ${bom.finishedProductName || ''}`,
              }))}
              placeholder="Assign later"
            />
            <FormField label="Planned start" type="date" value={plannedStart} onChange={(e) => setPlannedStart(e.target.value)} />
            <FormField label="Planned completion" type="date" value={plannedCompletion} onChange={(e) => setPlannedCompletion(e.target.value)} />
          </div>
          <FormField label="Remarks" type="textarea" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional" />
          <p className={local.hint}>Order numbers are generated automatically as PROD-0001, PROD-0002…</p>
          <div className={moduleStyles.formActions}>
            <button type="button" className={moduleStyles.cancelBtn} onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" className={moduleStyles.primaryBtn} disabled={submitting}>
              {submitting ? 'Saving...' : editing ? 'Update order' : 'Create order'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.productionNumber || 'Production order'} wide>
        {detail && (
          <div>
            <div className={local.detailGrid}>
              <DetailField label="Status"><StatusBadge status={detail.status} /></DetailField>
              <DetailField label="BOM">{detail.bomNumber || '—'}</DetailField>
              <DetailField label="Product">{detail.finishedProductName || '—'}</DetailField>
              <DetailField label="Department">{detail.departmentName || '—'}</DetailField>
              <DetailField label="Planned start">{formatDate(detail.plannedStartDate)}</DetailField>
              <DetailField label="Planned completion">{formatDate(detail.plannedCompletionDate)}</DetailField>
              <DetailField label="Started">{formatDateTime(detail.actualStartAt)}</DetailField>
              <DetailField label="Completed">{formatDateTime(detail.actualCompletedAt)}</DetailField>
              <DetailField label="Created by">{detail.createdByEmail || '—'}</DetailField>
            </div>
            {detail.remarks && <p className={local.note}>{detail.remarks}</p>}

            <h3 className={local.sectionTitle}>Material consumption</h3>
            <Table
              columns={[
                { key: 'rawMaterialName', label: 'Material' },
                { key: 'batchNumber', label: 'Batch', render: (v) => v || '—' },
                { key: 'consumptionMode', label: 'Mode', render: (v) => titleCase(v) },
                { key: 'consumedQuantity', label: 'Consumed', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
                { key: 'consumedAt', label: 'When', render: (v) => formatDateTime(v) },
                { key: 'consumedByEmail', label: 'By', render: (v) => v || '—' },
              ]}
              data={detail.consumptions || []}
              emptyMessage="No material consumed yet."
            />

            <div className={local.sectionGap}>
              <h3 className={local.sectionTitle}>Wastage</h3>
              <Table
                columns={[
                  { key: 'rawMaterialName', label: 'Material', render: (v) => v || '—' },
                  { key: 'wastageType', label: 'Type', render: (v) => titleCase(v) },
                  { key: 'quantity', label: 'Quantity', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
                  { key: 'description', label: 'Description', render: (v) => v || '—' },
                ]}
                data={detail.wastage || []}
                emptyMessage="No wastage recorded."
              />
            </div>

            <div className={local.sectionGap}>
              <h3 className={local.sectionTitle}>Finished output</h3>
              <Table
                columns={[
                  { key: 'finishedProductName', label: 'Product' },
                  { key: 'batchNumber', label: 'Batch' },
                  { key: 'outputQuantity', label: 'Output', align: 'right', render: (v, r) => `${formatQty(v)} ${r.unitSymbol || ''}` },
                  { key: 'manufacturingDate', label: 'Manufactured', render: (v) => formatDate(v) },
                ]}
                data={detail.outputs || []}
                emptyMessage="No output recorded yet."
              />
            </div>

            <div className={moduleStyles.formActions}>
              {detail.status === 'draft' && (
                <>
                  <button className={moduleStyles.editBtn} onClick={() => runAction('plan', detail)}>Plan</button>
                  <button className={moduleStyles.editBtn} onClick={() => runAction('start', detail)}>Start</button>
                </>
              )}
              {detail.status === 'planned' && (
                <button className={moduleStyles.editBtn} onClick={() => runAction('start', detail)}>Start</button>
              )}
              {['planned', 'in_progress'].includes(detail.status) && (
                <button className={moduleStyles.primaryBtn} onClick={() => openComplete(detail)}>Complete production</button>
              )}
              {!['completed', 'cancelled'].includes(detail.status) && (
                <button className={moduleStyles.deleteBtn} onClick={() => runAction('cancel', detail)}>Cancel order</button>
              )}
              <button className={moduleStyles.cancelBtn} onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(completeFor)} onClose={() => setCompleteFor(null)} title={`Complete ${completeFor?.productionNumber || 'order'}`} wide>
        {completeFor && (
          <form onSubmit={handleComplete} className={moduleStyles.form}>
            {completeError && <div className={moduleStyles.error}>{completeError}</div>}
            <p className={local.note}>
              Completing this order consumes the BOM materials FIFO from batch stock and creates finished batches, stock and ledger entries.
              BOM output is {formatQty(completeFor.bomOutputQuantity)} {completeFor.bomOutputUnitSymbol || ''}; the scale is based on the total output below.
            </p>

            <div>
              <div className={local.outputHeader}>
                <span>Product</span>
                <span>Quantity</span>
                <span>Unit</span>
                <span>Batch number</span>
                <span>Manufactured</span>
                <span>Unit cost</span>
                <span />
              </div>
              <div className={local.lineItems}>
                {outputLines.map((line) => (
                  <div className={local.outputRow} key={line.key}>
                    <select value={line.finishedProductId} onChange={(e) => changeOutput(line.key, 'finishedProductId', e.target.value)}>
                      <option value="">Select product...</option>
                      {products.map((p) => <option key={p.id} value={p.id}>{p.sku} · {p.name}</option>)}
                    </select>
                    <input type="number" min="0.0001" step="0.0001" value={line.outputQuantity}
                      onChange={(e) => changeOutput(line.key, 'outputQuantity', e.target.value)} placeholder="0" />
                    <select value={line.unitId} onChange={(e) => changeOutput(line.key, 'unitId', e.target.value)}>
                      <option value="">Unit</option>
                      {units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                    </select>
                    <input value={line.batchNumber} onChange={(e) => changeOutput(line.key, 'batchNumber', e.target.value)} placeholder="Batch number" />
                    <input type="date" value={line.manufacturingDate} onChange={(e) => changeOutput(line.key, 'manufacturingDate', e.target.value)} />
                    <input type="number" min="0" step="0.01" value={line.manualCost}
                      onChange={(e) => changeOutput(line.key, 'manualCost', e.target.value)} placeholder="₹0.00" />
                    <button type="button" className={local.dangerSmall}
                      onClick={() => setOutputLines((current) => current.filter((item) => item.key !== line.key))}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className={`${local.smallBtn} ${local.addLineBtn}`}
                onClick={() => setOutputLines((current) => [...current, newOutput(
                  completeFor.finishedProductId,
                  completeFor.bomOutputUnitId,
                  completeFor.productionNumber,
                  current.length,
                )])}
              >
                + Add output
              </button>
            </div>

            <p className={local.hint}>
              Unit cost is entered manually and stored on the finished batch and stock ledger. Batch numbers cannot be duplicated.
            </p>

            <div className={moduleStyles.formActions}>
              <button type="button" className={moduleStyles.cancelBtn} onClick={() => setCompleteFor(null)}>Cancel</button>
              <button type="submit" className={moduleStyles.primaryBtn} disabled={completing}>
                {completing ? 'Completing...' : 'Complete & post stock'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
