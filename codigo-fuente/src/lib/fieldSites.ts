import { requestJson, type GeoBounds } from './mapSources';
import type { Point } from './types';

export const IELIG_SERVICE = 'https://mapas.igme.es/gis/rest/services/BasesDatos/IGME_IELIG/MapServer';
export const ligUrl = (code: string) => `https://info.igme.es/ielig/LIGInfo.aspx?${new URLSearchParams({ Codigo: code })}`;
export const safeHttpUrl = (value: unknown): string | null => {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? url.href : null; } catch { return null; }
};
const string = (value: unknown, limit = 600) => typeof value === 'string' ? value.trim().slice(0, limit) : '';
export type HeritageSite = Point & { code: string; name: string; interest: string; description: string; rings: number[][][]; referenceOnly: boolean };
type ArcFeature = { attributes?: Record<string, unknown>; geometry?: { x?: number; y?: number; rings?: number[][][] } };

export function parseHeritage(features: unknown[]): HeritageSite[] {
  const records = new Map<string, HeritageSite>();
  for (const raw of features) {
    const feature = raw as ArcFeature | null, a = feature?.attributes, g = feature?.geometry;
    if (!a || !g || string(a.Confidencialidad).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() !== 'publico') continue;
    const code = string(a.CODIGO ?? a.Codigo, 20), name = string(a.Denominacion, 150);
    if (!/^[a-z\d_-]{1,20}$/i.test(code) || !name) continue;
    const rings = (Array.isArray(g.rings) ? g.rings : []).filter(ring => Array.isArray(ring) && ring.length >= 4 && ring.every(p => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) <= 180 && Math.abs(p[1]) <= 90));
    let lng = g.x, lat = g.y;
    const referenceOnly = typeof lng !== 'number' || typeof lat !== 'number';
    if (referenceOnly) {
      const vertices = rings.flat(); if (!vertices.length) continue;
      let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
      for (const [x, y] of vertices) { west = Math.min(west, x); east = Math.max(east, x); south = Math.min(south, y); north = Math.max(north, y); }
      lng = (west + east) / 2; lat = (south + north) / 2;
    }
    if (!Number.isFinite(lng) || !Number.isFinite(lat) || Math.abs(lng!) > 180 || Math.abs(lat!) > 90) continue;
    const previous = records.get(code);
    const site = { code, name, interest: string(a.InteresPrincipal, 120), description: string(a.Descripcion, 1000), lat: lat!, lng: lng!, rings, referenceOnly };
    if (previous) records.set(code, { ...previous, ...(referenceOnly ? {} : { lat: lat!, lng: lng!, referenceOnly: false }), rings: previous.rings.length ? previous.rings : rings });
    else records.set(code, site);
  }
  return [...records.values()];
}
async function ligQuery(layer: number, params: Record<string, string>, signal?: AbortSignal) {
  const data = await requestJson(`${IELIG_SERVICE}/${layer}/query?${new URLSearchParams({ f: 'json', where: '1=1', outFields: '*', returnGeometry: 'true', outSR: '4326', ...params })}`, signal) as { error?: unknown; features?: unknown[]; exceededTransferLimit?: boolean };
  if (data.error || !Array.isArray(data.features)) throw new Error('IELIG no responde ahora. Puedes reintentar.');
  return data as { features: unknown[]; exceededTransferLimit?: boolean };
}
export async function lookupHeritage(bounds: GeoBounds, signal?: AbortSignal) {
  const results = await Promise.all([0, 1].map(async layer => {
    const features: unknown[] = [], seen = new Set<string>(); let truncated = false;
    for (let page = 0; page < 2; page++) {
      const data = await ligQuery(layer, { geometry: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', resultRecordCount: '100', resultOffset: String(page * 100) }, signal);
      const signature = JSON.stringify(data.features);
      if (seen.has(signature)) { truncated = true; break; } seen.add(signature); features.push(...data.features);
      if (!data.exceededTransferLimit && data.features.length < 100) break;
      if (page === 1) truncated = true;
    }
    return { features, truncated };
  }));
  return { sites: parseHeritage(results.flatMap(result => result.features)), truncated: results.some(result => result.truncated) };
}
export async function lookupHeritageCode(code: string, signal?: AbortSignal) {
  if (!/^[a-z\d_-]{1,20}$/i.test(code)) throw new Error('Código IELIG no válido.');
  const results = await Promise.allSettled([0, 1].map(layer => ligQuery(layer, { where: `${layer === 0 ? 'CODIGO' : 'Codigo'}='${code}'` }, signal)));
  const site = parseHeritage(results.flatMap(result => result.status === 'fulfilled' ? result.value.features : [])).find(site => site.code.toLowerCase() === code.toLowerCase());
  if (!site) throw new Error(results.some(result => result.status === 'rejected') ? 'IELIG no responde por completo. Reintenta o consulta la ficha oficial.' : 'No se encontró la ficha pública de este lugar.');
  return site;
}
export const HIGUERUELA_DOCUMENTS = [
  { title: 'Mapa geológico del entorno', type: 'pdf', detail: 'PDF de MAGNA: conserva su escala y detalle geológico.', url: 'https://info.igme.es/ielig/documentacion/tm/tm142/mapas%20y%20ortofotos/m-tm142-05.pdf' },
  { title: 'Delimitación sobre mapa topográfico', type: 'image', detail: 'Base IGN 1:25.000. Delimitación del LIG con mayor detalle topográfico.', url: 'https://info.igme.es/ielig/documentacion/tm/tm142/mapas%20y%20ortofotos/m-tm142-02.jpg' },
  { title: 'Accesos y tres afloramientos', type: 'image', detail: 'Ortofoto documentada por IELIG: itinerarios y afloramientos.', url: 'https://info.igme.es/ielig/documentacion/tm/tm142/mapas%20y%20ortofotos/o-tm142-04.jpg' },
];

const CLM = 'https://geoservicios.castillalamancha.es/arcgis/rest/services/Vector/';
export const PROTECTION_SOURCES = [
  { id: 'enp', title: 'Espacios naturales protegidos', service: CLM + 'Espacios_Naturales_Protegidos/MapServer', color: [38, 116, 78] },
  { id: 'natura', title: 'Red Natura 2000', service: CLM + 'RN_2000_limites/MapServer', color: [48, 127, 171] },
  { id: 'zpp', title: 'Zonas periféricas de protección', service: CLM + 'Espacios_Naturales_Protegidos_ZPP/MapServer', color: [189, 135, 43] },
] as const;
export type ProtectionSource = typeof PROTECTION_SOURCES[number];
export type ProtectionMatch = { id: string; name: string; figure: string; source: string; url: string | null };
export function parseProtection(features: unknown[], source: ProtectionSource): ProtectionMatch[] {
  const matches = new Map<string, ProtectionMatch>();
  for (const raw of features) {
    const a = (raw as ArcFeature | null)?.attributes; if (!a) continue;
    const name = string(a.NOMBRE ?? a.SITE_NAME, 200); if (!name) continue;
    const id = source.id + ':' + string(a.CODIGO ?? a.SITE_CODE ?? String(a.OBJECTID ?? name), 120);
    matches.set(id, { id, name, figure: [string(a.FIGURA, 100), string(a.TIPO_1, 100), string(a.TIPO_2, 100)].filter(Boolean).join(' · '), source: source.title, url: safeHttpUrl(a.URL) || safeHttpUrl(a.DECLARAC) });
  }
  return [...matches.values()];
}
export async function lookupProtection(point: Point, signal?: AbortSignal) {
  const results = await Promise.allSettled(PROTECTION_SOURCES.map(async source => {
    const params = new URLSearchParams({ f: 'json', where: '1=1', geometry: JSON.stringify({ x: point.lng, y: point.lat, spatialReference: { wkid: 4326 } }), geometryType: 'esriGeometryPoint', inSR: '4326', spatialRel: 'esriSpatialRelIntersects', returnGeometry: 'false', outFields: '*', resultRecordCount: '100' });
    const data = await requestJson(`${source.service}/0/query?${params}`, signal) as { features?: unknown[]; error?: unknown; exceededTransferLimit?: boolean };
    if (data.error || !Array.isArray(data.features) || data.exceededTransferLimit) throw new Error(source.title);
    return parseProtection(data.features, source);
  }));
  return { matches: results.flatMap(result => result.status === 'fulfilled' ? result.value : []), failed: results.flatMap((result, i) => result.status === 'rejected' ? [PROTECTION_SOURCES[i].title] : []) };
}
export function protectionTileUrl(source: ProtectionSource, bbox: string, size = 256) {
  const drawingInfo = { renderer: { type: 'simple', symbol: { type: 'esriSFS', style: 'esriSFSSolid', color: [...source.color, 32], outline: { type: 'esriSLS', style: 'esriSLSSolid', color: [...source.color, 230], width: 1.5 } } } };
  return `${source.service}/export?${new URLSearchParams({ f: 'image', bbox, bboxSR: '3857', imageSR: '3857', size: `${size},${size}`, format: 'png32', transparent: 'true', layers: 'show:0', dynamicLayers: JSON.stringify([{ id: 0, source: { type: 'mapLayer', mapLayerId: 0 }, drawingInfo }]) })}`;
}
