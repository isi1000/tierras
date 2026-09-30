import { addPhoto, cleanSample, editSample, idSchema, validateImage, type Repository, type Sample, type Backup } from './schema';
import { decodeBackup, encodeBlob } from './backup';

type StoredPhoto = { id: string; sampleId: string; blob: Blob };
function requested<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
export class LocalRepository implements Repository {
  private database?: Promise<IDBDatabase>;
  private urls = new Map<string, string>();
  constructor(private name: string) {}
  private open(): Promise<IDBDatabase> {
    if (!this.database) this.database = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') { reject(new Error('Este navegador no permite guardar el cuaderno. Abre la web en Safari o Chrome.')); return; }
      const request = indexedDB.open(this.name, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        db.createObjectStore('samples', { keyPath: 'id' });
        db.createObjectStore('photos', { keyPath: 'id' }).createIndex('sampleId', 'sampleId');
      };
      request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result); };
      request.onerror = () => { this.database = undefined; reject(request.error); };
      request.onblocked = () => reject(new Error('Cierra otras pestañas de Tierras y vuelve a intentarlo.'));
    });
    return this.database;
  }
  private async all<T>(store: string): Promise<T[]> {
    const db = await this.open();
    return requested(db.transaction(store).objectStore(store).getAll()) as Promise<T[]>;
  }
  private async hydrate(sample: Sample): Promise<Sample> {
    const next = cleanSample(sample), db = await this.open();
    for (const photo of next.photos) {
      if (!this.urls.has(photo.id)) {
        const record = await requested(db.transaction('photos').objectStore('photos').get(photo.id)) as StoredPhoto | undefined;
        if (record) this.urls.set(photo.id, URL.createObjectURL(record.blob));
      }
      photo.url = this.urls.get(photo.id);
    }
    return next;
  }
  async list(): Promise<Sample[]> {
    const samples = await this.all<Sample>('samples');
    samples.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return Promise.all(samples.map(sample => this.hydrate(sample)));
  }
  async create(sample: Sample): Promise<Sample> {
    const data = cleanSample(sample), db = await this.open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('samples', 'readwrite');
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(tx.error || new Error('No se pudo guardar.'));
      tx.objectStore('samples').add(data);
    });
    return this.hydrate(data);
  }
  private async change(id: string, change: (sample: Sample, tx: IDBTransaction) => Sample | null): Promise<Sample | null> {
    idSchema.parse(id); const db = await this.open();
    const deletedPhotoIds: string[] = [];
    const result = await new Promise<Sample | null>((resolve, reject) => {
      const tx = db.transaction(['samples', 'photos'], 'readwrite'), store = tx.objectStore('samples');
      let result: Sample | null = null, error: unknown;
      tx.oncomplete = () => resolve(result); tx.onerror = tx.onabort = () => reject(error || tx.error || new Error('No se pudo guardar.'));
      const read = store.get(id);
      read.onsuccess = () => {
        try {
          if (!read.result) throw new Error('No se encontró esa muestra.');
          const previous = cleanSample(read.result);
          result = change(previous, tx);
          if (result) store.put(cleanSample(result));
          else {
            deletedPhotoIds.push(...previous.photos.map(photo => photo.id));
            store.delete(id);
            const photos = tx.objectStore('photos'), keys = photos.index('sampleId').getAllKeys(id);
            keys.onsuccess = () => { for (const key of keys.result) photos.delete(key); };
          }
        } catch (e) { error = e; tx.abort(); }
      };
    });
    if (!result) {
      for (const key of deletedPhotoIds) {
        const url = this.urls.get(key); if (url) URL.revokeObjectURL(url); this.urls.delete(key);
      }
      return null;
    }
    return this.hydrate(result);
  }
  async mutate(id: string, route: string[], method: string, value: unknown): Promise<Sample | null> {
    return this.change(id, sample => editSample(sample, route, method, value));
  }
  async upload(sampleId: string, firingId: string | null, blob: Blob, caption = ''): Promise<Sample> {
    await validateImage(blob);
    const result = await this.change(sampleId, (sample, tx) => {
      const photo = addPhoto(sample, firingId, caption);
      tx.objectStore('photos').add({ id: photo.id, sampleId, blob });
      sample.photos.push(photo); sample.updatedAt = new Date().toISOString();
      return cleanSample(sample);
    });
    return result!;
  }
  async exportBackup(): Promise<Backup> {
    const [samples, photos] = await Promise.all([this.all<Sample>('samples'), this.all<StoredPhoto>('photos')]);
    const referenced = new Set(samples.flatMap(s => s.photos.map(p => p.id)));
    return { app: 'Tierras', version: 1, exportedAt: new Date().toISOString(), samples: samples.map(cleanSample),
      photos: await Promise.all(photos.filter(p => referenced.has(p.id)).map(async photo => ({ id: photo.id, dataUrl: await encodeBlob(photo.blob) }))) };
  }
  async importBackup(value: unknown): Promise<{ imported: number; skipped: number }> {
    // Se valida toda la copia antes de empezar una única transacción.
    const { backup, blobs } = await decodeBackup(value), db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['samples', 'photos'], 'readwrite'), samples = tx.objectStore('samples'), photos = tx.objectStore('photos');
      let imported = 0, skipped = 0, error: unknown;
      tx.oncomplete = () => resolve({ imported, skipped }); tx.onerror = tx.onabort = () => reject(error || tx.error);
      for (const sample of backup.samples) {
        const request = samples.get(sample.id);
        request.onsuccess = () => {
          try {
            if (request.result) { skipped++; return; }
            samples.add(cleanSample(sample));
            for (const photo of sample.photos) photos.add({ id: photo.id, sampleId: sample.id, blob: blobs.get(photo.id)! });
            imported++;
          } catch (e) { error = e; tx.abort(); }
        };
      }
    });
  }
}
