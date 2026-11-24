import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useInteractions } from '@/components/ui/interactions';
import {
  createSupplier,
  deleteSupplier,
  getSuppliers,
  updateSupplier,
} from '@/api/inventory';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import styles from '../ModulePage.module.css';

const EMPTY = {
  supplierCode: '',
  companyName: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  city: '',
  state: '',
  country: 'India',
  pincode: '',
  gstNumber: '',
  panNumber: '',
  isActive: true,
};

export default function Suppliers() {
  const { accessToken } = useAuth();
  const { success, error: toastError, confirm } = useInteractions();

  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    try {
      setSuppliers(await getSuppliers(accessToken));
    } catch (err) {
      toastError(err.message || 'Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [accessToken, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    setForm({
      supplierCode: row.supplierCode || '',
      companyName: row.companyName || '',
      contactPerson: row.contactPerson || '',
      phone: row.phone || '',
      email: row.email || '',
      address: row.address || '',
      city: row.city || '',
      state: row.state || '',
      country: row.country || 'India',
      pincode: row.pincode || '',
      gstNumber: row.gstNumber || '',
      panNumber: row.panNumber || '',
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
      const payload = { ...form, isActive: form.isActive ? 1 : 0 };
      if (editing) {
        await updateSupplier(editing.id, payload, accessToken);
        success(`Supplier "${form.companyName}" updated`);
      } else {
        await createSupplier(payload, accessToken);
        success(`Supplier "${form.companyName}" created`);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setFormError(err.message || 'Failed to save supplier');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    const ok = await confirm({
      title: 'Delete supplier',
      message: `Delete supplier "${row.companyName}"?`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteSupplier(row.id, accessToken);
      success(`Supplier "${row.companyName}" deleted`);
      await load();
    } catch (err) {
      toastError(err.message || 'Failed to delete supplier');
    }
  };

  const columns = [
    { key: 'supplierCode', label: 'Code', width: '110px' },
    { key: 'companyName', label: 'Company' },
    { key: 'contactPerson', label: 'Contact' },
    { key: 'phone', label: 'Phone', width: '140px' },
    { key: 'city', label: 'City', width: '120px' },
    { key: 'gstNumber', label: 'GSTIN', width: '160px' },
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

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Suppliers</h1>
          <p className={styles.pageSub}>{suppliers.length} suppliers</p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Supplier</button>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <Table
          columns={columns}
          data={suppliers}
          searchable
          searchPlaceholder="Search by code, company or contact..."
          emptyMessage="No suppliers yet. Add a supplier before linking materials."
        />
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Supplier' : 'New Supplier'}
        wide
      >
        <form onSubmit={handleSubmit} className={styles.form}>
          {formError && <div className={styles.error}>{formError}</div>}

          <div className={styles.formGrid}>
            <FormField
              label="Supplier code"
              value={form.supplierCode}
              onChange={(e) => setForm({ ...form, supplierCode: e.target.value })}
              placeholder="SUP-001"
              required
            />
            <FormField
              label="Company name"
              value={form.companyName}
              onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              placeholder="Ronak Steel Traders"
              required
            />
            <FormField
              label="Contact person"
              value={form.contactPerson}
              onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
            />
            <FormField
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <FormField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <FormField
              label="GSTIN"
              value={form.gstNumber}
              onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
            />
            <FormField
              label="PAN"
              value={form.panNumber}
              onChange={(e) => setForm({ ...form, panNumber: e.target.value })}
            />
            <FormField
              label="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
            <FormField
              label="State"
              value={form.state}
              onChange={(e) => setForm({ ...form, state: e.target.value })}
            />
            <FormField
              label="Pincode"
              value={form.pincode}
              onChange={(e) => setForm({ ...form, pincode: e.target.value })}
            />
            <FormField
              label="Country"
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
            />
            <FormField
              label="Active"
              type="select"
              value={form.isActive ? '1' : '0'}
              onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}
              options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]}
            />
          </div>

          <FormField
            label="Address"
            type="textarea"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
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
