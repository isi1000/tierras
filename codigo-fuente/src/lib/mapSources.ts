import { normalizeIgmeText } from './geology';
import type { Point } from './types';

export type SoilProperty = 'clay' | 'silt' | 'sand';
export const SOIL_PROPERTIES: { id: SoilProperty; label: string }[] = [
  { id: 'clay', label: 'Arcilla' }, { id: 'silt', label: 'Limo' }, { id: 'sand', label: 'Arena' },
];
export const SOIL_DEPTHS = ['0-5cm', '5-15cm', '15-30cm', '30-60cm', '60-100cm', '100-200cm'] as const;
export type SoilDepth = typeof SOIL_DEPTHS[number];
export const depthLabel = (depth: SoilDepth) => depth.replace('cm', ' cm').replace('-', '–');
export const BDMIN_FILTERS = [
  { id: 'ceramic', label: 'Materiales de interés cerámico', pattern: /arcill|caolin|bentonit|montmorillon|feldespat|granit|pegmatit|basalt|piroclast|puzolan|pumita|ocre|caliz|calcita|dolomi|cuarz|cuarc|silic|arena/ },
  { id: 'all', label: 'Todas las materias primas', pattern: /./ },
  { id: 'clay', label: 'Arcillas y caolines', pattern: /arcill|caolin|bentonit|montmorillon|sepiolit|palygorsk|attapulg/ },
  { id: 'feldspar', label: 'Feldespatos y granitos', pattern: /feldespat|granit|pegmatit|aplit|sienit/ },
  { id: 'volcanic', label: 'Materiales volcánicos', pattern: /basalt|piroclast|puzolan|pumita|volcan/ },
  { id: 'ochre', label: 'Ocres y hierro', pattern: /ocre|hierro|hematit|limonit|goethit/ },
  { id: 'carbonates', label: 'Calizas y dolomías', pattern: /caliz|calcita|dolomi|marga/ },
  { id: 'silica', label: 'Sílice y arenas', pattern: /cuarz|cuarc|silic|arena/ },
] as const;
export type BdminFilter = typeof BDMIN_FILTERS[number]['id'];
export type MapSources = { bdmin: boolean; bdminFilter: BdminFilter; soil: boolean; soilProperty: SoilProperty; soilDepth: SoilDepth; soilOpacity: number; ielig: boolean; protected: boolean; protectedOpacity: number };
export const DEFAULT_MAP_SOURCES: MapSources = { bdmin: true, bdminFilter: 'ceramic', soil: false, soilProperty: 'clay', soilDepth: '15-30cm', soilOpacity: .65, ielig: false, protected: false, protectedOpacity: .8 };
export type MapSourceAction = 'bdmin' | 'soil' | 'pnoa' | 'ielig' | 'protected';

export const BDMIN_SERVICE = 'https://mapas.igme.es/gis/rest/services/BasesDatos/IGME_BDMIN_Explotaciones/MapServer';
export const soilService = (property: SoilProperty) => `https://maps.isric.org/mapserv/${property}`;
export const soilLayerName = (property: SoilProperty, depth: SoilDepth) => `${property}_${depth}_mean`;
export function soilLegendUrl(property: SoilProperty, depth: SoilDepth) {
  return `${soilService(property)}?${new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetLegendGraphic', LAYER: soilLayerName(property, depth), FORMAT: 'image/png', STYLE: 'default' })}`;
}

