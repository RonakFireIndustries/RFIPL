import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getWorkLocations, createWorkLocation, updateWorkLocation, deleteWorkLocation } from '@/api/workLocations';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FormField from '@/components/ui/FormField';
import LocationMap from '@/components/ui/LocationMap';
import styles from './WorkLocations.module.css';

function formatLatLng(v) {
  if (v === null || v === undefined || v === '') return '-';
  return `${Number(v).toFixed(6)}°`;
}

function getDefault(row) {
  if (row) {
    return {
      name: row.name,
      address: row.address || '',
      latitude: String(row.latitude),
      longitude: String(row.longitude),
      radiusMeters: String(row.radiusMeters),
      accuracyThresholdMeters: String(row.accuracyThresholdMeters),
      geofenceEnabled: !!row.geofenceEnabled,
      isActive: !!row.isActive,
    };
  }
  return {
    name: '', address: '', latitude: '', longitude: '',
    radiusMeters: '100', accuracyThresholdMeters: '50',
    geofenceEnabled: true, isActive: true,
  };
}

export default function WorkLocations() {
  const { accessToken } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => getDefault(null));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await getWorkLocations(accessToken)); } catch (err) { setError(err.message); }
    setLoading(false);
  }, [accessToken]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm(getDefault(null)); setError(''); setModalOpen(true); };
  const openEdit = (row) => { setEditing(row); setForm(getDefault(row)); setError(''); setModalOpen(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || form.latitude === '' || form.longitude === '') {
      setError('Name and coordinates are required');
      return;
    }
    const payload = {
      ...form,
      latitude: Number(form.latitude),
      longitude: Number(form.longitude),
      radiusMeters: Number(form.radiusMeters) || 100,
      accuracyThresholdMeters: Number(form.accuracyThresholdMeters) || 50,
    };
    setSubmitting(true);
    try {
      if (editing) await updateWorkLocation(editing.id, payload, accessToken);
      else await createWorkLocation(payload, accessToken);
      setModalOpen(false);
      load();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (row) => {
    if (!confirm(`Delete work location "${row.name}"?`)) return;
    try { await deleteWorkLocation(row.id, accessToken); load(); } catch (err) { alert(err.message); }
  };

  const fetchCurrentLocation = (e) => {
    e.preventDefault();
    setError('');
    if (!navigator.geolocation) { setError('Geolocation is not supported by this browser'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setForm((f) => ({ ...f, latitude: String(latitude), longitude: String(longitude) }));
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setError(err.code === err.PERMISSION_DENIED
          ? 'Location access denied. Allow location permission and try again.'
          : 'Could not get your location. Move outdoors and try again.');
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const columns = [
    { key: 'name', label: 'Name', render: (v, r) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>{v}</span>
        {r.isActive ? <span className={styles.activeBadge}>Active</span> : null}
      </div>
    )},
    { key: 'address', label: 'Address', render: (v) => v || '-' },
    { key: 'latitude', label: 'Latitude', width: '110px', render: formatLatLng },
    { key: 'longitude', label: 'Longitude', width: '110px', render: formatLatLng },
    { key: 'radiusMeters', label: 'Radius', width: '80px', render: (v) => `${v}m` },
    { key: 'accuracyThresholdMeters', label: 'Accuracy', width: '90px', render: (v) => `${v}m` },
    { key: 'geofenceEnabled', label: 'Geofence', width: '90px', render: (v) => v ? 'Enabled' : 'Disabled' },
    { key: 'id', label: '', width: '100px', render: (_, row) => (
      <div className={styles.actions}>
        <button className={styles.editBtn} onClick={(e) => { e.stopPropagation(); openEdit(row); }}>Edit</button>
        <button className={styles.deleteBtn} onClick={(e) => { e.stopPropagation(); handleDelete(row); }}>Del</button>
      </div>
    )},
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Work Locations</h1>
          <p className={styles.pageSub}>
            Geofenced attendance centers. Setting a location as active replaces the current active one.
          </p>
        </div>
        <button className={styles.primaryBtn} onClick={openCreate}>+ New Location</button>
      </div>

      {error && !modalOpen && <div className={styles.error}>{error}</div>}

      {loading ? <div className={styles.loading}>Loading...</div> : (
        <Table columns={columns} data={data} emptyMessage="No work locations configured" />
      )}

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Work Location' : 'New Work Location'} wide>
        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.mapSection}>
            <p className={styles.mapHint}>Click on the map to set the location, drag the pin to fine-tune, or use &ldquo;Use my current location&rdquo;.</p>
            <LocationMap
              latitude={form.latitude}
              longitude={form.longitude}
              radiusMeters={form.radiusMeters}
              onChange={(lat, lng) => setForm((f) => ({ ...f, latitude: lat, longitude: lng }))}
              onLocate={fetchCurrentLocation}
              locating={locating}
            />
          </div>
          <div className={styles.formGrid}>
            <FormField label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Head Office" required />
            <FormField label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <FormField label="Latitude" type="number" step="0.0000001" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} placeholder="e.g. 19.123456" required />
            <FormField label="Longitude" type="number" step="0.0000001" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} placeholder="e.g. 72.876543" required />
            <FormField label="Radius (meters)" type="number" min="10" value={form.radiusMeters} onChange={(e) => setForm({ ...form, radiusMeters: e.target.value })} />
            <FormField label="GPS Accuracy Limit (m)" type="number" min="5" value={form.accuracyThresholdMeters} onChange={(e) => setForm({ ...form, accuracyThresholdMeters: e.target.value })} />
          </div>
          <div className={styles.checkRow}>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.geofenceEnabled} onChange={(e) => setForm({ ...form, geofenceEnabled: e.target.checked })} />
              Enforce geofence (employees must be within radius to punch)
            </label>
            <label className={styles.checkLabel}>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Set as active location
            </label>
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setModalOpen(false)}>Cancel</button>
            <button type="submit" className={styles.primaryBtn} disabled={submitting}>{submitting ? 'Saving...' : editing ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}