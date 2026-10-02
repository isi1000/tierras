import { z } from 'zod';
import { CloudRepository } from './cloud';
import { LocalRepository } from './local';
import { appBase, notebookMode } from './config';
import { makeSample, makeVisit, idSchema } from './schema';
import type { Photo, Repository } from './schema';
export { notebookMode } from './config';
const repository: Repository = notebookMode === 'local'
  ? new LocalRepository('tierras-cuaderno-' + appBase.origin + appBase.pathname) : new CloudRepository();
export function getRepository(): Repository { return repository; }
export function photoUrl(photo: Photo): string { return photo.url || ''; }
function friendlyError(error: unknown): Error {
  if (error instanceof z.ZodError) return new Error(error.issues[0]?.message || 'Revisa los datos.');
  if (error instanceof DOMException && (error.name === 'QuotaExceededError' || error.name === 'UnknownError'))
    return new Error('No queda espacio para guardar en este dispositivo. Exporta una copia del cuaderno y libera espacio.');
  if (error instanceof Error) return error;
  if (error && typeof error === 'object' && 'message' in error) return new Error(String(error.message));
  return new Error('No se pudo completar la operación. Revisa la conexión e inténtalo de nuevo.');
}
// Conserva los formularios existentes; no realiza peticiones a un servidor /api.
export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  try {
    const method = init?.method?.toUpperCase() || 'GET';
    if (url === '/api/samples' && method === 'GET') return await repository.list() as T;
    const payload = typeof init?.body === 'string' ? JSON.parse(init.body) as unknown : undefined;
    if (url === '/api/samples' && method === 'POST') return await repository.create(makeSample(payload)) as T;
    if (url === '/api/visits' && method === 'POST') return await repository.create(makeVisit(payload)) as T;
    if (url === '/api/photos' && method === 'POST' && init?.body instanceof FormData) {
      const form = init.body, file = form.get('file');
      if (!(file instanceof Blob)) throw new Error('Selecciona una fotografía.');
      const sampleId = idSchema.parse(form.get('sampleId')), rawFiring = form.get('firingId');
      const firingId = rawFiring ? idSchema.parse(rawFiring) : null;
      return await repository.upload(sampleId, firingId, file, String(form.get('caption') || '')) as T;
    }
    const match = /^\/api\/(?:samples|visits)\/([^/]+)(?:\/(.*))?$/.exec(url);
    if (!match) throw new Error('Operación no disponible.');
    const id = idSchema.parse(match[1]), route = match[2] ? match[2].split('/') : [];
    const sample = await repository.mutate(id, route, method, payload);
    return (route[0] === 'firings' ? { sample } : sample || { ok: true }) as T;
  } catch (error) { throw friendlyError(error); }
}
