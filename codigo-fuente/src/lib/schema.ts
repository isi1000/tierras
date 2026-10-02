import { z } from 'zod';
import { isVisit, type Geology, type Sample, type Firing, type Photo, type Visit, type NotebookRecord } from './types';

export const idSchema = z.string().uuid();
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Indica una fecha válida.').refine(value => {
  const date = new Date(value + 'T12:00:00Z');
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Indica una fecha válida.');
export const geologySchema = z.object({
  status: z.enum(['ok', 'empty', 'unavailable']), sheet: z.string().max(20).nullable(),
  sheetName: z.string().max(200).nullable(), unit: z.string().max(50).nullable(),
  lithology: z.string().max(1000).nullable(), lithologyOriginal: z.string().max(1000).nullable().optional(),
  source: z.string().max(200), sourceUrl: z.string().url().max(2000), queriedAt: z.string().datetime(),
  via: z.enum(['server', 'browser']).optional(), error: z.string().max(2000).optional(),
});
export const sampleInput = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre para la muestra.').max(120),
  collectedDate: dateSchema, lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180),
  description: z.string().max(10000).default(''), notes: z.string().max(20000).default(''),
  geologySnapshot: z.object({ lat: z.number(), lng: z.number(), geology: geologySchema }).optional(),
});
export const sampleEdit = sampleInput.pick({ name: true, collectedDate: true, description: true, notes: true }).partial()
  .refine(value => Object.keys(value).length > 0, 'No hay cambios para guardar.');
export const firingInput = z.object({
  date: dateSchema, temperature: z.number().min(100).max(1700),
  atmosphere: z.enum(['Oxidante', 'Reductora', 'Otra']),
  holdMinutes: z.number().int().min(0).max(1440).nullable().default(null),
  color: z.string().max(120).default(''), shrinkage: z.number().min(0).max(100).nullable().default(null),
  absorption: z.number().min(0).max(100).nullable().default(null),
  description: z.string().max(20000).default(''), notes: z.string().max(20000).default(''),
});
const firingSchema = firingInput.extend({ id: idSchema, sampleId: idSchema, createdAt: z.string().datetime() });
const photoSchema = z.object({ id: idSchema, sampleId: idSchema, firingId: idSchema.nullable(),
  caption: z.string().max(500), createdAt: z.string().datetime(), objectKey: z.string().max(500).optional() });
