import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalRepository } from '../src/lib/local.ts';
import { makeSample, cleanSample } from '../src/lib/schema.ts';

const create = () => makeSample({ name: 'Tierra roja de Daimiel', collectedDate: '2026-09-29', lat: 39.06, lng: -3.61, notes: 'Decantar', description: 'Fina' });
const firing = { date: '2026-09-30', temperature: 980, atmosphere: 'Oxidante', holdMinutes: 20, color: 'Rojo teja', shrinkage: 6, absorption: 12, description: 'Sin grietas', notes: 'Primera prueba' };
const jpeg = new Blob([new Uint8Array([255, 216, 255, 224, 0, 0, 0, 0])], { type: 'image/jpeg' });
const repo = () => new LocalRepository('test-' + crypto.randomUUID());

test('recoger, editar, cocer y consultar después de reabrir el cuaderno', async () => {
  const name = 'test-' + crypto.randomUUID(), first = new LocalRepository(name), sample = create();
  await first.create(sample);
  await first.mutate(sample.id, [], 'PATCH', { notes: 'Nota guardada', name: 'Arcilla roja' });
  const cooked = await first.mutate(sample.id, ['firings'], 'POST', firing);
  assert.equal(cooked!.firings.length, 1);
  await first.mutate(sample.id, ['firings', cooked!.firings[0].id], 'PATCH', { ...firing, temperature: 1040 });
  const reopened = await new LocalRepository(name).list();
  assert.equal(reopened.length, 1); assert.equal(reopened[0].notes, 'Nota guardada');
  assert.equal(reopened[0].firings[0].temperature, 1040);
});
test('fotos en crudo y de cocción; exportación, restauración y aislamiento de otro dispositivo', async () => {
  const a = repo(), b = repo(), sample = create();
  await a.create(sample);
  const cooked = await a.mutate(sample.id, ['firings'], 'POST', firing);
  await a.upload(sample.id, null, jpeg);
  await a.upload(sample.id, cooked!.firings[0].id, jpeg);
  assert.equal((await b.list()).length, 0);
  const backup = await a.exportBackup();
  assert.equal(backup.photos.length, 2); assert.ok(!JSON.stringify(backup).includes('blob:'));
  assert.deepEqual(await b.importBackup(backup), { imported: 1, skipped: 0 });
  assert.deepEqual(await b.importBackup(backup), { imported: 0, skipped: 1 });
  const restored = (await b.list())[0];
  assert.equal(restored.photos.length, 2); assert.equal(restored.firings.length, 1);
  assert.ok(restored.photos[0].url?.startsWith('blob:'));
  const result = await fetch(restored.photos[1].url!);
  assert.deepEqual(new Uint8Array(await result.arrayBuffer()), new Uint8Array(await jpeg.arrayBuffer()));
});
test('una copia corrupta no modifica el cuaderno ni pierde sus fotos', async () => {
  const a = repo(), sample = create(); await a.create(sample); await a.upload(sample.id, null, jpeg);
  const backup = await a.exportBackup(), b = repo();
  await assert.rejects(() => b.importBackup({ ...backup, photos: [] }));
  assert.equal((await b.list()).length, 0);
  const corrupted = structuredClone(backup); corrupted.photos[0].dataUrl = 'data:image/jpeg;base64,aG9sYQ==';
  await assert.rejects(() => b.importBackup(corrupted)); assert.equal((await b.list()).length, 0);
  await assert.rejects(() => a.upload(sample.id, crypto.randomUUID(), jpeg));
  assert.equal((await a.list())[0].photos.length, 1);
});
test('eliminar una ficha retira sus fotos y conserva las imágenes de las demás', async () => {
  const a = repo(), first = create(), second = create();
  await a.create(first); await a.create(second); await a.upload(first.id, null, jpeg); await a.upload(second.id, null, jpeg);
  const before = await a.list(), secondUrl = before.find(s => s.id === second.id)!.photos[0].url!;
  await a.mutate(first.id, [], 'DELETE');
  assert.equal((await a.list()).length, 1); assert.equal((await a.exportBackup()).photos.length, 1);
  assert.equal((await fetch(secondUrl)).status, 200);
});
test('fechas, temperaturas y referencias inválidas no se guardan', async () => {
  assert.throws(() => makeSample({ name: 'Error', collectedDate: '2026-02-30', lat: 39, lng: -3 }));
  const a = repo(), sample = create(); await a.create(sample);
  await assert.rejects(() => a.mutate(sample.id, ['firings'], 'POST', { ...firing, temperature: -50 }));
  assert.equal((await a.list())[0].firings.length, 0);
  const bad = structuredClone(sample); bad.firings.push({ ...firing, id: crypto.randomUUID(), sampleId: crypto.randomUUID(), createdAt: new Date().toISOString() });
  assert.throws(() => cleanSample(bad));
});
test('consultar MAGNA sin respuesta no sobrescribe una litología guardada', async () => {
  const a = repo(), sample = create(); sample.geology.status = 'ok'; sample.geology.lithology = 'Arcillas y margas'; await a.create(sample);
  await assert.rejects(() => a.mutate(sample.id, ['geology'], 'POST', { geologySnapshot: { lat: sample.lat, lng: sample.lng, geology: { ...sample.geology, status: 'unavailable' } } }));
  assert.equal((await a.list())[0].geology.lithology, 'Arcillas y margas');
});
