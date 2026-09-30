import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { createEmployee, updateEmployee } from '@/api/employees';
import { getUsers } from '@/api/users';
import { getBankDetailsByEmployee, createBankDetails, updateBankDetails } from '@/api/bankDetails';
import FormField from '@/components/ui/FormField';
import { useInteractions } from '@/components/ui/interactions';
import styles from '@/pages/ModulePage.module.css';

const EMPLOYMENT_TYPES = [
  { value: 'permanent', label: 'Permanent' },
  { value: 'probation', label: 'Probation' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'intern', label: 'Intern' },
];

const EMPLOYMENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'resigned', label: 'Resigned' },
  { value: 'terminated', label: 'Terminated' },
  { value: 'on_notice', label: 'On Notice' },
];

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

function getDefault(employee) {
  if (employee) {
    return {
      employeeCode: employee.employeeCode || '',
      firstName: employee.firstName || '',
      lastName: employee.lastName || '',
      dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.split('T')[0] : '',
      gender: employee.gender || '',
      personalEmail: employee.personalEmail || '',
      phone: employee.phone || '',
      currentAddress: employee.currentAddress || '',
      permanentAddress: employee.permanentAddress || '',
      city: employee.city || '',
      state: employee.state || '',
      country: employee.country || 'India',
      pincode: employee.pincode || '',
      departmentId: employee.departmentId || '',
      designationId: employee.designationId || '',
      reportingManagerId: employee.reportingManagerId || '',
      joiningDate: employee.joiningDate ? employee.joiningDate.split('T')[0] : '',
      employmentType: employee.employmentType || '',
      employmentStatus: employee.employmentStatus || 'active',
    };
  }
  return {
    employeeCode: '', firstName: '', lastName: '', dateOfBirth: '', gender: '',
    personalEmail: '', phone: '', currentAddress: '', permanentAddress: '',
    city: '', state: '', country: 'India', pincode: '',
    departmentId: '', designationId: '', reportingManagerId: '',
    joiningDate: '', employmentType: '', employmentStatus: 'active',
  };
}

const EMPTY_BANK = { accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '', branchName: '' };

function getBankDefault(bank) {
  if (bank) {
    return {
      accountHolderName: bank.accountHolderName || '',
      bankName: bank.bankName || '',
      accountNumber: bank.accountNumberEncrypted || '',
      ifscCode: bank.ifscCode || '',
      branchName: bank.branchName || '',
    };
  }
  return EMPTY_BANK;
}

