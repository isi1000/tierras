import 'fake-indexeddb/auto';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LocalRepository } from '../src/lib/local.ts';
import { makeVisit, makeSample } from '../src/lib/schema.ts';
import { parseHeritage, parseProtection, PROTECTION_SOURCES, HIGUERUELA_DOCUMENTS } from '../src/lib/fieldSites.ts';

test('visitas: persistencia, edición, separación de muestras, copia e importación antigua', async () => {
  const name = 'visits-' + crypto.randomUUID(), a = new LocalRepository(name), b = new LocalRepository('visits-' + crypto.randomUUID());
  const visit = makeVisit({ name: 'Higueruela', lat: 38.85, lng: -4, notes: 'Mirar afloramiento', plannedDate: '2026-10-12', sourceUrl: 'https://info.igme.es/ielig/' });
  await a.create(visit);
  assert.equal((await new LocalRepository(name).list())[0].kind, 'visit');
  await a.mutate(visit.id, [], 'PATCH', { visitStatus: 'visited', notes: 'Visitada, sin recoger' });
  const backup = await a.exportBackup();
  assert.equal(backup.version, 2); assert.equal(backup.samples.length, 0); assert.equal(backup.visits.length, 1);
  assert.equal(backup.visits[0].visitStatus, 'visited');
  assert.equal((await b.list()).length, 0);
  assert.deepEqual(await b.importBackup(backup), { imported: 1, skipped: 0 });
  assert.deepEqual(await b.importBackup(backup), { imported: 0, skipped: 1 });
  const sample = makeSample({ name: 'Antigua', lat: 39, lng: -3, collectedDate: '2026-09-29' });
  assert.deepEqual(await b.importBackup({ app: 'Tierras', version: 1, exportedAt: new Date().toISOString(), samples: [sample], photos: [] }), { imported: 1, skipped: 0 });
  const bad = structuredClone(backup); bad.visits[0].sourceUrl = 'javascript:alert(1)';
  await assert.rejects(() => b.importBackup(bad));
  assert.equal((await b.list()).length, 2);
  await b.mutate(visit.id, [], 'DELETE');
  assert.equal((await b.exportBackup()).visits.length, 0);
  assert.equal((await b.exportBackup()).samples.length, 1);
  assert.throws(() => makeVisit({ name: 'Error', lat: 39, lng: -3, plannedDate: '2026-02-30' }));
});
test('IELIG: solo localizaciones públicas, geometrías válidas y puntos/polígonos fusionados', () => {
  const attributes = { CODIGO: 'TM142', Denominacion: 'Higueruela', Confidencialidad: 'Público' };
  const polygon = { attributes, geometry: { rings: [[[-4,38],[-3,38],[-3,39],[-4,38]]] } };
  const point = { attributes, geometry: { x: -3.8, y: 38.2 } };
  const sites = parseHeritage([polygon, point, { ...point, attributes: { ...attributes, CODIGO: 'SECRET', Confidencialidad: 'Reservado' } }]);
  assert.equal(sites.length, 1); assert.equal(sites[0].referenceOnly, false); assert.equal(sites[0].rings.length, 1);
  assert.equal(sites[0].lng, -3.8); assert.equal(parseHeritage([polygon])[0].referenceOnly, true);
  assert.equal(HIGUERUELA_DOCUMENTS.length, 3); assert.match(HIGUERUELA_DOCUMENTS[0].url, /\.pdf$/);
});
test('protección: identifica fuente y descarta enlaces ejecutables', () => {
  const records = parseProtection([{ attributes: { SITE_NAME: 'Tablas de Daimiel', SITE_CODE: 'ES0000013', TIPO_1: 'ZEC', URL: 'javascript:alert(1)' } }], PROTECTION_SOURCES[1]);
  assert.equal(records[0].name, 'Tablas de Daimiel'); assert.equal(records[0].source, 'Red Natura 2000'); assert.equal(records[0].url, null);
});
