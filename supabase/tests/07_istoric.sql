-- Istoricul firmei: cine scrie, cine vede, și ofertele care intră singure.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('c0000000-0000-0000-0000-000000000001', 'sef@istoric.ro'),
  ('c0000000-0000-0000-0000-000000000002', 'ana@istoric.ro'),
  ('c0000000-0000-0000-0000-000000000003', 'dan@istoric.ro');

create table public._i (k text primary key, v text);
grant all on public._i to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', false);
insert into public.organizations (name, join_domains) values ('Istoric SRL', array['istoric.ro']);
insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations where name = 'Istoric SRL';
insert into public._i select 'org', id::text from public.organizations where name = 'Istoric SRL';

-- Ana își face firma, o vizitează și o sună.
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000002', false);
select public.join_org_by_domain();
insert into public.clients (org_id, name, owner_agent_id)
select (select v from public._i where k='org')::uuid, 'Firma Anei', auth.uid();
insert into public._i select 'firma', id::text from public.clients where name = 'Firma Anei';

insert into public.visits (org_id, client_id, agent_id, next_step_date, answers)
select (select v from public._i where k='org')::uuid, (select v from public._i where k='firma')::uuid,
       auth.uid(), current_date, '{"urmator":"sun"}'::jsonb;

\echo '--- 1. agentul notează un telefon pe firma lui ---'
insert into public.client_activities (org_id, client_id, kind, body, step_from, step_to)
select (select v from public._i where k='org')::uuid, (select v from public._i where k='firma')::uuid,
       'telefon', 'A zis să revin după ce termină șantierul', current_date, current_date + 7;
select kind, body, agent_id = auth.uid() as scris_de_ea from public.client_activities;

\echo '--- 2. nu poate scrie în numele altcuiva ---'
do $$ begin
  insert into public.client_activities (org_id, client_id, agent_id, kind)
  values ((select v from public._i where k='org')::uuid, (select v from public._i where k='firma')::uuid,
          'c0000000-0000-0000-0000-000000000003', 'nota');
  raise exception 'PROBLEMĂ: s-a scris istoric în numele altui agent';
exception when insufficient_privilege then
  raise notice 'OK: fiecare scrie doar în numele lui';
end $$;

\echo '--- 3. oferta creată și trimisă intră singură în istoric ---'
insert into public.quotes (org_id, client_id, number, created_by)
select (select v from public._i where k='org')::uuid, (select v from public._i where k='firma')::uuid,
       'IST-1', auth.uid();
update public.quotes set status = 'sent' where number = 'IST-1';
update public.quotes set title = 'fără schimbare de stare' where number = 'IST-1';
do $$
declare n int;
begin
  select count(*) into n from public.client_activities where kind like 'oferta_%';
  if n <> 2 then raise exception 'PROBLEMĂ: aștept 2 rânduri de ofertă, am %', n; end if;
  if not exists (select 1 from public.client_activities
                 where kind = 'oferta_stare' and meta ->> 'status' = 'sent' and meta ->> 'from' = 'draft') then
    raise exception 'PROBLEMĂ: schimbarea de stare nu s-a înregistrat corect';
  end if;
  raise notice 'OK: crearea și trimiterea ofertei sunt în istoric, restul modificărilor nu';
end $$;

\echo '--- 4. un coleg nu vede istoricul firmei Anei ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000003', false);
select public.join_org_by_domain();
do $$ begin
  if (select count(*) from public.client_activities) <> 0 then
    raise exception 'PROBLEMĂ: colegul vede istoricul altei firme';
  end if;
  raise notice 'OK: istoricul urmează firma';
end $$;

\echo '--- 5. nici nu i-l poate șterge ---'
delete from public.client_activities;
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'c0000000-0000-0000-0000-000000000001', false);
do $$ begin
  if (select count(*) from public.client_activities) <> 3 then
    raise exception 'PROBLEMĂ: istoricul s-a pierdut';
  end if;
  raise notice 'OK: conducerea vede toate cele 3 rânduri';
end $$;

\echo '--- 6. oferta ștearsă rămâne în istoric cu numărul ei ---'
delete from public.quotes where number = 'IST-1';
select kind, quote_id is null as oferta_stearsa, meta ->> 'number' as numar
from public.client_activities where kind like 'oferta_%' order by occurred_at, kind;

reset role;
drop table public._i;

\echo '--- toate verificările pe istoric au trecut ---'
