import type { Geology } from './types';
export const MAGNA_SERVICE = 'https://mapas.igme.es/gis/rest/services/Cartografia_Geologica/IGME_MAGNA_50/MapServer';
// Algunas etiquetas históricas de MAGNA conservan bytes CP850 leídos como Latin-1.
// Solo se corrigen cadenas con esos marcadores; se conserva también la etiqueta original.
export function normalizeIgmeText(value: string) {
  if (!/[µàÖ¥\u0090]/.test(value)) return value;
  const map: Record<string, string> = { 'µ': 'Á', 'à': 'Ó', 'Ö': 'Í', '¥': 'Ñ', '\u0090': 'É', 'é': 'Ú', '\u00a0': 'á', '\u0082': 'é', '¡': 'í', '¢': 'ó', '£': 'ú', '¤': 'ñ', '\u0081': 'ü' };
  return Array.from(value, char => map[char] || char).join('');
}
export async function lookupGeology(lat: number, lng: number, via: 'server' | 'browser' = 'server'): Promise<Geology> {
  const base = { source: 'IGME-CSIC · MAGNA 50', sourceUrl: MAGNA_SERVICE, queriedAt: new Date().toISOString(), via, sheet: null, sheetName: null, unit: null, lithology: null };
  async function query(layer: number) {
    const params = new URLSearchParams({ f: 'json', geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', outFields: '*', returnGeometry: 'false' });
    const response = await fetch(`${MAGNA_SERVICE}/${layer}/query?${params}`, { signal: AbortSignal.timeout(14000) });
    if (!response.ok) throw new Error('El servicio MAGNA no responde.');
    const data = await response.json() as { error?: unknown; features?: { attributes: Record<string, unknown> }[] };
    if (data.error) throw new Error('No se pudo consultar MAGNA.');
    return data.features?.[0]?.attributes;
  }
  const [unitResult, sheetResult] = await Promise.allSettled([query(11), query(0)]);
  const unit = unitResult.status === 'fulfilled' ? unitResult.value : undefined;
  const sheet = sheetResult.status === 'fulfilled' ? sheetResult.value : undefined;
  if (!unit && (unitResult.status === 'rejected' || sheetResult.status === 'rejected')) { console.warn('[MAGNA]', unitResult.status === 'rejected' ? String(unitResult.reason) : '', sheetResult.status === 'rejected' ? String(sheetResult.reason) : ''); return { ...base, status: 'unavailable', error: 'MAGNA no está disponible ahora. Puedes guardar la muestra y consultar su litología después.' }; }
  return { ...base, status: unit ? 'ok' : 'empty', sheet: unit?.HOJA ? String(unit.HOJA) : sheet?.NUM ? String(sheet.NUM) : null, sheetName: sheet?.NOMBRE ? String(sheet.NOMBRE) : null, unit: unit?.ID !== undefined ? String(unit.ID) : null, lithology: unit?.DLO ? normalizeIgmeText(String(unit.DLO)) : null, lithologyOriginal: unit?.DLO ? String(unit.DLO) : null };
}
export function interpretLithology(lithology: string | null) {
  if (!lithology) return [];
  const value = lithology.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const result: { name: string; detail: string }[] = [];
  if (/arcill|lutita|limolita|limos/.test(value)) result.push({ name: 'Fracción fina', detail: 'La unidad menciona materiales finos. La proporción de arcilla y su plasticidad requieren una prueba con la muestra.' });
  if (/marga|caliza|dolomia|carbonat/.test(value)) result.push({ name: 'Carbonatos posibles', detail: 'La unidad incluye materiales carbonatados. Comprueba la muestra: el mapa no indica cuánto carbonato contiene la tierra recogida.' });
  if (/arena|arenisca|cuarc|cuarz|grava|conglomer/.test(value)) result.push({ name: 'Fracción gruesa posible', detail: 'La unidad menciona arena, gravas o materiales silíceos. Observa el tamaño de grano y el residuo tras tamizar o decantar.' });
  if (/basalt|volcan|piroclast|lava|hidromagm/.test(value)) result.push({ name: 'Origen volcánico', detail: 'La unidad tiene origen volcánico. El material alterado puede ser distinto de la roca original; no se puede deducir su composición química con este mapa.' });
  if (/yeso|evaporit/.test(value)) result.push({ name: 'Yesos o evaporitas', detail: 'La unidad incluye materiales evaporíticos. Registra las inclusiones y contrasta el comportamiento en pequeñas pruebas.' });
  return result;
}
