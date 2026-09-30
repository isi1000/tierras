-- TIERRAS · Ejecutar una vez en SQL Editor de un proyecto Supabase nuevo.
-- Repetir este script conserva las fichas existentes y renueva solo estas políticas.
begin;

create table if not exists public.tierras_samples (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  origin_id uuid,
  data jsonb not null,
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tierras_document check (
    jsonb_typeof(data) = 'object'
    and data ?& array['id','name','collectedDate','lat','lng','description','notes','geology','createdAt','updatedAt','photos','firings']
    and data->>'id' = id::text
    and jsonb_typeof(data->'photos') = 'array'
    and jsonb_typeof(data->'firings') = 'array'
    and jsonb_array_length(data->'photos') <= 60
    and jsonb_array_length(data->'firings') <= 500
    and char_length(data->>'name') between 1 and 120
    and char_length(data->>'notes') <= 20000
  )
);
create index if not exists tierras_owner_updated on public.tierras_samples (owner_id, updated_at desc);
create unique index if not exists tierras_import_origin on public.tierras_samples (owner_id, origin_id) where origin_id is not null;

create or replace function public.tierras_document_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id <> old.id or new.owner_id <> old.owner_id then
    raise exception 'No se puede cambiar el propietario o el identificador de una ficha.';
  end if;
  new.revision := old.revision + 1;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists tierras_document_revision on public.tierras_samples;
create trigger tierras_document_revision before update on public.tierras_samples
  for each row execute function public.tierras_document_revision();

alter table public.tierras_samples enable row level security;
revoke all on public.tierras_samples from anon, authenticated;
grant select, insert, update, delete on public.tierras_samples to authenticated;
drop policy if exists tierras_select_own on public.tierras_samples;
drop policy if exists tierras_insert_own on public.tierras_samples;
drop policy if exists tierras_update_own on public.tierras_samples;
drop policy if exists tierras_delete_own on public.tierras_samples;
create policy tierras_select_own on public.tierras_samples for select to authenticated
  using ((select auth.uid()) = owner_id);
create policy tierras_insert_own on public.tierras_samples for insert to authenticated
  with check ((select auth.uid()) = owner_id);
create policy tierras_update_own on public.tierras_samples for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy tierras_delete_own on public.tierras_samples for delete to authenticated
  using ((select auth.uid()) = owner_id);

-- Las fotos están en un bucket privado: usuario / muestra / foto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tierras-photos', 'tierras-photos', false, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists tierras_photo_read on storage.objects;
drop policy if exists tierras_photo_add on storage.objects;
drop policy if exists tierras_photo_delete on storage.objects;
create policy tierras_photo_read on storage.objects for select to authenticated
  using (bucket_id = 'tierras-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy tierras_photo_add on storage.objects for insert to authenticated
  with check (bucket_id = 'tierras-photos' and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (select 1 from public.tierras_samples s
      where s.id::text = (storage.foldername(name))[2] and s.owner_id = (select auth.uid())));
create policy tierras_photo_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tierras-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

commit;
