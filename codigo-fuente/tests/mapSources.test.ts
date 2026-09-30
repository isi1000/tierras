import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { filterBdminPoints, lookupBdmin, lookupSoil, parseBdminPoints, parseSoilCollections, parseSoilEstimates } from '../src/lib/mapSources.ts';

const soilFeature = (id: string, pixel_value: unknown, unit = 'g/kg') => ({ type: 'Feature', id, properties: { pixel_value, unit } });
const collection = (features: unknown[]) => ({ type: 'FeatureCollection', features });
const inventory = (id: number, substance = 'Arcilla') => ({ attributes: { ESRI_OID: id, Codigo_roca: '1234567', Sustancia: substance, Municipio: 'Municipio de prueba', Provincia: 'Ciudad Real', Estado_Explotacion: 'Activo', Usos: 'Cerámica' }, geometry: { x: -3.8, y: 39.018 } });

test('valores y cuantiles reales de SoilGrids se convierten de g/kg a porcentaje sin mezclarlos', async () => {
  // Respuestas públicas WMS del 30-09-2026, 39.018 / -3.8, 15–30 cm.
  const documents = await Promise.all(['mean', 'Q0.05', 'Q0.95'].map(stat => readFile(new URL(`./fixtures/soil-${stat}.json`, import.meta.url), 'utf8')));
  assert.deepEqual(parseSoilEstimates(parseSoilCollections(documents.join('\n')), 'clay', '15-30cm'), { property: 'clay', mean: 29.7, low: 7.8, high: 77.1 });
  assert.throws(() => parseSoilCollections(documents[0].trim().slice(0, -15)), /incompleta|válida/);
});

test('ausencia, error de unidad y datos de otra profundidad no se presentan como porcentajes válidos', () => {
  assert.deepEqual(parseSoilEstimates(collection([soilFeature('clay_15-30cm_mean', -9999)]), 'clay', '15-30cm'), { property: 'clay', mean: null, low: null, high: null });
  assert.equal(parseSoilEstimates(collection([soilFeature('clay_0-5cm_mean', 297)]), 'clay', '15-30cm').mean, null);
  assert.throws(() => parseSoilEstimates(collection([soilFeature('clay_15-30cm_mean', 297, 'mg/kg')]), 'clay', '15-30cm'), /unidad/);
  assert.throws(() => parseSoilCollections('<ServiceException>error</ServiceException>'), /válida/);
});

test('la consulta WMS separa media y cuantiles y pide solo el píxel central', async t => {
  const requests: URL[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const request = new URL(url); requests.push(request);
    const id = request.searchParams.get('LAYERS')!;
    return new Response(JSON.stringify(collection([soilFeature(id, id.endsWith('mean') ? 297 : id.endsWith('Q0.05') ? 78 : 771)])));
  });
  assert.deepEqual(await lookupSoil({ lat: 39.018, lng: -3.8 }, 'clay', '15-30cm', undefined, true), { property: 'clay', mean: 29.7, low: 7.8, high: 77.1 });
  assert.equal(requests.length, 3);
  for (const request of requests) {
    assert.equal(request.searchParams.get('QUERY_LAYERS'), request.searchParams.get('LAYERS'));
    assert.equal(request.searchParams.get('FEATURE_COUNT'), '1');
    assert.equal(request.searchParams.get('SRS'), 'EPSG:3857');
    assert.equal(request.searchParams.get('X'), '50');
    assert.ok(!request.searchParams.get('LAYERS')!.includes(','));
  }
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(collection([soilFeature('clay_15-30cm_Q0.95', 771)]))));
  await assert.rejects(() => lookupSoil({ lat: 39.018, lng: -3.8 }, 'clay', '15-30cm'), /otra capa/);
});

test('BDMIN agrupa fichas coincidentes, conserva su número y filtra materiales con acentos', () => {
  const points = parseBdminPoints([inventory(1), inventory(2), inventory(3, 'Caolín'), inventory(4, 'Sílice'), { ...inventory(5), geometry: { x: NaN, y: 39 } }]);
  assert.equal(points.length, 3);
  assert.equal(points[0].records, 2);
  assert.deepEqual(filterBdminPoints(points, 'clay').map(point => point.substance), ['Arcilla', 'Caolín']);
  assert.deepEqual(filterBdminPoints(points, 'silica').map(point => point.substance), ['Sílice']);
});

test('BDMIN consulta las páginas restantes y distingue el error de servicio de una zona vacía', async t => {
  const offsets: string[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    const request = new URL(url), offset = request.searchParams.get('resultOffset')!; offsets.push(offset);
    assert.equal(request.searchParams.get('outSR'), '4326');
    return new Response(JSON.stringify({ features: [inventory(Number(offset) + 1, offset === '0' ? 'Arcilla' : 'Caolín')], exceededTransferLimit: offset === '0' }));
  });
  const result = await lookupBdmin({ west: -4, south: 38, east: -3, north: 40 });
  assert.deepEqual(offsets, ['0', '500']); assert.equal(result.points.length, 2); assert.equal(result.truncated, false);
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: { code: 500, message: 'error' } })));
  await assert.rejects(() => lookupBdmin({ west: -4, south: 38, east: -3, north: 40 }), /BDMIN/);
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => lookupBdmin({ west: -4, south: 38, east: -3, north: 40 }, controller.signal), { name: 'AbortError' });
});
