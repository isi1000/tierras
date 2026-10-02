import { isVisit } from './types';
import { supabase } from './config';
import { addPhoto, cleanRecord, editRecord, idSchema, validateImage, type Repository, type Sample, type NotebookRecord, type Backup } from './schema';
import { decodeBackup, encodeBlob } from './backup';

const TABLE = 'tierras_samples', BUCKET = 'tierras-photos';
type Row = { id: string; owner_id: string; data: unknown; revision: number };
export class CloudRepository implements Repository {
  private client() { if (!supabase) throw new Error('El cuaderno en la nube no está configurado.'); return supabase; }
  private async owner(): Promise<string> {
    const { data, error } = await this.client().auth.getSession();
    if (error || !data.session) throw new Error('Inicia sesión para abrir tu cuaderno.');
    return data.session.user.id;
  }
  private async row(id: string, owner: string): Promise<Row> {
    idSchema.parse(id);
    const { data, error } = await this.client().from(TABLE).select('id, owner_id, data, revision').eq('id', id).eq('owner_id', owner).maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('No se encontró esa muestra.');
    return data as Row;
  }
  private async hydrate<T extends NotebookRecord>(sample: T): Promise<T> {
    const result = cleanRecord(sample) as T, paths = result.photos.flatMap(photo => photo.objectKey ? [photo.objectKey] : []);
    if (paths.length) {
      const { data, error } = await this.client().storage.from(BUCKET).createSignedUrls(paths, 3600);
      if (error) throw error;
      for (const photo of result.photos) photo.url = data?.find(item => item.path === photo.objectKey)?.signedUrl || undefined;
    }
    return result;
  }
  private async persist(row: Row, sample: NotebookRecord): Promise<void> {
    const { data, error } = await this.client().from(TABLE).update({ data: cleanRecord(sample) })
      .eq('id', row.id).eq('owner_id', row.owner_id).eq('revision', row.revision).select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('La ficha cambió en otra pestaña o dispositivo. Recarga el cuaderno antes de guardar otra vez.');
  }
  private async update(row: Row, sample: NotebookRecord): Promise<NotebookRecord> {
    await this.persist(row, sample);
    return this.hydrate(sample);
  }
  async list(): Promise<NotebookRecord[]> {
    const owner = await this.owner(), rows: Row[] = [];
    for (let start = 0; ; start += 250) {
      const { data, error } = await this.client().from(TABLE).select('id, owner_id, data, revision').eq('owner_id', owner)
        .order('updated_at', { ascending: false }).order('id').range(start, start + 249);
      if (error) throw error;
      rows.push(...data as Row[]);
      if (data.length < 250) break;
    }
    return Promise.all(rows.map(row => this.hydrate(cleanRecord(row.data))));
  }
  async create(sample: NotebookRecord): Promise<NotebookRecord> {
    const owner = await this.owner(), data = cleanRecord(sample);
    const result = await this.client().from(TABLE).insert({ id: data.id, owner_id: owner, data });
    if (result.error) throw result.error;
    return this.hydrate(data);
  }
  async mutate(id: string, route: string[], method: string, value: unknown): Promise<NotebookRecord | null> {
    const owner = await this.owner(), row = await this.row(id, owner), previous = cleanRecord(row.data);
    const next = editRecord(previous, route, method, value);
    if (next) return this.update(row, next);
    const paths = previous.photos.flatMap(p => p.objectKey ? [p.objectKey] : []);
    // Retirar primero la ficha con revisión evita eliminar una edición concurrente.
    const removed = await this.client().from(TABLE).delete().eq('id', id).eq('owner_id', owner).eq('revision', row.revision).select('id').maybeSingle();
    if (removed.error) throw removed.error;
    if (!removed.data) throw new Error('La ficha cambió en otro dispositivo. Recarga antes de eliminarla.');
    if (paths.length) {
      const cleanup = await this.client().storage.from(BUCKET).remove(paths);
      if (cleanup.error) console.warn('La ficha se eliminó; quedan archivos de esta muestra pendientes de limpiar en Storage.');
    }
    return null;
  }
  async upload(sampleId: string, firingId: string | null, blob: Blob, caption = ''): Promise<Sample> {
    await validateImage(blob);
    const owner = await this.owner(), row = await this.row(sampleId, owner), sample = cleanRecord(row.data);
    if (isVisit(sample)) throw new Error('Registra una muestra recogida antes de añadir fotos de cocción.');
    const photo = addPhoto(sample, firingId, caption), extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    photo.objectKey = `${owner}/${sampleId}/${photo.id}.${extension}`;
    const result = await this.client().storage.from(BUCKET).upload(photo.objectKey, blob, { contentType: blob.type, upsert: false });
    if (result.error) throw result.error;
    sample.photos.push(photo); sample.updatedAt = new Date().toISOString();
    try { await this.persist(row, sample); }
    catch (error) { await this.client().storage.from(BUCKET).remove([photo.objectKey]); throw error; }
    return this.hydrate(sample);
  }
  async exportBackup(): Promise<Backup> {
    const records = (await this.list()).map(cleanRecord), samples = records.filter((record): record is Sample => !isVisit(record)), visits = records.filter(isVisit), photos: Backup['photos'] = [];
    for (const photo of samples.flatMap(s => s.photos)) {
      if (!photo.objectKey) throw new Error('Falta el archivo de una foto. No se creó una copia incompleta.');
      const { data, error } = await this.client().storage.from(BUCKET).download(photo.objectKey);
      if (error) throw error;
      photos.push({ id: photo.id, dataUrl: await encodeBlob(data) });
    }
    return { app: 'Tierras', version: 2, exportedAt: new Date().toISOString(), samples, visits, photos };
  }
  async importBackup(value: unknown): Promise<{ imported: number; skipped: number }> {
    const { backup, blobs } = await decodeBackup(value), owner = await this.owner();
    let imported = 0, skipped = 0;
    for (const original of [...backup.samples, ...backup.visits]) {
      const check = await this.client().from(TABLE).select('id').eq('owner_id', owner)
        .or(`id.eq.${original.id},origin_id.eq.${original.id}`).maybeSingle();
      if (check.error) throw check.error;
      if (check.data) { skipped++; continue; }
      const sample = cleanRecord(original), paths: string[] = [];
      // IDs nuevos permiten restaurar una copia de otra cuenta sin colisiones.
      const oldPhotos = sample.photos; sample.photos = []; sample.id = crypto.randomUUID();
      for (const firing of sample.firings) firing.sampleId = sample.id;
      let inserted = false;
      try {
        const created = await this.client().from(TABLE).insert({ id: sample.id, owner_id: owner, origin_id: original.id, data: cleanRecord(sample) });
        if (created.error) throw created.error;
        inserted = true;
        if (isVisit(sample)) { imported++; continue; }
        for (const originalPhoto of oldPhotos) {
          const photo = { ...originalPhoto, sampleId: sample.id }, blob = blobs.get(photo.id)!;
          const extension = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
          photo.objectKey = `${owner}/${sample.id}/${photo.id}.${extension}`;
          const uploaded = await this.client().storage.from(BUCKET).upload(photo.objectKey, blob, { contentType: blob.type, upsert: false });
          if (uploaded.error) throw uploaded.error;
          paths.push(photo.objectKey); sample.photos.push(photo);
        }
        await this.update(await this.row(sample.id, owner), sample); imported++;
      } catch (error) {
        if (paths.length) await this.client().storage.from(BUCKET).remove(paths);
        if (inserted) await this.client().from(TABLE).delete().eq('id', sample.id).eq('owner_id', owner);
        throw new Error(`Se importaron ${imported} fichas antes del error. Conserva la copia original. ${error instanceof Error ? error.message : 'Revisa la conexión.'}`);
      }
    }
    return { imported, skipped };
  }
}
