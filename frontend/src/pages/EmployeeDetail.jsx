import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { getEmployee } from '@/api/employees';
import { getBankDetailsByEmployee } from '@/api/bankDetails';
import { getDocumentsByEmployee, createDocument, updateDocument, deleteDocument } from '@/api/documents';
import { getEmergencyContactByEmployee, createEmergencyContact, updateEmergencyContact } from '@/api/emergencyContacts';
import { getShiftAssignments, createShiftAssignment, updateShiftAssignment, deleteShiftAssignment } from '@/api/shiftAssignments';
import { getSalaryStructures, createSalaryStructure, updateSalaryStructure, deleteSalaryStructure } from '@/api/salaryStructures';
import { getOvertimeRates } from '@/api/overtimeRates';
import { getShifts } from '@/api/shifts';
import { getSalaryStructuresMaster } from '@/api/salaryStructureMaster';
import Accordion from '@/components/ui/Accordion';
import Drawer from '@/components/ui/Drawer';
import FormField from '@/components/ui/FormField';
import styles from './EmployeeDetail.module.css';
import modStyles from './ModulePage.module.css';

export default function EmployeeDetail() {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [emp, setEmp] = useState(null);
  const [bank, setBank] = useState(null);
  const [docs, setDocs] = useState([]);
  const [contact, setContact] = useState(null);
  const [shifts, setShifts] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [otRates, setOtRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawer, setDrawer] = useState(null);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shiftOptions, setShiftOptions] = useState([]);
  const [structureOptions, setStructureOptions] = useState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [e, b, d, c, s, sl, o] = await Promise.all([
        getEmployee(id, accessToken),
        getBankDetailsByEmployee(id, accessToken).catch(() => []),
        getDocumentsByEmployee(id, accessToken).catch(() => []),
        getEmergencyContactByEmployee(id, accessToken).catch(() => []),
        getShiftAssignments(id, accessToken).catch(() => []),
        getSalaryStructures(id, accessToken).catch(() => []),
        getOvertimeRates(id, accessToken).catch(() => []),
      ]);
      const [shifts, structs] = await Promise.all([
        getShifts(accessToken).catch(() => []),
        getSalaryStructuresMaster(accessToken).catch(() => []),
      ]);
      setEmp(e);
      setBank(Array.isArray(b) ? b[0] || null : b);
      setDocs(Array.isArray(d) ? d : []);
      setContact(Array.isArray(c) ? c[0] || null : c);
      setShifts(Array.isArray(s) ? s : []);
      setSalaries(Array.isArray(sl) ? sl : []);
      setOtRates(Array.isArray(o) ? o : []);
      setShiftOptions(Array.isArray(shifts) ? shifts : []);
      setStructureOptions(Array.isArray(structs) ? structs : []);
    } catch { navigate('/employees'); }
    setLoading(false);
  }, [id, accessToken, navigate]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const openDrawer = (type, data = null) => {
    setDrawer(type);
    setEditing(data);
    setError('');
    if (type === 'contact') setForm(data ? { ...data } : { name: '', relationship: '', phone: '' });
    else if (type === 'document') setForm(data ? {
      documentType: data.documentType,
      documentName: data.documentName,
      filePath: data.filePath,
      issuedDate: data.issuedDate?.split('T')[0] || '',
      expiryDate: data.expiryDate?.split('T')[0] || '',
    } : { documentType: '', documentName: '', filePath: '', issuedDate: '', expiryDate: '' });
    else if (type === 'shift') setForm(data ? {
      shiftId: String(data.shiftId),
      effectiveFrom: data.effectiveFrom?.split('T')[0] || '',
      effectiveTo: data.effectiveTo?.split('T')[0] || '',
      isActive: !!data.isActive,
    } : { shiftId: '', effectiveFrom: '', effectiveTo: '', isActive: true });
    else if (type === 'salary') setForm(data ? {
      salaryStructureId: String(data.salaryStructureId),
      effectiveFrom: data.effectiveFrom?.split('T')[0] || '',
      effectiveTo: data.effectiveTo?.split('T')[0] || '',
      status: data.status || 'active',
      revisionReason: data.revisionReason || '',
    } : { salaryStructureId: '', effectiveFrom: '', effectiveTo: '', status: 'active', revisionReason: '' });
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (contact) await updateEmergencyContact(contact.id, form, accessToken);
      else await createEmergencyContact({ ...form, employeeId: id }, accessToken);
      setDrawer(null);
      loadAll();
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleDocumentSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        documentType: form.documentType,
        documentName: form.documentName,
        filePath: form.filePath,
        issuedDate: form.issuedDate || null,
        expiryDate: form.expiryDate || null,
      };
      if (editing) await updateDocument(editing.id, payload, accessToken);
      else await createDocument({ ...payload, employeeId: id }, accessToken);
      setDrawer(null);
      loadAll();
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleShiftSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        shiftId: Number(form.shiftId),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        isActive: form.isActive,
      };
      if (editing) await updateShiftAssignment(editing.id, payload, accessToken);
      else await createShiftAssignment({ ...payload, employeeId: id }, accessToken);
      setDrawer(null);
      loadAll();
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleSalarySubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        salaryStructureId: Number(form.salaryStructureId),
        effectiveFrom: form.effectiveFrom,
        effectiveTo: form.effectiveTo || null,
        status: form.status,
        revisionReason: form.revisionReason || null,
      };
      if (editing) await updateSalaryStructure(editing.id, payload, accessToken);
      else await createSalaryStructure({ ...payload, employeeId: id }, accessToken);
      setDrawer(null);
      loadAll();
    } catch (err) { setError(err.message); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (type, item) => {
    const label = type === 'document' ? 'document' : type === 'shift' ? 'shift assignment' : 'salary structure';
    if (!confirm(`Delete this ${label}?`)) return;
    try {
      if (type === 'document') await deleteDocument(item.id, accessToken);
      else if (type === 'shift') await deleteShiftAssignment(item.id, accessToken);
      else await deleteSalaryStructure(item.id, accessToken);
      loadAll();
    } catch (err) { alert(err.message); }
  };

  if (loading) return <div className={styles.loading}>Loading employee...</div>;
  if (!emp) return null;

  const statusColor = { active: '#16a34a', inactive: '#6b7280', resigned: '#f59e0b', terminated: '#DC2626', on_notice: '#3b82f6' };

  const sections = [
    {
      title: 'Personal Information',
      content: (
        <div className={styles.infoGrid}>
          <InfoRow label="Employee Code" value={emp.employeeCode} />
          <InfoRow label="Full Name" value={`${emp.firstName} ${emp.lastName || ''}`} />
          <InfoRow label="Date of Birth" value={emp.dateOfBirth?.split('T')[0]} />
          <InfoRow label="Gender" value={emp.gender} />
          <InfoRow label="Email" value={emp.personalEmail} />
          <InfoRow label="Phone" value={emp.phone} />
          <InfoRow label="Address" value={emp.currentAddress} />
          <InfoRow label="City" value={emp.city} />
          <InfoRow label="State" value={emp.state} />
          <InfoRow label="Country" value={emp.country} />
          <InfoRow label="Department" value={emp.departmentName} />
          <InfoRow label="Designation" value={emp.designationName} />
          <InfoRow label="Reporting Manager" value={emp.reportingManagerName} />
          <InfoRow label="Joining Date" value={emp.joiningDate?.split('T')[0]} />
          <InfoRow label="Employment Type" value={emp.employmentType} />
          <InfoRow label="Status" value={<span style={{ color: statusColor[emp.employmentStatus], fontWeight: 600, textTransform: 'capitalize' }}>{emp.employmentStatus?.replace('_', ' ')}</span>} />
        </div>
      ),
    },
    {
      title: 'Bank Details',
      content: (
        <div>
          {bank ? (
            <div className={styles.infoGrid}>
              <InfoRow label="Account Holder" value={bank.accountHolderName} />
              <InfoRow label="Bank Name" value={bank.bankName} />
              <InfoRow label="Account Number" value={bank.accountNumberEncrypted ? '****' : '-'} />
              <InfoRow label="IFSC Code" value={bank.ifscCode} />
              <InfoRow label="Branch" value={bank.branchName} />
            </div>
          ) : <p className={styles.emptyText}>No bank details added</p>}
          <p className={styles.emptyText} style={{ marginTop: 8, fontSize: 12 }}>Edit bank details from the employee edit form.</p>
        </div>
      ),
    },
    {
      title: 'Emergency Contact',
      content: (
        <div>
          {contact ? (
            <div className={styles.infoGrid}>
              <InfoRow label="Name" value={contact.name} />
              <InfoRow label="Relationship" value={contact.relationship} />
              <InfoRow label="Phone" value={contact.phone} />
            </div>
          ) : <p className={styles.emptyText}>No emergency contact added</p>}
          <button className={styles.editLink} onClick={() => openDrawer('contact', contact)}>{contact ? 'Edit' : '+ Add'} Emergency Contact</button>
        </div>
      ),
    },
    {
      title: `Documents (${docs.length})`,
      content: (
        <div>
          {docs.length > 0 ? (
            <div className={styles.docList}>
              {docs.map((d) => (
                <div key={d.id} className={styles.docItem}>
                  <span className={styles.docType}>{d.documentType}</span>
                  <span>{d.documentName}</span>
                  {d.issuedDate && <span className={styles.docDate}>Issued: {d.issuedDate.split('T')[0]}</span>}
                  <div className={styles.docActions}>
                    <button className={styles.rowBtn} onClick={() => openDrawer('document', d)}>Edit</button>
                    <button className={styles.rowBtnDanger} onClick={() => handleDelete('document', d)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className={styles.emptyText}>No documents uploaded</p>}
          <button className={styles.editLink} onClick={() => openDrawer('document')}>+ Add Document</button>
        </div>
      ),
    },
    {
      title: `Shift Assignments (${shifts.length})`,
      content: (
        <div>
          {shifts.length > 0 ? (
            <div className={styles.tableList}>
              <div className={styles.tableHeader}><span>Shift</span><span>Time</span><span>From</span><span>To</span><span>Status</span><span>Actions</span></div>
              {shifts.map((s) => (
                <div key={s.id} className={styles.tableRow}>
                  <span>{s.shiftName || s.shiftId}</span>
                  <span>{s.startTime} - {s.endTime}</span>
                  <span>{s.effectiveFrom?.split('T')[0]}</span>
                  <span>{s.effectiveTo?.split('T')[0] || 'Ongoing'}</span>
                  <span className={s.isActive ? styles.badgeGreen : styles.badgeGray}>{s.isActive ? 'Active' : 'Inactive'}</span>
                  <div className={styles.rowActions}>
                    <button className={styles.rowBtn} onClick={() => openDrawer('shift', s)}>Edit</button>
                    <button className={styles.rowBtnDanger} onClick={() => handleDelete('shift', s)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className={styles.emptyText}>No shift assignments</p>}
          <button className={styles.editLink} onClick={() => openDrawer('shift')}>+ Assign Shift</button>
        </div>
      ),
    },
    {
      title: `Salary Structure (${salaries.length})`,
      content: (
        <div>
          {salaries.length > 0 ? (
            <div className={styles.tableList}>
              <div className={styles.tableHeader}><span>Structure</span><span>From</span><span>To</span><span>Status</span><span></span><span>Actions</span></div>
              {salaries.map((s) => (
                <div key={s.id} className={styles.tableRow}>
                  <span>{s.structureName || s.salaryStructureId}</span>
                  <span>{s.effectiveFrom?.split('T')[0]}</span>
                  <span>{s.effectiveTo?.split('T')[0] || 'Ongoing'}</span>
                  <span className={s.status === 'active' ? styles.badgeGreen : styles.badgeGray}>{s.status}</span>
                  <span></span>
                  <div className={styles.rowActions}>
                    <button className={styles.rowBtn} onClick={() => openDrawer('salary', s)}>Edit</button>
                    <button className={styles.rowBtnDanger} onClick={() => handleDelete('salary', s)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className={styles.emptyText}>No salary structure assigned</p>}
          <button className={styles.editLink} onClick={() => openDrawer('salary')}>+ Assign Salary Structure</button>
        </div>
      ),
    },
    {
      title: `Overtime Rates (${otRates.length})`,
      content: otRates.length > 0 ? (
        <div className={styles.tableList}>
          <div className={styles.tableHeader}><span>Hourly Rate</span><span>From</span><span>To</span><span>Active</span><span></span><span></span></div>
          {otRates.map((r) => (
            <div key={r.id} className={styles.tableRow}>
              <span>₹{Number(r.hourlyRate).toFixed(2)}</span>
              <span>{r.effectiveFrom?.split('T')[0]}</span>
              <span>{r.effectiveTo?.split('T')[0] || 'Ongoing'}</span>
              <span className={r.isActive ? styles.badgeGreen : styles.badgeGray}>{r.isActive ? 'Yes' : 'No'}</span>
              <span></span>
              <span></span>
            </div>
          ))}
        </div>
      ) : <p className={styles.emptyText}>No overtime rates set</p>,
    },
  ];

  return (
    <div>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/employees')}>&larr; Back</button>
        <div className={styles.headerInfo}>
          <h1 className={styles.name}>{emp.firstName} {emp.lastName || ''}</h1>
          <p className={styles.meta}>{emp.employeeCode} &middot; {emp.departmentName} &middot; {emp.designationName}</p>
        </div>
      </div>

      <Accordion sections={sections} />

      <Drawer isOpen={drawer === 'contact'} onClose={() => setDrawer(null)} title={contact ? 'Edit Emergency Contact' : 'Add Emergency Contact'} width={440}>
        <form onSubmit={handleContactSubmit} className={modStyles.form}>
          {error && <div className={modStyles.error}>{error}</div>}
          <FormField label="Name" value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <FormField label="Relationship" value={form.relationship || ''} onChange={(e) => setForm({ ...form, relationship: e.target.value })} required />
          <FormField label="Phone" value={form.phone || ''} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
          <div className={modStyles.formActions}>
            <button type="button" className={modStyles.cancelBtn} onClick={() => setDrawer(null)}>Cancel</button>
            <button type="submit" className={modStyles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Drawer>

      <Drawer isOpen={drawer === 'document'} onClose={() => setDrawer(null)} title={editing ? 'Edit Document' : 'Add Document'} width={460}>
        <form onSubmit={handleDocumentSubmit} className={modStyles.form}>
          {error && <div className={modStyles.error}>{error}</div>}
          <FormField label="Document Type" type="select" value={form.documentType || ''} onChange={(e) => setForm({ ...form, documentType: e.target.value })}
            required options={[{ value: 'aadhaar', label: 'Aadhaar' }, { value: 'pan', label: 'PAN' }, { value: 'resume', label: 'Resume' }, { value: 'offer_letter', label: 'Offer Letter' }, { value: 'other', label: 'Other' }]} />
          <FormField label="Document Name" value={form.documentName || ''} onChange={(e) => setForm({ ...form, documentName: e.target.value })} required />
          <FormField label="File Path" value={form.filePath || ''} onChange={(e) => setForm({ ...form, filePath: e.target.value })} required placeholder="/uploads/document.pdf" />
          <div className={modStyles.formGrid}>
            <FormField label="Issued Date" type="date" value={form.issuedDate || ''} onChange={(e) => setForm({ ...form, issuedDate: e.target.value })} />
            <FormField label="Expiry Date" type="date" value={form.expiryDate || ''} onChange={(e) => setForm({ ...form, expiryDate: e.target.value })} />
          </div>
          <div className={modStyles.formActions}>
            <button type="button" className={modStyles.cancelBtn} onClick={() => setDrawer(null)}>Cancel</button>
            <button type="submit" className={modStyles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Drawer>

      <Drawer isOpen={drawer === 'shift'} onClose={() => setDrawer(null)} title={editing ? 'Edit Shift Assignment' : 'Assign Shift'} width={460}>
        <form onSubmit={handleShiftSubmit} className={modStyles.form}>
          {error && <div className={modStyles.error}>{error}</div>}
          <FormField label="Shift" type="select" value={form.shiftId || ''} onChange={(e) => setForm({ ...form, shiftId: e.target.value })}
            required options={shiftOptions.filter((s) => s.isActive).map((s) => ({ value: String(s.id), label: `${s.name} (${String(s.startTime).slice(0, 5)} - ${String(s.endTime).slice(0, 5)})` }))} />
          <div className={modStyles.formGrid}>
            <FormField label="Effective From" type="date" value={form.effectiveFrom || ''} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
            <FormField label="Effective To" type="date" value={form.effectiveTo || ''} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
          </div>
          <FormField label="Active" type="select" value={form.isActive ? '1' : '0'} onChange={(e) => setForm({ ...form, isActive: e.target.value === '1' })}
            options={[{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]} />
          <div className={modStyles.formActions}>
            <button type="button" className={modStyles.cancelBtn} onClick={() => setDrawer(null)}>Cancel</button>
            <button type="submit" className={modStyles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Drawer>

      <Drawer isOpen={drawer === 'salary'} onClose={() => setDrawer(null)} title={editing ? 'Edit Salary Structure' : 'Assign Salary Structure'} width={460}>
        <form onSubmit={handleSalarySubmit} className={modStyles.form}>
          {error && <div className={modStyles.error}>{error}</div>}
          <FormField label="Salary Structure" type="select" value={form.salaryStructureId || ''} onChange={(e) => setForm({ ...form, salaryStructureId: e.target.value })}
            required options={structureOptions.filter((s) => s.isActive).map((s) => ({ value: String(s.id), label: s.name }))} />
          <div className={modStyles.formGrid}>
            <FormField label="Effective From" type="date" value={form.effectiveFrom || ''} onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })} required />
            <FormField label="Effective To" type="date" value={form.effectiveTo || ''} onChange={(e) => setForm({ ...form, effectiveTo: e.target.value })} />
          </div>
          <FormField label="Status" type="select" value={form.status || 'active'} onChange={(e) => setForm({ ...form, status: e.target.value })}
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          <FormField label="Revision Reason" type="textarea" value={form.revisionReason || ''} onChange={(e) => setForm({ ...form, revisionReason: e.target.value })} />
          <div className={modStyles.formActions}>
            <button type="button" className={modStyles.cancelBtn} onClick={() => setDrawer(null)}>Cancel</button>
            <button type="submit" className={modStyles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className={styles.infoRow}>
      <span className={styles.infoLabel}>{label}</span>
      <span className={styles.infoValue}>{value || '-'}</span>
    </div>
  );
}