export const sampleSchema = sampleInput.omit({ geologySnapshot: true }).extend({
  kind: z.literal('sample').optional(),
  id: idSchema, geology: geologySchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  firings: z.array(firingSchema).max(500), photos: z.array(photoSchema).max(60),
}).superRefine((sample, ctx) => {
  const firingIds = new Set(sample.firings.map(f => f.id));
  if (firingIds.size !== sample.firings.length || new Set(sample.photos.map(p => p.id)).size !== sample.photos.length ||
      sample.firings.some(f => f.sampleId !== sample.id) ||
      sample.photos.some(p => p.sampleId !== sample.id || (p.firingId !== null && !firingIds.has(p.firingId)))) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'La ficha contiene referencias que no son válidas.' });
  }
});
export function cleanSample(value: unknown): Sample { return sampleSchema.parse(value); }
const sourceUrl = z.string().url().max(2000).refine(value => ['https:', 'http:'].includes(new URL(value).protocol), 'Usa un enlace http o https.');
export const visitInput = z.object({
  name: z.string().trim().min(1, 'Escribe un nombre para el lugar.').max(120),
  lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), notes: z.string().max(20000).default(''),
  plannedDate: dateSchema.nullable().default(null), visitStatus: z.enum(['pending', 'visited']).default('pending'),
  sourceUrl: sourceUrl.nullable().default(null), sourceTitle: z.string().max(200).nullable().default(null),
  geologySnapshot: sampleInput.shape.geologySnapshot,
});
export const visitSchema = visitInput.omit({ geologySnapshot: true }).extend({
  kind: z.literal('visit'), id: idSchema, geology: geologySchema, createdAt: z.string().datetime(), updatedAt: z.string().datetime(),
  collectedDate: z.null(), description: z.string().max(10000).default(''), photos: z.tuple([]), firings: z.tuple([]),
});
export function cleanRecord(value: unknown): NotebookRecord {
  return value && typeof value === 'object' && 'kind' in value && value.kind === 'visit' ? visitSchema.parse(value) : cleanSample(value);
}
export function makeVisit(value: unknown): Visit {
  const data = visitInput.parse(value), now = new Date().toISOString(), snapshot = data.geologySnapshot;
  const geology = snapshot && Math.abs(snapshot.lat - data.lat) < 1e-7 && Math.abs(snapshot.lng - data.lng) < 1e-7 ? snapshot.geology : unavailableGeology();
  return visitSchema.parse({ ...data, kind: 'visit', id: crypto.randomUUID(), geology, createdAt: now, updatedAt: now, collectedDate: null, description: '', photos: [], firings: [] });
}
export function editRecord(record: NotebookRecord, route: string[], method: string, value: unknown): NotebookRecord | null {
  if (!isVisit(record)) return editSample(record, route, method, value);
  if (!route.length && method === 'DELETE') return null;
  if (route.length || method !== 'PATCH') throw new Error('Operación no disponible para un lugar de visita.');
  const changes = visitInput.pick({ name: true, notes: true, plannedDate: true, visitStatus: true, sourceUrl: true, sourceTitle: true }).partial().parse(value);
  return visitSchema.parse({ ...record, ...changes, updatedAt: new Date().toISOString() });
}
export function unavailableGeology(): Geology {
  return { status: 'unavailable', sheet: null, sheetName: null, unit: null, lithology: null,
    source: 'IGME-CSIC · MAGNA 50', sourceUrl: 'https://info.igme.es/cartografiadigital/geologica/Magna50.aspx',
    queriedAt: new Date().toISOString(), via: 'browser' };
}
export function makeSample(value: unknown): Sample {
  const data = sampleInput.parse(value), now = new Date().toISOString();
  const snapshot = data.geologySnapshot;
  const geology = snapshot && Math.abs(snapshot.lat - data.lat) < 1e-7 && Math.abs(snapshot.lng - data.lng) < 1e-7
    ? snapshot.geology : unavailableGeology();
  return cleanSample({ ...data, id: crypto.randomUUID(), geology, createdAt: now, updatedAt: now, firings: [], photos: [] });
}
export function editSample(sample: Sample, route: string[], method: string, value: unknown): Sample | null {
  const next = cleanSample(sample), now = new Date().toISOString();
  if (!route.length && method === 'DELETE') return null;
  if (!route.length && method === 'PATCH') Object.assign(next, sampleEdit.parse(value));
  else if (route[0] === 'geology' && route.length === 1 && method === 'POST') {
    const snapshot = z.object({ geologySnapshot: z.object({ lat: z.number(), lng: z.number(), geology: geologySchema }) }).parse(value).geologySnapshot;
    if (Math.abs(snapshot.lat - sample.lat) > 1e-7 || Math.abs(snapshot.lng - sample.lng) > 1e-7) throw new Error('La consulta no corresponde a esta muestra.');
    if (snapshot.geology.status === 'unavailable') throw new Error('MAGNA no está disponible ahora. Conservamos la consulta anterior.');
    next.geology = snapshot.geology;
  } else if (route[0] === 'firings' && route.length === 1 && method === 'POST') {
    const data = firingInput.parse(value);
    next.firings.unshift({ ...data, id: crypto.randomUUID(), sampleId: sample.id, createdAt: now });
  } else if (route[0] === 'firings' && route.length === 2 && method === 'PATCH') {
    idSchema.parse(route[1]);
    const firing = next.firings.find(f => f.id === route[1]);
    if (!firing) throw new Error('No se encontró esa cocción.');
    Object.assign(firing, firingInput.parse(value));
  } else if (route.length || method !== 'PATCH') throw new Error('Operación no disponible.');
  next.updatedAt = now;
  return cleanSample(next);
}
export async function validateImage(file: Blob): Promise<void> {
  if (file.size < 1 || file.size > 8 * 1024 * 1024) throw new Error('La foto debe ocupar menos de 8 MB.');
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
  const webp = String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
  if (!(jpeg && file.type === 'image/jpeg') && !(png && file.type === 'image/png') && !(webp && file.type === 'image/webp'))
    throw new Error('Usa una imagen JPG, PNG o WebP.');
}
export function addPhoto(sample: Sample, firingId: string | null, caption = ''): Photo {
  if (sample.photos.length >= 60) throw new Error('Esta muestra ya tiene 60 fotos.');
  if (firingId && !sample.firings.some(f => f.id === firingId)) throw new Error('No se encontró esa cocción.');
  return { id: crypto.randomUUID(), sampleId: sample.id, firingId, caption: caption.slice(0, 500), createdAt: new Date().toISOString() };
}

export type Repository = {
  list(): Promise<NotebookRecord[]>;
  create(sample: NotebookRecord): Promise<NotebookRecord>;
  mutate(id: string, route: string[], method: string, value: unknown): Promise<NotebookRecord | null>;
  upload(sampleId: string, firingId: string | null, blob: Blob, caption?: string): Promise<Sample>;
  exportBackup(): Promise<Backup>;
  importBackup(value: unknown): Promise<{ imported: number; skipped: number }>;
};
export type Backup = { app: 'Tierras'; version: 2; exportedAt: string; samples: Sample[]; visits: Visit[];
  photos: { id: string; dataUrl: string }[] };
export type { Sample, Firing, Photo, Visit, NotebookRecord };
