import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import moduleStyles from '../ModulePage.module.css';
import local from './Purchasing.module.css';
import {
  approvePurchaseRequest,
  createPurchaseRequest,
  deletePurchaseRequest,
  getInventoryUnits,
  getPurchaseRequests,
  getRawMaterials,
  rejectPurchaseRequest,
  submitPurchaseRequest,
} from '@/api/inventory';
import { getDepartments } from '@/api/departments';
import { formatDate, titleCase } from './utils';
import { DetailField, StatusBadge } from './PurchasingShared';

function newLine() {
  return {
    key: `${Date.now()}-${Math.random()}`,
    rawMaterialId: '',
    quantity: '',
    unitId: '',
    remarks: '',
  };
}

export default function PurchasingRequests() {
  const { accessToken } = useAuth();
  const { success, error: toastError } = useInteractions();

  const [rows, setRows] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [units, setUnits] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const [createOpen, setCreateOpen] = useState(false);
  const [purpose, setPurpose] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [lines, setLines] = useState([newLine()]);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [detail, setDetail] = useState(null);
  const [decision, setDecision] = useState(null);
  const [remarks, setRemarks] = useState('');

  const load = useCallback(async () => {
    try {
      const [requests, materialRows, unitRows, departmentRows] = await Promise.all([
        getPurchaseRequests(accessToken),
        getRawMaterials(accessToken),
        getInventoryUnits(accessToken),
        getDepartments(accessToken),
      ]);
      setRows(requests);
      setMaterials(materialRows);
      setUnits(unitRows);
      setDepartments(departmentRows);
    } catch (err) {
      toastError(err.message || 'Failed to load purchase requests');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setPurpose('');
    setDepartmentId('');
    setRequiredDate('');
    setLines([newLine()]);
    setFormError('');
    setCreateOpen(true);
  };

  const changeLine = (key, field, value) => {
    setLines((current) => current.map((line) => {
      if (line.key !== key) return line;
      const next = { ...line, [field]: value };
      if (field === 'rawMaterialId') {
        const material = materials.find((m) => String(m.id) === String(value));
        if (material) next.unitId = String(material.unitId || '');
      }
      return next;
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setFormError('');
    const items = lines
      .filter((line) => line.rawMaterialId)
      .map((line) => ({
        rawMaterialId: line.rawMaterialId,
        quantity: line.quantity,
        unitId: line.unitId,
        remarks: line.remarks || null,
      }));
    if (items.length === 0) {
      setFormError('Add at least one material line');
      return;
    }
    if (items.some((item) => !item.quantity || !item.unitId)) {
      setFormError('Every line needs a quantity and unit');
      return;
    }

    setSubmitting(true);
    try {
      await createPurchaseRequest({
        departmentId: departmentId || null,
        requiredDate: requiredDate || null,
        purpose: purpose || null,
        items,
      }, accessToken);
      success('Purchase request created as draft');
      setCreateOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to create purchase request');
    } finally {
      setSubmitting(false);
    }
  };

  const runAction = async (action, row) => {
    try {
      if (action === 'submit') await submitPurchaseRequest(row.id, accessToken);
      if (action === 'delete') {
        if (!window.confirm(`Delete ${row.requestNumber}?`)) return;
        await deletePurchaseRequest(row.id, accessToken);
      }
      success(`${row.requestNumber} ${action === 'delete' ? 'deleted' : 'submitted'}`);
      setDetail(null);
      await load();
    } catch (err) {
      toastError(err.message || `Failed to ${action} request`);
    }
  };

  const openDecision = (type, row) => {
    setDecision({ type, row });
    setRemarks('');
  };

  const handleDecision = async (e) => {
    e.preventDefault();
    if (!decision) return;
    try {
      const payload = { managerRemarks: remarks || null };
      if (decision.type === 'approve') await approvePurchaseRequest(decision.row.id, payload, accessToken);
      else await rejectPurchaseRequest(decision.row.id, payload, accessToken);
      success(`${decision.row.requestNumber} ${decision.type === 'approve' ? 'approved' : 'rejected'}`);
      setDecision(null);
      setDetail(null);
      await load();
    } catch (err) {
      toastError(err.message || 'Failed to update request');
    }
  };

  const columns = [
    {
      key: 'requestNumber',
      label: 'Request',
      render: (value, row) => (
        <div>
          <span className={local.docNumber}>{value}</span>
          <span className={local.subtleBlock}>{formatDate(row.requestDate)}</span>
        </div>
      ),
    },
    { key: 'departmentName', label: 'Department', render: (value) => value || '—' },
    { key: 'purpose', label: 'Purpose', render: (value) => value || '—' },
    { key: 'status', label: 'Status', width: '150px', render: (value) => <StatusBadge status={value} /> },
    {
      key: 'id',
      label: 'Actions',
      width: '230px',
      render: (_, row) => (
        <div className={moduleStyles.actions} onClick={(e) => e.stopPropagation()}>
          {row.status === 'draft' && (
            <>
              <button className={moduleStyles.editBtn} onClick={() => runAction('submit', row)}>Submit</button>
              <button className={moduleStyles.deleteBtn} onClick={() => runAction('delete', row)}>Delete</button>
            </>
          )}
          {row.status === 'pending_manager' && (
            <>
              <button className={moduleStyles.editBtn} onClick={() => openDecision('approve', row)}>Approve</button>
              <button className={moduleStyles.deleteBtn} onClick={() => openDecision('reject', row)}>Reject</button>
            </>
          )}
          {row.status === 'manager_approved' && <span className={local.progressText}>Ready for PO</span>}
          {['rejected', 'converted_to_po', 'cancelled'].includes(row.status) && <span className={local.progressText}>Closed</span>}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className={moduleStyles.pageHeader}>
        <div>
          <h2 className={local.sectionTitle}>Purchase Requests</h2>
          <p className={moduleStyles.pageSub}>Draft → manager approval → ready for purchase order.</p>
        </div>
        <button className={moduleStyles.primaryBtn} onClick={openCreate}>+ New Request</button>
      </div>

      {loading ? (
        <div className={moduleStyles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={rows}
          onRowClick={setDetail}
          searchable
          searchKeys={['requestNumber', 'purpose', 'departmentName', 'status']}
          searchPlaceholder="Search requests..."
          emptyMessage="No purchase requests yet. Create a draft to start the approval flow."
        />
      )}

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New purchase request" wide>
        <form onSubmit={handleCreate} className={moduleStyles.form}>
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
              label="Required by"
              type="date"
              value={requiredDate}
              onChange={(e) => setRequiredDate(e.target.value)}
            />
          </div>

          <FormField
            label="Purpose"
            type="textarea"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder="Why are these materials needed?"
          />

          <div>
            <div className={local.lineHeader}>
              <span>Material</span>
              <span>Quantity</span>
              <span>Unit</span>
              <span>Remarks</span>
              <span />
            </div>
            <div className={local.lineItems}>
              {lines.map((line) => (
                <div className={local.lineRow} key={line.key}>
                  <select value={line.rawMaterialId} onChange={(e) => changeLine(line.key, 'rawMaterialId', e.target.value)}>
                    <option value="">Select material...</option>
                    {materials.map((m) => <option key={m.id} value={m.id}>{m.name} ({m.sku})</option>)}
                  </select>
                  <input type="number" min="0" step="0.0001" value={line.quantity}
                    onChange={(e) => changeLine(line.key, 'quantity', e.target.value)} placeholder="0" />
                  <select value={line.unitId} onChange={(e) => changeLine(line.key, 'unitId', e.target.value)}>
                    <option value="">Unit</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.symbol}</option>)}
                  </select>
                  <input value={line.remarks} onChange={(e) => changeLine(line.key, 'remarks', e.target.value)} placeholder="Optional" />
                  <button type="button" className={local.dangerSmall}
                    onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}>
                    Remove
                  </button>
                </div>
              ))}
            </div>
            <button type="button" className={`${local.smallBtn} ${local.addLineBtn}`} onClick={() => setLines((current) => [...current, newLine()])}>
              + Add line
            </button>
          </div>

          <p className={local.hint}>Request numbers are generated automatically. The request starts as a draft.</p>

          <div className={moduleStyles.formActions}>
            <button type="button" className={moduleStyles.cancelBtn} onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="submit" className={moduleStyles.primaryBtn} disabled={submitting}>
              {submitting ? 'Saving...' : 'Create request'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(detail)} onClose={() => setDetail(null)} title={detail?.requestNumber || 'Purchase request'} wide>
        {detail && (
          <div>
            <div className={local.detailGrid}>
              <DetailField label="Status"><StatusBadge status={detail.status} /></DetailField>
              <DetailField label="Requested">{formatDate(detail.requestDate)}</DetailField>
              <DetailField label="Required by">{formatDate(detail.requiredDate)}</DetailField>
              <DetailField label="Department">{detail.departmentName || '—'}</DetailField>
            </div>
            {detail.purpose && <p className={local.note}>{detail.purpose}</p>}
            <h3 className={local.sectionTitle}>Items</h3>
            <Table
              columns={[
                { key: 'rawMaterialName', label: 'Material' },
                { key: 'quantity', label: 'Quantity', align: 'right', render: (v, r) => `${v} ${r.unitSymbol || ''}` },
                { key: 'remarks', label: 'Remarks', render: (v) => v || '—' },
              ]}
              data={detail.items || []}
              emptyMessage="No items."
            />
            <div className={moduleStyles.formActions}>
              {detail.status === 'draft' && (
                <button className={moduleStyles.primaryBtn} onClick={() => runAction('submit', detail)}>Submit for approval</button>
              )}
              {detail.status === 'pending_manager' && (
                <>
                  <button className={moduleStyles.primaryBtn} onClick={() => openDecision('approve', detail)}>Approve</button>
                  <button className={moduleStyles.deleteBtn} onClick={() => openDecision('reject', detail)}>Reject</button>
                </>
              )}
              <button className={moduleStyles.cancelBtn} onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={Boolean(decision)} onClose={() => setDecision(null)} title={`${titleCase(decision?.type)} purchase request`}>
        {decision && (
          <form onSubmit={handleDecision} className={moduleStyles.form}>
            <p className={local.note}>
              {decision.row.requestNumber} · {decision.row.purpose || 'No purpose recorded'}
            </p>
            <FormField
              label="Remarks"
              type="textarea"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional approval note"
            />
            <div className={moduleStyles.formActions}>
              <button type="button" className={moduleStyles.cancelBtn} onClick={() => setDecision(null)}>Cancel</button>
              <button type="submit" className={moduleStyles.primaryBtn}>Confirm {decision.type}</button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
