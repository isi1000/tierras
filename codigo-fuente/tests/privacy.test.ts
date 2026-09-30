import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeSample } from '../src/lib/schema.ts';

test('PostgreSQL: cuentas, fotos privadas, revisiones e importaciones', async t => {
  const db = new PGlite(), a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
  const sql = await readFile(new URL('../../supabase.sql', import.meta.url), 'utf8');
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text);
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select (string_to_array(name,'/'))[1:array_length(string_to_array(name,'/'),1)-1] $$;
    alter table storage.objects enable row level security;
    grant usage on schema public, auth, storage to anon, authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
    insert into auth.users values ('${a}'),('${b}');
  `);
  await db.exec(sql);
  const sampleA = makeSample({ name: 'Muestra A', collectedDate: '2026-09-29', lat: 39, lng: -3 });
  const sampleB = makeSample({ name: 'Muestra B', collectedDate: '2026-09-29', lat: 39.1, lng: -3.1 });
  async function role(user: string | null, run: () => Promise<void>) {
    await db.exec(`set role ${user ? 'authenticated' : 'anon'};`);
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user || '']);
    try { await run(); } finally { await db.exec('reset role;'); }
  }
  await t.test('cada cuenta crea su propia ficha', async () => {
    await role(a, async () => { await db.query('insert into public.tierras_samples (id,owner_id,data) values ($1,$2,$3)', [sampleA.id,a,sampleA]); });
    await role(b, async () => { await db.query('insert into public.tierras_samples (id,owner_id,data) values ($1,$2,$3)', [sampleB.id,b,sampleB]); });
  });
  await t.test('leer sin filtro sigue devolviendo solo las fichas propias', async () => {
    await role(b, async () => {
      const data = await db.query<{ id: string }>('select id from public.tierras_samples'); assert.deepEqual(data.rows.map(r => r.id), [sampleB.id]);
      assert.equal((await db.query('select * from public.tierras_samples where id=$1', [sampleA.id])).rows.length, 0);
    });
  });
  await t.test('otra cuenta no puede modificar, borrar ni suplantar al dueño', async () => {
    await role(b, async () => {
      assert.equal((await db.query('delete from public.tierras_samples where id=$1 returning id', [sampleA.id])).rows.length, 0);
      assert.equal((await db.query("update public.tierras_samples set data=jsonb_set(data,'{notes}','\"Intrusión\"') where id=$1 returning id", [sampleA.id])).rows.length, 0);
      const other = makeSample({ name: 'Falsa', collectedDate: '2026-09-29', lat: 39, lng: -3 });
      await assert.rejects(() => db.query('insert into public.tierras_samples (id,owner_id,data) values ($1,$2,$3)', [other.id,a,other]));
    });
  });
  await t.test('un visitante sin sesión no puede leer ni escribir cuadernos', async () => {
    await role(null, async () => {
      await assert.rejects(() => db.query('select * from public.tierras_samples'));
      await assert.rejects(() => db.query('delete from public.tierras_samples'));
    });
  });
  await t.test('fotos privadas y carpeta vinculada a una ficha propia', async () => {
    await role(a, async () => { await db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['tierras-photos',`${a}/${sampleA.id}/foto.jpg`]); });
    await role(b, async () => {
      assert.equal((await db.query('select * from storage.objects')).rows.length, 0);
      await assert.rejects(() => db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['tierras-photos',`${a}/${sampleA.id}/falsa.jpg`]));
      await assert.rejects(() => db.query('insert into storage.objects(bucket_id,name) values ($1,$2)', ['tierras-photos',`${b}/${sampleA.id}/falsa.jpg`]));
      assert.equal((await db.query('delete from storage.objects returning id')).rows.length, 0);
    });
    const bucket = await db.query<{ public: boolean }>("select public from storage.buckets where id='tierras-photos'"); assert.equal(bucket.rows[0].public, false);
  });
  await t.test('la revisión rechaza un guardado concurrente y el dueño no cambia', async () => {
    await role(a, async () => {
      const next = { ...sampleA, notes: 'Guardada' };
      assert.equal((await db.query('update public.tierras_samples set data=$1 where id=$2 and revision=0 returning revision', [next,sampleA.id])).rows.length, 1);
      assert.equal((await db.query('update public.tierras_samples set data=$1 where id=$2 and revision=0 returning revision', [sampleA,sampleA.id])).rows.length, 0);
      await assert.rejects(() => db.query('update public.tierras_samples set owner_id=$1 where id=$2', [b,sampleA.id]));
      const result = await db.query<{ revision: number; data: { notes: string } }>('select revision,data from public.tierras_samples where id=$1', [sampleA.id]);
      assert.equal(Number(result.rows[0].revision),1); assert.equal(result.rows[0].data.notes,'Guardada');
    });
  });
  await t.test('una misma copia no puede crear dos importaciones en una cuenta', async () => {
    await role(a, async () => {
      const first = makeSample({ name: 'Restaurada', collectedDate: '2026-09-29', lat: 39, lng: -3 }), origin = crypto.randomUUID();
      await db.query('insert into public.tierras_samples(id,owner_id,origin_id,data) values($1,$2,$3,$4)', [first.id,a,origin,first]);
      const second = { ...first, id: crypto.randomUUID() };
      await assert.rejects(() => db.query('insert into public.tierras_samples(id,owner_id,origin_id,data) values($1,$2,$3,$4)', [second.id,a,origin,second]));
    });
  });
  await t.test('volver a ejecutar el SQL conserva los datos y las restricciones', async () => {
    await db.exec(sql);
    await role(b, async () => { assert.equal((await db.query('select * from public.tierras_samples')).rows.length,1); });
    await role(null, async () => { await assert.rejects(() => db.query('select * from public.tierras_samples')); });
  });
  await db.close();
});