export default function EmployeeForm({ employee, departments, designations, onSave, onCancel }) {
  const { accessToken } = useAuth();
  const [form, setForm] = useState(() => getDefault(employee));
  const [bankForm, setBankForm] = useState(EMPTY_BANK);
  const [existingBankId, setExistingBankId] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setForm(getDefault(employee));
    if (employee?.id) {
      getBankDetailsByEmployee(employee.id, accessToken)
        .then((res) => {
          const bank = Array.isArray(res) ? res[0] : res;
          if (bank) {
            setBankForm(getBankDefault(bank));
            setExistingBankId(bank.id);
          } else {
            setBankForm(EMPTY_BANK);
            setExistingBankId(null);
          }
        })
        .catch(() => { setBankForm(EMPTY_BANK); setExistingBankId(null); });
    } else {
      setBankForm(EMPTY_BANK);
      setExistingBankId(null);
    }
  }, [employee, accessToken]);

  useEffect(() => {
    getUsers(accessToken)
      .then((res) => setUsers(Array.isArray(res) ? res : []))
      .catch(() => {});
  }, [accessToken]);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const setBank = (key, val) => setBankForm((f) => ({ ...f, [key]: val }));

  const hasBankData = bankForm.accountHolderName || bankForm.bankName || bankForm.accountNumber || bankForm.ifscCode;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.firstName || !form.employeeCode || !form.departmentId || !form.designationId || !form.joiningDate || !form.employmentType) {
      setError('Please fill all required fields');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...form };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === '' || payload[k] === null) payload[k] = null;
      });

      let empId;
      if (employee) {
        await updateEmployee(employee.id, payload, accessToken);
        empId = employee.id;
      } else {
        const created = await createEmployee(payload, accessToken);
        empId = created.id;
        if (created.autoLoginEmail && created.autoLoginPassword) {
          onSave?.({ autoLoginEmail: created.autoLoginEmail, autoLoginPassword: created.autoLoginPassword });
        } else {
          onSave?.();
        }
      }

      if (hasBankData && empId) {
        const bankPayload = {
          employeeId: empId,
          accountHolderName: bankForm.accountHolderName || null,
          bankName: bankForm.bankName || null,
          accountNumberEncrypted: bankForm.accountNumber || null,
          ifscCode: bankForm.ifscCode || null,
          branchName: bankForm.branchName || null,
          isActive: true,
        };
        if (existingBankId) await updateBankDetails(existingBankId, bankPayload, accessToken);
        else await createBankDetails(bankPayload, accessToken);
      }

      onSave();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {error && <div className={styles.error}>{error}</div>}

      <h4 style={{ margin: '0 0 8px', fontSize: '13px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Basic Info</h4>
      <div className={styles.formGrid}>
        <FormField label="Employee Code" value={form.employeeCode} onChange={(e) => set('employeeCode', e.target.value)} required />
        <FormField label="First Name" value={form.firstName} onChange={(e) => set('firstName', e.target.value)} required />
        <FormField label="Last Name" value={form.lastName} onChange={(e) => set('lastName', e.target.value)} />
        <FormField label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
        <FormField label="Gender" type="select" value={form.gender} onChange={(e) => set('gender', e.target.value)} options={GENDERS} />
        <FormField label="Personal Email" type="email" value={form.personalEmail} onChange={(e) => set('personalEmail', e.target.value)} />
        <FormField label="Phone" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
      </div>

      <h4 style={{ margin: '12px 0 8px', fontSize: '13px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</h4>
      <FormField label="Current Address" type="textarea" value={form.currentAddress} onChange={(e) => set('currentAddress', e.target.value)} />
      <div className={styles.formGrid}>
        <FormField label="City" value={form.city} onChange={(e) => set('city', e.target.value)} />
        <FormField label="State" value={form.state} onChange={(e) => set('state', e.target.value)} />
        <FormField label="Country" value={form.country} onChange={(e) => set('country', e.target.value)} />
        <FormField label="Pincode" value={form.pincode} onChange={(e) => set('pincode', e.target.value)} />
      </div>

      <h4 style={{ margin: '12px 0 8px', fontSize: '13px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Employment</h4>
      <div className={styles.formGrid}>
        <FormField label="Department" type="select" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)} options={departments.map((d) => ({ value: d.id, label: d.name }))} required />
        <FormField label="Designation" type="select" value={form.designationId} onChange={(e) => set('designationId', e.target.value)} options={designations.map((d) => ({ value: d.id, label: d.name }))} required />
        <FormField label="Joining Date" type="date" value={form.joiningDate} onChange={(e) => set('joiningDate', e.target.value)} required />
        <FormField label="Employment Type" type="select" value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)} options={EMPLOYMENT_TYPES} required />
        {form.loginInfoNotice && (
          <p style={{ gridColumn: '1 / -1', fontSize: '12px', color: '#6b7280', fontStyle: 'italic', margin: '0' }}>
            Login account will be auto-created: <strong>{form.loginInfoNotice}</strong>
          </p>
        )}
        {employee && <FormField label="Status" type="select" value={form.employmentStatus} onChange={(e) => set('employmentStatus', e.target.value)} options={EMPLOYMENT_STATUSES} />}
      </div>

      <h4 style={{ margin: '12px 0 8px', fontSize: '13px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bank Details</h4>
      <div className={styles.formGrid}>
        <FormField label="Account Holder Name" value={bankForm.accountHolderName} onChange={(e) => setBank('accountHolderName', e.target.value)} />
        <FormField label="Bank Name" value={bankForm.bankName} onChange={(e) => setBank('bankName', e.target.value)} />
        <FormField label="Account Number" value={bankForm.accountNumber} onChange={(e) => setBank('accountNumber', e.target.value)} />
        <FormField label="IFSC Code" value={bankForm.ifscCode} onChange={(e) => setBank('ifscCode', e.target.value)} />
        <FormField label="Branch" value={bankForm.branchName} onChange={(e) => setBank('branchName', e.target.value)} />
      </div>

      <div className={styles.formActions}>
        <button type="button" className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
        <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : employee ? 'Update' : 'Create'}</button>
      </div>
    </form>
  );
}