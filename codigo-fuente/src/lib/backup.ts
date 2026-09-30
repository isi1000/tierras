import { z } from 'zod';
import { cleanSample, idSchema, sampleSchema, validateImage, type Backup } from './schema';

export async function encodeBlob(blob: Blob): Promise<string> {
  const data = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (let i = 0; i < data.length; i += 32768) binary += String.fromCharCode(...data.subarray(i, i + 32768));
  return `data:${blob.type};base64,${btoa(binary)}`;
}
export async function decodeBackup(value: unknown): Promise<{ backup: Backup; blobs: Map<string, Blob> }> {
  const backup = z.object({ app: z.literal('Tierras'), version: z.literal(1), exportedAt: z.string().datetime(),
    samples: z.array(sampleSchema).max(10000),
    photos: z.array(z.object({ id: idSchema, dataUrl: z.string().max(12 * 1024 * 1024) })).max(100000) }).parse(value);
  const sampleIds = new Set(backup.samples.map(s => s.id));
  const referenced = backup.samples.flatMap(s => s.photos.map(p => p.id));
  const photoIds = new Set(backup.photos.map(p => p.id));
  if (sampleIds.size !== backup.samples.length || new Set(referenced).size !== referenced.length || photoIds.size !== backup.photos.length ||
      referenced.length !== photoIds.size || referenced.some(id => !photoIds.has(id))) throw new Error('La copia está incompleta o contiene fotos duplicadas.');
  const blobs = new Map<string, Blob>();
  for (const photo of backup.photos) {
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]*={0,2})$/.exec(photo.dataUrl);
    if (!match) throw new Error('La copia contiene una fotografía que no es válida.');
    const binary = atob(match[2]);
    const blob = new Blob([Uint8Array.from(binary, c => c.charCodeAt(0))], { type: match[1] });
    await validateImage(blob);
    blobs.set(photo.id, blob);
  }
  return { backup: { ...backup, samples: backup.samples.map(cleanSample) }, blobs };
}
