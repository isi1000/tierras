import { useEffect, useRef, useState } from 'react';
import type { Point } from './lib/types';
export type LivePosition = Point & { accuracy: number; timestamp: number };
export function useLiveLocation(onFirst: (point: Point) => void) {
  const [position, setPosition] = useState<LivePosition | null>(null), [locating, setLocating] = useState(false), [error, setError] = useState('');
  const watch = useRef<number | null>(null), generation = useRef(0), callback = useRef(onFirst); callback.current = onFirst;
  useEffect(() => () => { generation.current++; if (watch.current !== null) navigator.geolocation?.clearWatch(watch.current); }, []);
  function locate() {
    if (!navigator.geolocation) { setError('Este navegador no permite consultar la ubicación. Elige un punto en el mapa.'); return; }
    if (watch.current !== null) navigator.geolocation.clearWatch(watch.current);
    const current = ++generation.current; let first = true;
    setLocating(true); setError('');
    watch.current = navigator.geolocation.watchPosition(value => {
      if (current !== generation.current) return;
      const { latitude: lat, longitude: lng, accuracy } = value.coords;
      if (![lat, lng, accuracy].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180 || accuracy < 0) return;
      const next = { lat, lng, accuracy, timestamp: value.timestamp };
      setPosition(next); setLocating(false); setError('');
      if (first) { first = false; callback.current(next); }
    }, failure => {
      if (current !== generation.current) return;
      setLocating(false); setPosition(null);
      setError(failure.code === 1 ? 'Activa el permiso de ubicación o elige un punto en el mapa.' : 'No se pudo actualizar tu ubicación. Pulsa de nuevo el botón de ubicación.');
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 });
  }
  return { position, locating, error, locate, clearError: () => setError('') };
}
