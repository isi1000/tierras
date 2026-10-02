import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { FEATURED_SITES } from '../src/lib/featuredSites.ts';
import { parseHeritage, lookupHeritageCode } from '../src/lib/fieldSites.ts';
const fixtures = JSON.parse(await readFile(new URL('./fixtures/featured-ielig.json', import.meta.url), 'utf8'));
test('los once destacados corresponden a fichas públicas reales, incluidos los puntos antiguos', () => {
  assert.equal(FEATURED_SITES.length, 11);
  for (const featured of FEATURED_SITES) {
    const data = fixtures[featured.code]; const sites = parseHeritage([...data['0'].features,...data['1'].features]);
    assert.equal(sites.length,1); assert.equal(sites[0].code,featured.code); assert.ok(Number.isFinite(sites[0].lat));
  }
  assert.equal(fixtures.TMs104['0'].features.length,0); assert.equal(fixtures.TMs104['1'].features.length,1);
});
test('consulta por código busca polígonos y puntos sin perder El Chorrillo', async () => {
  const original = globalThis.fetch, calls: string[] = [];
  globalThis.fetch = async input => {
    const url = new URL(String(input)), layer = url.pathname.includes('/1/') ? '1' : '0'; calls.push(url.searchParams.get('where')!);
    return new Response(JSON.stringify(fixtures.TMs104[layer]),{headers:{'Content-Type':'application/json'}});
  };
  try { const site = await lookupHeritageCode('TMs104'); assert.equal(site.code,'TMs104'); assert.ok(calls.includes("CODIGO='TMs104'")); assert.ok(calls.includes("Codigo='TMs104'")); await assert.rejects(()=>lookupHeritageCode("x' OR 1=1")); }
  finally { globalThis.fetch = original; }
});
