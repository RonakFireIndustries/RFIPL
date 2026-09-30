import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getMyAttendance, punchAttendance } from '@/api/attendance';
import styles from './MyAttendance.module.css';

const STATUS_META = {
  present: { label: 'On Time', color: '#16a34a' },
  late: { label: 'Late', color: '#f59e0b' },
  half_day: { label: 'Half Day', color: '#fb923c' },
  leave: { label: 'Leave', color: '#3b82f6' },
  holiday: { label: 'Holiday', color: '#8b5cf6' },
  week_off: { label: 'Week Off', color: '#64748b' },
  absent: { label: 'Absent', color: '#DC2626' },
  incomplete: { label: 'Incomplete', color: '#6b7280' },
};

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function fmtDate(d) {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${String(d.getFullYear()).slice(2)}`;
}

function fmtDateTime(d) {
  return `${fmtDate(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDuration(min) {
  if (min === null || min === undefined) return null;
  if (min <= 0) return '0m';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

function fmtMeters(m) {
  if (m === null || m === undefined) return '--';
  return Number(m).toFixed(1);
}

function fmtCoord(v) {
  return v === null || v === undefined ? '--' : Number(v).toFixed(6);
}

function SlideToConfirm({ label, accent, onComplete, disabled }) {
  const trackRef = useRef(null);
  const [fillPct, setFillPct] = useState(0);
  const [offsetPx, setOffsetPx] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const draggingRef = useRef(false);
  const completedRef = useRef(false);
  const KNOB = 44;
  const EDGE = 5;

  const updatePosition = useCallback((clientX) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const max = rect.width - KNOB - EDGE * 2;
    const x = Math.max(0, Math.min(max, clientX - rect.left - KNOB / 2));
    setOffsetPx(x);
    setFillPct(Math.round((x / max) * 100));
    if (x >= max - 2) {
      draggingRef.current = false;
      setIsDragging(false);
      setOffsetPx(0);
      setFillPct(0);
      if (!completedRef.current) {
        completedRef.current = true;
        onComplete();
        setTimeout(() => { completedRef.current = false; }, 400);
      }
    }
  }, [onComplete]);

  const onPointerDown = (e) => {
    if (disabled) return;
    draggingRef.current = true;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!draggingRef.current) return;
    updatePosition(e.clientX);
  };

  const onPointerEnd = () => {
    draggingRef.current = false;
    setIsDragging(false);
    setOffsetPx(0);
    setFillPct(0);
  };

  return (
    <div
      ref={trackRef}
      className={`${styles.slideTrack} ${disabled ? styles.slideDisabled : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      style={{ '--accent': accent }}
    >
      <div className={`${styles.slideFill} ${isDragging ? styles.slideNoTransition : ''}`} style={{ width: `${fillPct}%` }} />
      <span className={styles.slideText}>{label}</span>
      <div
        className={`${styles.slideKnob} ${isDragging ? styles.slideNoTransition : ''}`}
        style={{ transform: `translateX(${offsetPx}px)` }}
      >
        <span className={styles.slideArrow}>»</span>
      </div>
    </div>
  );
}

export default function MyAttendance() {
  const { accessToken } = useAuth();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [pos, setPos] = useState({ locating: false, latitude: null, longitude: null, accuracy: null, distance: null, within: null, error: '' });
  const [now, setNow] = useState(new Date());
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyAttendance(accessToken);
      setState(data);
      setNotice(null);
    } catch (err) {
      setNotice({ type: 'error', text: err.message });
    }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);

  const getPosition = () => new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation is not supported by this browser')); return; }
    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      const msg = err.code === err.PERMISSION_DENIED ? 'Location access denied. Allow location permission and retry.' : 'Could not get your location. Move outdoors and retry.';
      reject(new Error(msg));
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });

  const applyPosition = useCallback((position) => {
    const { latitude, longitude, accuracy } = position.coords;
    const distance = state?.location
      ? Math.round(haversineMeters(Number(state.location.latitude), Number(state.location.longitude), latitude, longitude) * 10) / 10
      : null;
    const within = state?.location ? distance <= Number(state.location.radiusMeters) : null;
    setPos({ locating: false, latitude, longitude, accuracy, distance, within, error: '' });
  }, [state?.location]);

  const refreshPosition = useCallback(async () => {
    if (!state?.location) return;
    setPos((p) => ({ ...p, locating: true, error: '' }));
    try {
      const position = await getPosition();
      applyPosition(position);
    } catch (err) {
      setPos((p) => ({ ...p, locating: false, error: err.message }));
    }
  }, [state?.location, applyPosition]);

  useEffect(() => {
    if (state?.location) refreshPosition();
  }, [state?.location, refreshPosition]);

  const handlePunch = async (type) => {
    if (!state?.location) { setNotice({ type: 'error', text: 'No active geofenced location configured. Contact admin.' }); return; }
    setPunching(true);
    setNotice(null);
    setPos((p) => ({ ...p, locating: true, error: '' }));
    try {
      const position = await getPosition();
      await punchAttendance(type, position, accessToken);
      applyPosition(position);
      setNotice({ type: 'success', text: type === 'in' ? 'Check-in successful.' : 'Check-out successful.' });
      load();
    } catch (err) {
      const msg = err.message || 'Failed to punch attendance';
      setNotice({ type: 'error', text: msg });
      const m = msg.match(/(\d+)m/);
      if (m) setPos((p) => ({ ...p, locating: false, distance: Number(m[1]), within: false, error: msg }));
      else setPos((p) => ({ ...p, locating: false, error: msg }));
    } finally {
      setPunching(false);
    }
  };

  const location = state?.location || null;
  const employee = state?.employee || null;
  const canPunch = !!employee?.designationId && !!location;
  const isAdminUser = !employee?.designationId;
  const isCheckedIn = !!state?.openRecord;
  const hasCompletedToday = !!state?.todayRecord?.checkOutAt;
  const todayStatus = state?.todayRecord ? (STATUS_META[state.todayRecord.status] || { label: state.todayRecord.status, color: '#6b7280' }) : null;
  const pctOfLimit = location && pos.distance !== null
    ? Math.round((pos.distance / Number(location.radiusMeters)) * 100)
    : null;
  const distanceLabel = pos.distance !== null ? fmtMeters(pos.distance) : '--';
  const accuracyLabel = pos.accuracy !== null ? `${fmtMeters(pos.accuracy)}m` : '--';
  const radiusLabel = location ? `${Number(location.radiusMeters).toFixed(0)}m` : '--';

  const siteStatus = {
    label: pos.within === null ? 'Locating…' : (pos.within ? 'Inside Radius' : 'Outside Radius'),
    color: pos.within === null ? '#9ca3af' : (pos.within ? '#16a34a' : '#DC2626'),
  };

  return (
    <div className={styles.page}>
      <div className={styles.pageHeader}>
        <h1 className={styles.title}>My Attendance</h1>
        <p className={styles.sub}>{fmtDateTime(now)}</p>
      </div>

      {notice && (
        <div className={`${styles.notice} ${notice.type === 'error' ? styles.noticeError : styles.noticeSuccess}`}>
          {notice.text}
        </div>
      )}

      {loading ? (
        <div className={styles.loading}>Loading...</div>
      ) : !state ? (
        <div className={styles.emptyState}>
          <p>Your account is not linked to an employee profile.</p>
          <p>Contact your admin to link a login account to an employee before using attendance.</p>
        </div>
      ) : (
        <div className={styles.stack}>
          <section className={styles.card}>
            <div className={styles.cardTitleRow}>
              <h3 className={styles.cardTitle}>Assigned Site</h3>
              <span className={styles.siteStatusBadge} style={{ color: siteStatus.color, background: `${siteStatus.color}14` }}>
                {siteStatus.label}
              </span>
            </div>
            {!location ? (
              <p className={styles.geoWarn}>No active geofenced location configured. Contact your admin.</p>
            ) : (
              <>
                <h4 className={styles.siteName}>{location.name}</h4>
                <p className={styles.siteAddress}>{location.address || '—'}</p>
                <div className={styles.metricsGrid}>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Distance</span>
                    <span className={styles.metricValue}>{location ? `${distanceLabel}m` : '--'}</span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Radius Limit</span>
                    <span className={styles.metricValue}>{radiusLabel}</span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Distance</span>
                    <span className={styles.metricValue}>{pctOfLimit === null ? '--' : `${pctOfLimit.toLocaleString()}% of limit`}</span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>GPS Accuracy</span>
                    <span className={styles.metricValue}>{accuracyLabel}</span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Latitude</span>
                    <span className={styles.metricValue}>{fmtCoord(pos.latitude)}</span>
                  </div>
                  <div className={styles.metric}>
                    <span className={styles.metricLabel}>Longitude</span>
                    <span className={styles.metricValue}>{fmtCoord(pos.longitude)}</span>
                  </div>
                </div>
                {pos.locating && <p className={styles.geoInfo}>Updating location…</p>}
                {pos.error && <p className={styles.geoWarn}>{pos.error}</p>}
              </>
            )}
          </section>

          <section className={styles.card}>
            <div className={styles.cardTitleRow}>
              <h3 className={styles.cardTitle}>Today&apos;s Attendance Status</h3>
              {todayStatus && (
                <span className={styles.statusBadge} style={{ color: todayStatus.color, background: `${todayStatus.color}14` }}>
                  {todayStatus.label}
                </span>
              )}
            </div>
            <div className={styles.statusTable}>
              <div className={styles.statusRow}>
                <span className={styles.statusKey}>Date</span>
                <span className={styles.statusValue}>{state.todayRecord?.attendanceDate ? fmtDate(new Date(`${state.todayRecord.attendanceDate}T00:00:00`)) : fmtDate(now)}</span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusKey}>Site</span>
                <span className={styles.statusValue}>{location?.name || 'Headquaters'}</span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusKey}>Check In</span>
                <span className={styles.statusValue}>{fmtTime(state.todayRecord?.checkInAt) || '--'}</span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusKey}>Check Out</span>
                <span className={styles.statusValue}>{fmtTime(state.todayRecord?.checkOutAt) || '--'}</span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusKey}>Working Hours</span>
                <span className={styles.statusValue}>{fmtDuration(state.todayRecord?.workingMinutes) || '--'}</span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusKey}>Overtime</span>
                <span className={styles.statusValue}>{fmtDuration(state.todayRecord?.overtimeMinutes) || '--'}</span>
              </div>
              <div className={styles.statusRow}>
                <span className={styles.statusKey}>Status</span>
                <span className={styles.statusValue}>{todayStatus ? todayStatus.label : '--'}</span>
              </div>
            </div>
            {state.shiftDef && (
              <p className={styles.shiftInfo}>
                Shift: {state.shiftDef.name} ({state.shiftDef.startTime.slice(0, 5)} - {state.shiftDef.endTime.slice(0, 5)})
                {Number(state.shiftDef.gracePeriodMinutes) > 0 && ` · grace ${state.shiftDef.gracePeriodMinutes}m`}
              </p>
            )}
          </section>

          {isAdminUser && (
            <section className={styles.adminBanner}>
              <p className={styles.adminTitle}>Attendance check-in/out is not available for Admin users.</p>
              <p className={styles.adminText}>Only employees with assigned designations can record attendance.</p>
            </section>
          )}

          {canPunch && !isCheckedIn && !hasCompletedToday && (
            <section className={`${styles.card} ${styles.slideCard}`}>
              <div className={styles.cardTitleRow}>
                <h3 className={styles.cardTitle}>Check In</h3>
                <span className={styles.stateLabel}>Not checked in yet</span>
              </div>
              {pos.within !== null && !pos.within && (
                <p className={styles.geoWarn}>You are outside the attendance area. Check-in may be rejected.</p>
              )}
              <SlideToConfirm
                label={punching ? 'Locating…' : 'Slide to Check In'}
                accent="#16a34a"
                disabled={punching || pos.locating}
                onComplete={() => handlePunch('in')}
              />
            </section>
          )}

          {canPunch && isCheckedIn && (
            <section className={`${styles.card} ${styles.slideCard}`}>
              <div className={styles.cardTitleRow}>
                <h3 className={styles.cardTitle}>Check Out</h3>
                <span className={styles.stateLabelChecking}>Checked in at {fmtTime(state.openRecord.checkInAt)}</span>
              </div>
              <SlideToConfirm
                label={punching ? 'Locating…' : 'Slide to Check Out'}
                accent="#DC2626"
                disabled={punching || pos.locating}
                onComplete={() => handlePunch('out')}
              />
            </section>
          )}

          {canPunch && !isCheckedIn && hasCompletedToday && (
            <section className={`${styles.card} ${styles.doneCard}`}>
              <div className={styles.cardTitleRow}>
                <h3 className={styles.cardTitle}>Today Complete</h3>
                <span className={styles.stateLabelDone}>Done for today</span>
              </div>
              <p className={styles.doneText}>
                Checked in {fmtTime(state.todayRecord.checkInAt)} - {fmtTime(state.todayRecord.checkOutAt)} ({fmtDuration(state.todayRecord.workingMinutes)})
              </p>
            </section>
          )}

          <section className={styles.card}>
            <div className={styles.cardTitleRow}>
              <h3 className={styles.cardTitle}>Current Position</h3>
              <button className={styles.refreshBtn} onClick={refreshPosition} disabled={pos.locating || !location}>
                {pos.locating ? 'Locating…' : 'Refresh'}
              </button>
            </div>
            <div className={styles.metricsGrid}>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Latitude</span>
                <span className={styles.metricValue}>{fmtCoord(pos.latitude)}</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Longitude</span>
                <span className={styles.metricValue}>{fmtCoord(pos.longitude)}</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Accuracy</span>
                <span className={styles.metricValue}>{accuracyLabel}</span>
              </div>
              <div className={styles.metric}>
                <span className={styles.metricLabel}>Site Distance</span>
                <span className={styles.metricValue}>{distanceLabel}m</span>
              </div>
            </div>
            {pos.error && <p className={styles.geoWarn}>{pos.error}</p>}
          </section>
        </div>
      )}
    </div>
  );
}