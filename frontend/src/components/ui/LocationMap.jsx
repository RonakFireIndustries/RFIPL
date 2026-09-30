import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import styles from './LocationMap.module.css';

function makePinIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="${styles.pin}"></div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export default function LocationMap({ latitude, longitude, radiusMeters, onChange, onLocate, locating }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);

  const hasCoords = latitude !== '' && longitude !== '' && latitude !== undefined && longitude !== undefined
    && latitude !== null && longitude !== null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [19.2, 73.0],
      zoom: 13,
      scrollWheelZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const icon = makePinIcon();
    const marker = L.marker([0, 0], { icon, draggable: true }).addTo(map);
    marker.on('drag', () => {
      const p = marker.getLatLng();
      onChange(String(p.lat), String(p.lng));
    });
    markerRef.current = marker;

    const circle = L.circle([0, 0], { radius: 100 }).addTo(map);
    circleRef.current = circle;

    map.on('click', (e) => {
      onChange(String(e.latlng.lat), String(e.latlng.lng));
      markerRef.current.setLatLng(e.latlng);
      circleRef.current.setLatLng(e.latlng);
      map.setView(e.latlng, Math.max(map.getZoom(), 15));
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [onChange]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !markerRef.current || !circleRef.current) return;
    if (!hasCoords) return;
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;
    const point = [lat, lng];
    markerRef.current.setLatLng(point);
    circleRef.current.setLatLng(point);
    const radius = Number(radiusMeters) || 100;
    circleRef.current.setRadius(radius);
    if (!map.getBounds().contains(point)) {
      map.setView(point, Math.max(map.getZoom(), 13));
    }
  }, [latitude, longitude, radiusMeters, hasCoords]);

  useEffect(() => {
    const t = setTimeout(() => { mapRef.current?.invalidateSize(); }, 300);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={styles.wrapper}>
      <div ref={containerRef} className={styles.map} />
      <button
        type="button"
        className={styles.locateBtn}
        onClick={onLocate}
        disabled={locating}
      >
        {locating ? 'Locating...' : 'Use my current location'}
      </button>
    </div>
  );
}