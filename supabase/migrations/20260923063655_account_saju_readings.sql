create table public.saju_readings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  title text not null check (char_length(btrim(title)) between 1 and 80),
  fingerprint text not null check (fingerprint ~ '^[a-f0-9]{64}$'),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint saju_readings_payload_size check (octet_length(payload::text) <= 524288),
  constraint saju_readings_payload_shape check (coalesce(
    jsonb_typeof(payload) = 'object'
    and payload @> '{"version":1,"result":{"version":1}}'::jsonb
    and jsonb_typeof(payload->'result'->'input') = 'object'
    and jsonb_typeof(payload->'result'->'chart') = 'object'
    and jsonb_typeof(payload->'result'->'timeline') = 'object'
    and jsonb_typeof(payload->'result'->'benefactors') = 'array'
    and jsonb_typeof(payload->'result'->'reading') in ('object', 'null')
    and jsonb_typeof(payload->'result'->'savedAt') = 'string'
    and payload->'result'->'yunGender' in ('0'::jsonb, '1'::jsonb)
    and jsonb_typeof(payload->'fortuneYear') = 'number'
    and (payload->>'fortuneYear')::numeric between 1990 and 2100
    and (payload->>'fortuneYear')::numeric = trunc((payload->>'fortuneYear')::numeric), false)),
  unique (user_id, fingerprint)
);

create index saju_readings_owner_created_idx on public.saju_readings (user_id, created_at desc, id desc);
alter table public.saju_readings enable row level security;
revoke all on public.saju_readings from public, anon, authenticated;
grant select, insert, delete on public.saju_readings to authenticated;

create policy "Owners can read their results" on public.saju_readings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Owners can save their results" on public.saju_readings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Owners can delete their results" on public.saju_readings
  for delete to authenticated using ((select auth.uid()) = user_id);

comment on table public.saju_readings is 'Private, immutable saju snapshots. Access is restricted to the account owner; no public sharing.';
