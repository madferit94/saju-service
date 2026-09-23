-- Synthetic users and records exist only inside this rolled-back transaction.
begin;
select set_config('test.owner_a', gen_random_uuid()::text, true);
select set_config('test.owner_b', gen_random_uuid()::text, true);
insert into auth.users(id) values (current_setting('test.owner_a')::uuid), (current_setting('test.owner_b')::uuid);
select set_config('request.jwt.claim.sub', current_setting('test.owner_a'), true);
set local role authenticated;
insert into public.saju_readings(title, fingerprint, payload) values (
  'synthetic RLS verification', repeat('a',64),
  '{"version":1,"fortuneYear":2026,"result":{"version":1,"input":{},"chart":{},"timeline":{},"benefactors":[],"reading":null,"savedAt":"2026-09-23T00:00:00Z","yunGender":0}}'
);
do $$
begin
  if (select count(*) from public.saju_readings) <> 1 then raise exception 'Owner cannot read own row'; end if;
  begin
    insert into public.saju_readings(user_id,title,fingerprint,payload)
      select current_setting('test.owner_b')::uuid,title,repeat('b',64),payload from public.saju_readings;
    raise exception 'Cross-owner insert was allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.saju_readings set title='unexpected';
    raise exception 'Immutable row update was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.saju_readings(title,fingerprint,payload) values ('broken',repeat('c',64),'{}');
    raise exception 'Malformed JSON was allowed';
  exception when check_violation then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', current_setting('test.owner_b'), true);
set local role authenticated;
do $$
declare affected integer;
begin
  if exists (select 1 from public.saju_readings) then raise exception 'Cross-owner read was allowed'; end if;
  delete from public.saju_readings;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-owner delete was allowed'; end if;
end $$;
reset role;
set local role anon;
do $$
begin
  begin
    perform id from public.saju_readings;
    raise exception 'Anonymous read was allowed';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.saju_readings(title,fingerprint,payload) values ('anonymous',repeat('d',64),'{}');
    raise exception 'Anonymous insert was allowed';
  exception when insufficient_privilege then null; end;
  begin
    delete from public.saju_readings;
    raise exception 'Anonymous delete was allowed';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', current_setting('test.owner_a'), true);
set local role authenticated;
do $$
declare affected integer;
begin
  delete from public.saju_readings;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Owner delete did not remove exactly own row'; end if;
end $$;
reset role;
rollback;
select 'PASS: owner CRUD, cross-account and anonymous isolation, immutable rows, payload constraints; test changes rolled back' as verification;
