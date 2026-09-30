import { useEffect, useState } from 'react';
import { LoaderCircle, RefreshCw } from 'lucide-react';
import { SOIL_PROPERTIES, depthLabel, lookupSoil, type SoilDepth, type SoilEstimate, type SoilProperty } from './lib/mapSources';
import type { Point } from './lib/types';

const number = (value: number) => value.toLocaleString('es-ES', { maximumFractionDigits: 1 });
const percent = (value: number) => number(value) + ' %';
const cache = new Map<string, SoilEstimate>();
export default function SoilPointInfo({ point, depth, property: active }: { point: Point; depth: SoilDepth; property: SoilProperty }) {
  const [rows, setRows] = useState<SoilEstimate[]>([]), [busy, setBusy] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setRows([]); setBusy(true); setError('');
    const key = `${point.lat.toFixed(5)},${point.lng.toFixed(5)}:${depth}`;
    const timer = setTimeout(async () => {
      const results = await Promise.allSettled(SOIL_PROPERTIES.map(async property => {
        const interval = property.id === active, entryKey = `${key}:${property.id}:${interval}`;
        const saved = cache.get(entryKey);
        if (saved && attempt === 0) return saved;
        const value = await lookupSoil(point, property.id, depth, controller.signal, interval);
        if (!controller.signal.aborted) {
          if (cache.size >= 120) cache.delete(cache.keys().next().value!);
          cache.set(entryKey, value); if (interval) cache.set(`${key}:${property.id}:false`, { ...value, low: null, high: null });
        }
        return value;
      }));
      if (controller.signal.aborted) return;
      const values = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
      setRows(values);
      if (results.some(result => result.status === 'rejected')) setError('Parte de SoilGrids no respondió. Puedes reintentar.');
      setBusy(false);
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [point.lat, point.lng, depth, active, attempt]);
  return <details className="soil-point-info" open>
    <summary>Suelo estimado · {depthLabel(depth)}</summary>
    {busy ? <p className="meta"><LoaderCircle size={14} className="spin" />Consultando SoilGrids…</p> : <>
      <div className="soil-estimates">{SOIL_PROPERTIES.map(property => {
        const row = rows.find(item => item.property === property.id);
        return <div key={property.id}><span>{property.label}</span><b>{row?.mean != null ? percent(row.mean) : 'Sin datos'}</b>
          {row?.low != null && row.high != null && <small>90 %: <span>{number(row.low)}–{number(row.high)} %</span></small>}</div>;
      })}</div>
      {error && <p className="soil-query-error" role="status">{error}<button className="text-button" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={13} />Reintentar SoilGrids</button></p>}
      <p className="soil-disclaimer">Media estimada · intervalo del 90 % para la fracción seleccionada · píxel de 250 m. Son tamaños de grano, no minerales ni una prueba de plasticidad.</p>
    </>}
  </details>;
}