export function parseSoilCollections(body: string): unknown {
  // MapServer devuelve una colección GeoJSON por capa, concatenadas cuando
  // se piden la media y los cuantiles juntos. Se leen documentos completos,
  // respetando las llaves y comillas de sus cadenas; nunca se evalúa código.
  const documents: { type?: string; features?: unknown[] }[] = [];
  let start = -1, level = 0, quoted = false, escaped = false;
  for (let i = 0; i < body.length; i++) {
    const char = body[i];
    if (start < 0) {
      if (/\s/.test(char)) continue;
      if (char !== '{') throw new Error('Respuesta de SoilGrids no válida.');
      start = i; level = 1; continue;
    }
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{' || char === '[') level++;
    else if (char === '}' || char === ']') {
      if (--level === 0) { documents.push(JSON.parse(body.slice(start, i + 1))); start = -1; }
    }
  }
  if (start >= 0 || !documents.length || documents.some(document => document.type !== 'FeatureCollection' || !Array.isArray(document.features)))
    throw new Error('Respuesta de SoilGrids incompleta o no válida.');
  return { type: 'FeatureCollection', features: documents.flatMap(document => document.features!) };
}
export async function requestJson(url: string, signal?: AbortSignal, soil = false): Promise<unknown> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) throw new DOMException('Consulta cancelada', 'AbortError');
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('El servicio de mapas no responde ahora.');
    const body = await response.text();
    return soil ? parseSoilCollections(body) : JSON.parse(body);
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

export type BdminPoint = Point & { id: string; substance: string; municipality: string; province: string; status: string; uses: string; code: string; records: number };
export type GeoBounds = { west: number; south: number; east: number; north: number };
const text = (value: unknown) => typeof value === 'string' ? normalizeIgmeText(value.trim()).slice(0, 1200) : '';
const normalized = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function parseBdminPoints(features: unknown[]): BdminPoint[] {
  const points = new Map<string, BdminPoint>();
  for (const feature of features) {
    const row = feature as { attributes?: Record<string, unknown>; geometry?: { x?: unknown; y?: unknown } } | null;
    const a = row?.attributes, g = row?.geometry;
    if (!a || typeof g?.x !== 'number' || typeof g.y !== 'number' || !Number.isFinite(g.x) || !Number.isFinite(g.y) || Math.abs(g.x) > 180 || Math.abs(g.y) > 90) continue;
    const substance = text(a.Sustancia); if (!substance) continue;
    const municipality = text(a.Municipio), province = text(a.Provincia);
    // El inventario puede tener varias fichas en una misma ubicación.
    // Se conserva un punto por materia, lugar, uso y estado, junto al número de fichas.
    const key = `${g.x.toFixed(5)}:${g.y.toFixed(5)}:${substance}:${municipality}:${text(a.Usos)}:${text(a.Estado_Explotacion)}`;
    const prior = points.get(key);
    if (prior) { prior.records++; continue; }
    points.set(key, { id: String(a.ESRI_OID ?? a.Codigo_roca ?? key), lat: g.y, lng: g.x, substance, municipality, province,
      status: text(a.Estado_Explotacion), uses: text(a.Usos), code: text(a.Codigo_roca), records: 1 });
  }
  return [...points.values()];
}
export function filterBdminPoints(points: BdminPoint[], filter: BdminFilter) {
  const pattern = BDMIN_FILTERS.find(item => item.id === filter)?.pattern || /./;
  return points.filter(point => pattern.test(normalized(point.substance)));
}
export async function lookupBdmin(bounds: GeoBounds, signal?: AbortSignal): Promise<{ points: BdminPoint[]; truncated: boolean }> {
  const west = Math.max(-19.725, bounds.west), south = Math.max(26.985, bounds.south);
  const east = Math.min(4.805, bounds.east), north = Math.min(44.552, bounds.north);
  if (west >= east || south >= north) return { points: [], truncated: false };
  const features: unknown[] = [], seen = new Set<string>();
  const size = 500;
  let truncated = false;
  for (let page = 0; page < 3; page++) {
    const params = new URLSearchParams({ f: 'json', where: '1=1', geometry: `${west},${south},${east},${north}`, geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
      outFields: 'ESRI_OID,Codigo_roca,Sustancia,Municipio,Provincia,Estado_Explotacion,Usos', returnGeometry: 'true', outSR: '4326', resultRecordCount: String(size), resultOffset: String(page * size) });
    const data = await requestJson(`${BDMIN_SERVICE}/0/query?${params}`, signal) as { error?: unknown; features?: unknown[]; exceededTransferLimit?: boolean };
    if (data.error || !Array.isArray(data.features)) throw new Error('No se pudo consultar BDMIN. Reintenta más tarde.');
    if (!data.features.length) break;
    const signature = JSON.stringify(data.features);
    if (seen.has(signature)) { truncated = true; break; }
    seen.add(signature); features.push(...data.features);
    if (!data.exceededTransferLimit && data.features.length < size) break;
    if (page === 2) truncated = true;
  }
  return { points: parseBdminPoints(features), truncated };
}

export type SoilEstimate = { property: SoilProperty; mean: number | null; low: number | null; high: number | null };
export function parseSoilEstimates(data: unknown, property: SoilProperty, depth: SoilDepth): SoilEstimate {
  const body = data as { features?: { id?: string; properties?: { pixel_value?: unknown; unit?: unknown } }[] } | null;
  if (!Array.isArray(body?.features)) throw new Error('SoilGrids devolvió una respuesta que no se pudo interpretar.');
  const values = new Map<string, number | null>();
  for (const feature of body.features) {
    if (!feature.id?.startsWith(`${property}_${depth}_`)) continue;
    const properties = feature.properties;
    if (properties?.unit !== 'g/kg') throw new Error('La unidad de SoilGrids no se reconoce. No mostramos un porcentaje.');
    const raw = properties.pixel_value;
    const value = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
    // Valores originales de textura en g/kg: 297 g/kg = 29,7 %.
    // NoData y valores fuera de 0–1000 se mantienen como datos ausentes.
    values.set(feature.id, Number.isFinite(value) && value >= 0 && value <= 1000 ? value / 10 : null);
  }
  const mean = values.get(`${property}_${depth}_mean`) ?? null;
  const low = values.get(`${property}_${depth}_Q0.05`) ?? null;
  const high = values.get(`${property}_${depth}_Q0.95`) ?? null;
  return { property, mean, low: low !== null && high !== null && low <= high ? low : null, high: low !== null && high !== null && low <= high ? high : null };
}
export async function lookupSoil(point: Point, property: SoilProperty, depth: SoilDepth, signal?: AbortSignal, interval = false): Promise<SoilEstimate> {
  const lat = Math.max(-85, Math.min(85, point.lat));
  const x = point.lng * 20037508.342789244 / 180;
  const y = Math.log(Math.tan((90 + lat) * Math.PI / 360)) * 6378137;
  const suffixes = interval ? ['mean', 'Q0.05', 'Q0.95'] : ['mean'];
  // Una capa por consulta: al consultar varias, el servicio reutiliza el id
  // de la última capa y puede devolver píxeles vecinos. No se mezclan esos datos.
  const collections = await Promise.all(suffixes.map(async suffix => {
    const layer = `${property}_${depth}_${suffix}`;
    const params = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.1.1', REQUEST: 'GetFeatureInfo', LAYERS: layer, QUERY_LAYERS: layer, STYLES: '', SRS: 'EPSG:3857',
      BBOX: `${x - 250},${y - 250},${x + 250},${y + 250}`, WIDTH: '101', HEIGHT: '101', X: '50', Y: '50', INFO_FORMAT: 'application/geo+json', FEATURE_COUNT: '1' });
    const result = await requestJson(`${soilService(property)}?${params}`, signal, true) as { features: { id?: string }[] };
    if (result.features.some(feature => feature.id !== layer)) throw new Error('SoilGrids devolvió datos de otra capa. Reintenta la consulta.');
    return result;
  }));
  return parseSoilEstimates({ features: collections.flatMap(collection => collection.features) }, property, depth);
}
