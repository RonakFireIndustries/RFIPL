import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import {
  getLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType,
  getMyLeaveRequests, getLeaveBalance, getApprovalQueue, getLeaveRequests,
  createLeaveRequest, reviewLeaveRequest, cancelLeaveRequest,
} from '@/api/leave';
import FormField from '@/components/ui/FormField';
import styles from './Leave.module.css';

const STATUS_META = {
  pending: { label: 'Pending', color: '#f59e0b' },
  approved: { label: 'Approved', color: '#16a34a' },
  rejected: { label: 'Rejected', color: '#DC2626' },
  cancelled: { label: 'Cancelled', color: '#6b7280' },
};

const ADMIN_ROLES = ['Super Admin', 'Admin', 'HR'];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function fmtDate(iso) {
  if (!iso) return '--';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

function fmtDuration(days) {
  if (days === null || days === undefined) return '--';
  const n = Number(days);
  return Number.isInteger(n) ? `${n} day${n === 1 ? '' : 's'}` : `${n} days`;
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status || '--', color: '#6b7280' };
  return (
    <span className={styles.statusBadge} style={{ color: meta.color, background: `${meta.color}14` }}>
      {meta.label}
    </span>
  );
}

function Level({ value = 0, max = 1, color = '#16a34a' }) {
  const pct = Math.max(0, Math.min(100, max > 0 ? (value / max) * 100 : 0));
  return (
    <div className={styles.levelTrack}>
      <div className={styles.levelFill} style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

export default function Leave() {
  const { user, accessToken } = useAuth();
  const isAdmin = user?.roles?.some((r) => ADMIN_ROLES.includes(r.name));
  const [tab, setTab] = useState('my');

  const [balance, setBalance] = useState(null);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [myRequests, setMyRequests] = useState([]);
  const [approvals, setApprovals] = useState({ requests: [], isAdmin: false });
  const [allRequests, setAllRequests] = useState([]);
  const [filterStatus, setFilterStatus] = useState('');

  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState(null);

  const [applyOpen, setApplyOpen] = useState(false);
  const [applyForm, setApplyForm] = useState(emptyApply());
  const [submitting, setSubmitting] = useState(false);
  const [applyError, setApplyError] = useState('');

  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewRemarks, setReviewRemarks] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const [typeModalOpen, setTypeModalOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState(emptyType());
  const [typeError, setTypeError] = useState('');

  function emptyApply() {
    return { leaveTypeId: '', fromDate: '', toDate: '', durationType: 'full_day', halfDayPeriod: '', reason: '' };
  }

  function emptyType() {
    return { name: '', code: '', annualLimit: '', isPaid: true, isActive: true };
  }

  const loadCore = useCallback(async () => {
    setLoading(true);
    setNotice(null);
    try {
      const [types, bal, mine] = await Promise.all([
        getLeaveTypes(accessToken),
        getLeaveBalance(accessToken),
        getMyLeaveRequests(accessToken),
      ]);
      setLeaveTypes(types);
      setBalance(bal);
      setMyRequests(mine);
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { loadCore(); }, [loadCore]);

  const loadApprovals = useCallback(async () => {
    try { setApprovals(await getApprovalQueue(accessToken)); } catch (err) { setNotice({ type: 'error', text: err.message }); }
  }, [accessToken]);

  useEffect(() => { if (tab === 'approvals') loadApprovals(); }, [tab, loadApprovals]);

  const loadAll = useCallback(async () => {
    try { setAllRequests(await getLeaveRequests(accessToken, { status: filterStatus || undefined })); } catch (err) { setNotice({ type: 'error', text: err.message }); }
  }, [accessToken, filterStatus]);

  useEffect(() => { if (tab === 'requests') loadAll(); }, [tab, loadAll]);

  const selectedBalance = balance?.balances?.find((b) => b.leaveTypeId === Number(applyForm.leaveTypeId));

  const openApply = () => {
    setApplyForm(emptyApply());
    setApplyError('');
    setApplyOpen(true);
  };

  const submitApply = async (e) => {
    e.preventDefault();
    setApplyError('');
    if (!applyForm.leaveTypeId || !applyForm.fromDate || !applyForm.toDate) {
      setApplyError('Leave type and dates are required');
      return;
    }
    if (applyForm.toDate < applyForm.fromDate) {
      setApplyError('To date must be on or after from date');
      return;
    }
    setSubmitting(true);
    try {
      await createLeaveRequest(applyForm, accessToken);
      setApplyOpen(false);
      loadCore();
      if (tab === 'approvals') loadApprovals();
      setNotice({ type: 'success', text: 'Leave request submitted.' });
    } catch (err) {
      setApplyError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (row) => {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await cancelLeaveRequest(row.id, accessToken);
      loadCore();
      loadApprovals();
      loadAll();
      setNotice({ type: 'success', text: 'Leave request cancelled.' });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
  };

  const openReview = (row) => {
    setReviewTarget(row);
    setReviewRemarks('');
  };

  const submitReview = async (status) => {
    if (!reviewTarget) return;
    setReviewing(true);
    try {
      await reviewLeaveRequest(reviewTarget.id, { status, reviewRemarks: reviewRemarks || undefined }, accessToken);
      setReviewTarget(null);
      loadApprovals();
      loadAll();
      loadCore();
      setNotice({ type: 'success', text: `Request ${status}.` });
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    } finally {
      setReviewing(false);
    }
  };

  const openTypeCreate = () => {
    setEditingType(null);
    setTypeForm(emptyType());
    setTypeError('');
    setTypeModalOpen(true);
  };

  const openTypeEdit = (row) => {
    setEditingType(row);
    setTypeForm({
      name: row.name,
      code: row.code,
      annualLimit: row.annualLimit ?? '',
      isPaid: !!row.isPaid,
      isActive: !!row.isActive,
    });
    setTypeError('');
    setTypeModalOpen(true);
  };

  const submitType = async (e) => {
    e.preventDefault();
    setTypeError('');
    if (!typeForm.name || !typeForm.code) { setTypeError('Name and code are required'); return; }
    setSubmitting(true);
    try {
      const payload = {
        ...typeForm,
        annualLimit: typeForm.annualLimit === '' ? null : Number(typeForm.annualLimit),
      };
      if (editingType) await updateLeaveType(editingType.id, payload, accessToken);
      else await createLeaveType(payload, accessToken);
      setTypeModalOpen(false);
      loadCore();
      setNotice({ type: 'success', text: editingType ? 'Leave type updated.' : 'Leave type created.' });
    } catch (err) {
      setTypeError(err.message || 'Failed to save leave type');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteType = async (row) => {
    if (!confirm(`Delete leave type "${row.name}"?`)) return;
    try { await deleteLeaveType(row.id, accessToken); loadCore(); } catch (err) { setNotice({ type: 'error', text: err.message }); }
  };

  const TABS = [
    { key: 'my', label: 'My Leave' },
    { key: 'approvals', label: 'Approvals' },
    ...(isAdmin ? [
      { key: 'requests', label: 'All Requests' },
      { key: 'types', label: 'Leave Types' },
    ] : []),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>Leave Management</h1>
        <p className={styles.sub}>
          {balance ? `${balance.year} · ${user?.email}` : ''}
        </p>
      </div>

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className={`${styles.notice} ${notice.type === 'error' ? styles.noticeError : styles.noticeSuccess}`}>
          {notice.text}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : (
        <div className={styles.stack}>
          {tab === 'my' && (
            <>
              <section className={styles.card}>
                <div className={styles.cardTitleRow}>
                  <h3 className={styles.cardTitle}>Leave Balance</h3>
                  <button className={styles.primaryBtn} onClick={openApply}>+ Apply Leave</button>
                </div>
                {!balance?.balances?.length ? (
                  <p className={styles.empty}>No leave types configured. Contact your admin.</p>
                ) : (
                  <div className={styles.balanceGrid}>
                    {balance.balances.map((b) => (
                      <div key={b.leaveTypeId} className={styles.balanceCard}>
                        <div className={styles.balanceHeader}>
                          <span className={styles.balanceName}>{b.name}</span>
                          <span className={`${styles.balanceTag} ${b.isPaid ? styles.paidTag : styles.unpaidTag}`}>
                            {b.isPaid ? 'Paid' : 'Unpaid'}
                          </span>
                        </div>
                        <div className={styles.balanceRow}>
                          <span>{b.remainingDays === null ? 'Unlimited' : `${b.remainingDays} days`}</span>
                          <span className={styles.balanceUsed}>Used {b.usedDays}</span>
                        </div>
                        <Level value={b.usedDays} max={b.allocatedDays || b.usedDays} color={b.remainingDays !== null && b.remainingDays < b.allocatedDays * 0.25 ? '#DC2626' : '#16a34a'} />
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className={styles.card}>
                <div className={styles.cardTitleRow}>
                  <h3 className={styles.cardTitle}>My Requests</h3>
                </div>
                {!myRequests?.length ? (
                  <p className={styles.empty}>No leave requests yet.</p>
                ) : (
                  <div className={styles.requestList}>
                    {myRequests.map((r) => (
                      <div key={r.id} className={styles.requestRow}>
                        <div className={styles.requestMain}>
                          <div className={styles.requestTop}>
                            <span className={styles.requestType}>{r.leaveTypeName}</span>
                            <StatusBadge status={r.status} />
                          </div>
                          <div className={styles.requestMeta}>
                            {fmtDate(r.fromDate)} - {fmtDate(r.toDate)} · {fmtDuration(r.totalDays)} · {r.durationType === 'half_day' ? `Half day (${r.halfDayPeriod?.replace('_', ' ')})` : 'Full day'}
                          </div>
                          {r.reason && <p className={styles.requestReason}>{r.reason}</p>}
                          {r.status === 'pending' && (
                            <button className={styles.linkBtn} onClick={() => handleCancel(r)}>Cancel request</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}

          {tab === 'approvals' && (
            <section className={styles.card}>
              <div className={styles.cardTitleRow}>
                <h3 className={styles.cardTitle}>
                  {approvals.isAdmin ? 'Approval Queue' : 'Pending Requests'}
                </h3>
                <button className={styles.ghostBtn} onClick={loadApprovals}>Refresh</button>
              </div>
              {!approvals?.requests?.length ? (
                <p className={styles.empty}>No pending requests.</p>
              ) : (
                <div className={styles.requestList}>
                  {approvals.requests.map((r) => (
                    <div key={r.id} className={styles.requestRow}>
                      <div className={styles.requestMain}>
                        <div className={styles.requestTop}>
                          <span className={styles.requestType}>
                            {`${r.firstName} ${r.lastName || ''}`.trim()} · {r.employeeCode || ''}
                          </span>
                        </div>
                        <div className={styles.requestMeta}>
                          {r.leaveTypeName} · {fmtDate(r.fromDate)} - {fmtDate(r.toDate)} · {fmtDuration(r.totalDays)}
                        </div>
                        {r.reason && <p className={styles.requestReason}>{r.reason}</p>}
                      </div>
                      <div className={styles.reviewActions}>
                        <button className={styles.approveBtn} onClick={() => openReview(r)}>Review</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'requests' && isAdmin && (
            <section className={styles.card}>
              <div className={styles.cardTitleRow}>
                <h3 className={styles.cardTitle}>All Requests</h3>
                <select className={styles.statusFilter} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              {!allRequests?.length ? (
                <p className={styles.empty}>No requests found.</p>
              ) : (
                <div className={styles.requestList}>
                  {allRequests.map((r) => (
                    <div key={r.id} className={styles.requestRow}>
                      <div className={styles.requestMain}>
                        <div className={styles.requestTop}>
                          <span className={styles.requestType}>
                            {`${r.firstName} ${r.lastName || ''}`.trim()} · {r.employeeCode || ''}
                          </span>
                          <StatusBadge status={r.status} />
                        </div>
                        <div className={styles.requestMeta}>
                          {r.leaveTypeName} · {fmtDate(r.fromDate)} - {fmtDate(r.toDate)} · {fmtDuration(r.totalDays)}
                        </div>
                        {r.reason && <p className={styles.requestReason}>{r.reason}</p>}
                        {r.reviewRemarks && (
                          <p className={styles.reviewRemark}>Review: {r.reviewRemarks}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === 'types' && isAdmin && (
            <section className={styles.card}>
              <div className={styles.cardTitleRow}>
                <h3 className={styles.cardTitle}>Leave Types</h3>
                <button className={styles.primaryBtn} onClick={openTypeCreate}>+ New Type</button>
              </div>
              {!leaveTypes?.length ? (
                <p className={styles.empty}>No leave types configured.</p>
              ) : (
                <div className={styles.typeGrid}>
                  {leaveTypes.map((t) => (
                    <div key={t.id} className={styles.typeCard}>
                      <div className={styles.typeHeader}>
                        <span className={styles.typeName}>{t.name}</span>
                        <span className={styles.typeCode}>{t.code}</span>
                      </div>
                      <div className={styles.typeMeta}>
                        <span>Limit: {t.annualLimit === null ? 'Unlimited' : `${t.annualLimit} days`}</span>
                        <span>{t.isPaid ? 'Paid' : 'Unpaid'}</span>
                        {!t.isActive && <span className={styles.inactiveTag}>Inactive</span>}
                      </div>
                      <div className={styles.actions}>
                        <button className={styles.editBtn} onClick={() => openTypeEdit(t)}>Edit</button>
                        <button className={styles.deleteBtn} onClick={() => handleDeleteType(t)}>Del</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {applyOpen && (
        <div className={styles.overlay} onClick={() => setApplyOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Apply for Leave</h3>
              <button className={styles.closeBtn} onClick={() => setApplyOpen(false)}>&times;</button>
            </div>
            <form onSubmit={submitApply} className={styles.form}>
              {applyError && <div className={styles.error}>{applyError}</div>}
              {selectedBalance && (
                <p className={styles.balanceHint}>
                  Balance for {selectedBalance.name}: {selectedBalance.remainingDays === null ? 'Unlimited' : `${selectedBalance.remainingDays} days remaining`}
                </p>
              )}
              <FormField label="Leave Type" type="select" value={applyForm.leaveTypeId} onChange={(e) => setApplyForm({ ...applyForm, leaveTypeId: e.target.value })} options={leaveTypes.map((t) => ({ value: String(t.id), label: `${t.name}` }))} required />
              <div className={styles.formGrid}>
                <FormField label="From Date" type="date" value={applyForm.fromDate} onChange={(e) => setApplyForm({ ...applyForm, fromDate: e.target.value })} required />
                <FormField label="To Date" type="date" value={applyForm.toDate} onChange={(e) => setApplyForm({ ...applyForm, toDate: e.target.value })} required />
              </div>
              <div className={styles.radioRow}>
                <label className={styles.radioLabel}>
                  <input type="radio" name="durationType" value="full_day" checked={applyForm.durationType === 'full_day'} onChange={(e) => setApplyForm({ ...applyForm, durationType: e.target.value })} />
                  Full Day
                </label>
                <label className={styles.radioLabel}>
                  <input type="radio" name="durationType" value="half_day" checked={applyForm.durationType === 'half_day'} onChange={(e) => setApplyForm({ ...applyForm, durationType: e.target.value })} />
                  Half Day
                </label>
              </div>
              {applyForm.durationType === 'half_day' && (
                <div className={styles.radioRow}>
                  <label className={styles.radioLabel}>
                    <input type="radio" name="halfDayPeriod" value="first_half" checked={applyForm.halfDayPeriod === 'first_half'} onChange={(e) => setApplyForm({ ...applyForm, halfDayPeriod: e.target.value })} />
                    First Half
                  </label>
                  <label className={styles.radioLabel}>
                    <input type="radio" name="halfDayPeriod" value="second_half" checked={applyForm.halfDayPeriod === 'second_half'} onChange={(e) => setApplyForm({ ...applyForm, halfDayPeriod: e.target.value })} />
                    Second Half
                  </label>
                </div>
              )}
              <FormField label="Reason" type="textarea" value={applyForm.reason} onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })} placeholder="Reason for leave" required />
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setApplyOpen(false)}>Cancel</button>
                <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Submitting...' : 'Submit'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {reviewTarget && (
        <div className={styles.overlay} onClick={() => setReviewTarget(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>Review Leave Request</h3>
              <button className={styles.closeBtn} onClick={() => setReviewTarget(null)}>&times;</button>
            </div>
            <div className={styles.reviewBody}>
              <div className={styles.reviewInfo}>
                <p className={styles.reviewType}>
                  {`${reviewTarget.firstName} ${reviewTarget.lastName || ''}`.trim()} requested {reviewTarget.leaveTypeName}
                </p>
                <p className={styles.reviewDates}>{fmtDate(reviewTarget.fromDate)} - {fmtDate(reviewTarget.toDate)} · {fmtDuration(reviewTarget.totalDays)}</p>
                {reviewTarget.reason && <p className={styles.requestReason}>{reviewTarget.reason}</p>}
              </div>
              <textarea
                className={styles.remarks}
                placeholder="Review remarks (optional)"
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                rows={3}
              />
              <div className={styles.formActions}>
                <button className={styles.rejectBtn} onClick={() => submitReview('rejected')} disabled={reviewing}>Reject</button>
                <button className={styles.approveBtn} onClick={() => submitReview('approved')} disabled={reviewing}>{reviewing ? 'Submitting...' : 'Approve'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {typeModalOpen && (
        <div className={styles.overlay} onClick={() => setTypeModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>{editingType ? 'Edit Leave Type' : 'New Leave Type'}</h3>
              <button className={styles.closeBtn} onClick={() => setTypeModalOpen(false)}>&times;</button>
            </div>
            <form onSubmit={submitType} className={styles.form}>
              {typeError && <div className={styles.error}>{typeError}</div>}
              <div className={styles.formGrid}>
                <FormField label="Name" value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="e.g. Paid Leave" required />
                <FormField label="Code" value={typeForm.code} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })} placeholder="e.g. PAID" required />
              </div>
              <div className={styles.formGrid}>
                <FormField label="Annual Limit (days)" type="number" min="0" value={typeForm.annualLimit} onChange={(e) => setTypeForm({ ...typeForm, annualLimit: e.target.value })} placeholder="Leave blank for unlimited" />
                <div className={styles.checkBoxes}>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={typeForm.isPaid} onChange={(e) => setTypeForm({ ...typeForm, isPaid: e.target.checked })} />
                    Paid leave
                  </label>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={typeForm.isActive} onChange={(e) => setTypeForm({ ...typeForm, isActive: e.target.checked })} />
                    Active
                  </label>
                </div>
              </div>
              <div className={styles.formActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setTypeModalOpen(false)}>Cancel</button>
                <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : editingType ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}