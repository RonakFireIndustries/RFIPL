import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import {
  createInventoryUnit,
  createUnitConversion,
  deleteInventoryUnit,
  deleteUnitConversion,
  getInventoryUnits,
  getUnitConversions,
  updateInventoryUnit,
} from '@/api/inventory';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from '../ModulePage.module.css';
import local from './Inventory.module.css';
import { titleCase } from './utils';

const UNIT_TYPES = ['weight', 'length', 'volume', 'quantity', 'other'];

const EMPTY = {
  name: '',
  symbol: '',
  unitType: 'quantity',
  isBaseUnit: false,
  isActive: true,
};

const EMPTY_CONVERSION = { toUnitId: '', conversionFactor: '' };

export default function Units() {
  const { accessToken } = useAuth();
  const { success, error: toastError, confirm } = useInteractions();

  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [fromUnitId, setFromUnitId] = useState('');
  const [conversions, setConversions] = useState([]);
  const [conversionForm, setConversionForm] = useState(EMPTY_CONVERSION);
  const [conversionError, setConversionError] = useState('');
  const [conversionSaving, setConversionSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setUnits(await getInventoryUnits(accessToken));
    } catch (err) {
      toastError(err.message || 'Failed to load units');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const loadConversions = useCallback(async (unitId) => {
    try {
      setConversions(await getUnitConversions(unitId, accessToken));
    } catch (err) {
      toastError(err.message || 'Failed to load conversions');
    }
  }, [accessToken, toastError]);

  useEffect(() => {
    if (!fromUnitId) return;
    loadConversions(fromUnitId);
  }, [fromUnitId, loadConversions]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      name: row.name,
      symbol: row.symbol,
      unitType: row.unitType,
      isBaseUnit: !!row.isBaseUnit,
      isActive: !!row.isActive,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const payload = { ...form, isBaseUnit: form.isBaseUnit ? 1 : 0, isActive: form.isActive ? 1 : 0 };
      if (editing) {
        await updateInventoryUnit(editing.id, payload, accessToken);
        success(`Unit "${form.name}" updated`);
      } else {
        await createInventoryUnit(payload, accessToken);
        success(`Unit "${form.name}" created`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to save unit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Delete unit',
      message: `Delete unit "${row.name}"? Materials that use this unit must be changed first.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteInventoryUnit(row.id, accessToken);
      success(`Unit "${row.name}" deleted`);
      if (String(fromUnitId) === String(row.id)) {
        setFromUnitId('');
        setConversions([]);
      }
      await load();
    } catch (err) {
      toastError(err.message || 'Failed to delete unit');
    }
  };

  const handleAddConversion = async (e) => {
    e.preventDefault();
    setConversionError('');
    if (!fromUnitId) {
      setConversionError('Select a unit to convert from');
      return;
    }
    if (!conversionForm.toUnitId) {
      setConversionError('Select the unit to convert to');
      return;
    }
    if (String(conversionForm.toUnitId) === String(fromUnitId)) {
      setConversionError('Cannot convert a unit to itself');
      return;
    }
    if (!conversionForm.conversionFactor || Number(conversionForm.conversionFactor) <= 0) {
      setConversionError('Conversion factor must be greater than zero');
      return;
    }
    setConversionSaving(true);
    try {
      await createUnitConversion(
        fromUnitId,
        {
          toUnitId: conversionForm.toUnitId,
          conversionFactor: conversionForm.conversionFactor,
        },
        accessToken
      );
      setConversionForm(EMPTY_CONVERSION);
      await loadConversions(fromUnitId);
      success('Conversion added');
    } catch (err) {
      setConversionError(err.message || 'Failed to add conversion');
    } finally {
      setConversionSaving(false);
    }
  };

  const handleDeleteConversion = async (conversion) => {
    const ok = await confirm({
      title: 'Delete conversion',
      message: `Remove conversion to "${conversion.toUnitName}"?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteUnitConversion(fromUnitId, conversion.id, accessToken);
      await loadConversions(fromUnitId);
      success('Conversion removed');
    } catch (err) {
      toastError(err.message || 'Failed to delete conversion');
    }
  };

  const columns = [
    { key: 'name', label: 'Unit' },
    { key: 'symbol', label: 'Symbol', width: '100px' },
    {
      key: 'unitType',
      label: 'Type',
      width: '120px',
      render: (value) => <span className={`${styles.badge} ${local.badgeBlue}`}>{titleCase(value)}</span>,
    },
    {
      key: 'isBaseUnit',
      label: 'Base',
      width: '90px',
      render: (value) => (value ? <span className={styles.badgeGreen}>Base</span> : <span className={local.subtle}>—</span>),
    },
    {
      key: 'isActive',
      label: 'Status',
      width: '100px',
      render: (value) => (
        <span className={value ? styles.badgeGreen : styles.badgeGray}>{value ? 'Active' : 'Inactive'}</span>
      ),
    },
    {
      key: 'id',
      label: '',
      width: '150px',
      render: (_, row) => (
        <div className={styles.actions}>
          <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); openEdit(row); }}>Edit</button>
          <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>Delete</button>
        </div>
      ),
    },
  ];

  const fromUnit = units.find((u) => String(u.id) === String(fromUnitId));
  const conversionTargets = units.filter((u) => String(u.id) !== String(fromUnitId));

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Units</h1>
          <p className={styles.pageSub}>{units.length} units of measure</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Unit</button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={units}
          searchable
          searchPlaceholder="Search units..."
          emptyMessage="No units yet. Create your first unit of measure."
        />
      )}

      <div className={`${local.panel} ${local.sectionGap}`}>
        <div className={local.panelHeader}>
          <div>
            <h2 className={local.panelTitle}>Unit conversions</h2>
            <p className={local.panelSub}>
              Define how quantities of one unit convert into another, for example 1 KG = 1000 G.
            </p>
          </div>
        </div>

        <div className={`${local.filterBar} ${local.inlineActions}`}>
          <div className={local.filterField}>
            <label className={local.filterLabel}>Convert from</label>
            <select
              className={`${local.filterInput} ${local.conversionSelect}`}
              value={fromUnitId}
              onChange={(e) => {
                setFromUnitId(e.target.value);
                if (!e.target.value) setConversions([]);
                setConversionError('');
              }}
            >
              <option value="">Select unit...</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>
              ))}
            </select>
          </div>
        </div>

        {!fromUnitId ? (
          <p className={local.hint}>Select a unit to view and manage its conversions.</p>
        ) : (
          <>
            <form className={`${local.inlineForm} ${local.sectionGap}`} onSubmit={handleAddConversion}>
              <div className={local.filterField}>
                <label className={local.filterLabel}>Convert to</label>
                <select
                  className={local.filterInput}
                  value={conversionForm.toUnitId}
                  onChange={(e) => setConversionForm({ ...conversionForm, toUnitId: e.target.value })}
                >
                  <option value="">Select unit...</option>
                  {conversionTargets.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.name} ({unit.symbol})</option>
                  ))}
                </select>
              </div>
              <div className={local.filterField}>
                <label className={local.filterLabel}>Factor</label>
                <input
                  className={local.filterInput}
                  type="number"
                  min="0"
                  step="any"
                  placeholder={`e.g. 1000`}
                  value={conversionForm.conversionFactor}
                  onChange={(e) => setConversionForm({ ...conversionForm, conversionFactor: e.target.value })}
                />
              </div>
              <button className={styles.primaryBtn} type="submit" disabled={conversionSaving}>
                {conversionSaving ? 'Adding...' : '+ Add Conversion'}
              </button>
            </form>
            {conversionError && <div className={`${styles.error} ${local.sectionGap}`}>{conversionError}</div>}
            <p className={local.hint}>
              {fromUnit
                ? `1 ${fromUnit.symbol} equals the factor below, in the target unit.`
                : ''}
            </p>

            <div className={local.sectionGap}>
              {conversions.length === 0 ? (
                <p className={local.hint}>No conversions defined for {fromUnit?.name}.</p>
              ) : (
                <Table
                  columns={[
                    { key: 'toUnitName', label: 'To unit', render: (value) => value || '—' },
                    { key: 'toUnitSymbol', label: 'Symbol', width: '100px' },
                    {
                      key: 'conversionFactor',
                      label: 'Factor',
                      width: '140px',
                      render: (value) => <span className={local.mono}>{Number(value)}</span>,
                    },
                    {
                      key: 'id',
                      label: '',
                      width: '110px',
                      render: (_, row) => (
                        <button className={styles.deleteBtn} onClick={() => handleDeleteConversion(row)}>Remove</button>
                      ),
                    },
                  ]}
                  data={conversions}
                  emptyMessage="No conversions"
                />
              )}
            </div>
          </>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Unit' : 'New Unit'}>
        <form onSubmit={handleSubmit} className={styles.form}>
          {formError && <div className={styles.error}>{formError}</div>}
          <FormField
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Kilogram"
            required
          />
          <FormField
            label="Symbol"
            value={form.symbol}
            onChange={(e) => setForm({ ...form, symbol: e.target.value })}
            placeholder="KG"
            required
          />
          <FormField
            label="Type"
            type="select"
            value={form.unitType}
            onChange={(e) => setForm({ ...form, unitType: e.target.value })}
            options={UNIT_TYPES.map((type) => ({ value: type, label: titleCase(type) }))}
            required
          />
          <FormField
            label="Base unit"
            type="select"
            value={form.isBaseUnit ? '1' : '0'}
            onChange={(e) => setForm({ ...form, isBaseUnit: e.target.value === '1' })}
            options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]}
          />
          <FormField
            label="Active"
            type="select"
            value={form.isActive ? '1' : '0'}
            onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}
            options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]}
          />
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
