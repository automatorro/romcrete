-- Rapoartele salvate: agentul pe ale lui, conducerea pe toate.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('e0000000-0000-0000-0000-000000000001', 'sef@rapoarte.ro'),
  ('e0000000-0000-0000-0000-000000000002', 'ana@rapoarte.ro'),
  ('e0000000-0000-0000-0000-000000000003', 'dan@rapoarte.ro');

create table public._r (k text primary key, v text);
grant all on public._r to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', false);
insert into public.organizations (name, join_domains) values ('Rapoarte SRL', array['rapoarte.ro']);
insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations where name = 'Rapoarte SRL';
insert into public._r select 'org', id::text from public.organizations where name = 'Rapoarte SRL';
update public.organizations set report_recipients = array['director@rapoarte.ro'] where name = 'Rapoarte SRL';

reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000002', false);
select public.join_org_by_domain();

\echo '--- 1. agentul își salvează raportul săptămânal ---'
insert into public.reports (org_id, type, period_from, period_to, title, data, sections)
select (select v from public._r where k='org')::uuid, 'saptamana', '2026-09-21', '2026-09-27',
       'Raport săptămânal', '{"kpi":[]}'::jsonb, array['kpi','agenti'];
update public.reports set summary = 'Săptămână bună.', status = 'trimis', sent_at = now(),
       recipients = array['director@rapoarte.ro'];
select title, status, created_by = auth.uid() as al_ei, updated_at >= created_at as atins from public.reports;

\echo '--- 2. perioada inversă e refuzată ---'
do $$ begin
  insert into public.reports (org_id, type, period_from, period_to, title, data)
  values ((select v from public._r where k='org')::uuid, 'zi', '2026-09-25', '2026-09-24', 'x', '{}'::jsonb);
  raise exception 'PROBLEMĂ: s-a salvat un raport cu perioada inversă';
exception when check_violation then
  raise notice 'OK: perioada trebuie să fie în ordine';
end $$;

\echo '--- 3. colegul nu vede raportul Anei ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000003', false);
select public.join_org_by_domain();
do $$ begin
  if (select count(*) from public.reports) <> 0 then raise exception 'PROBLEMĂ: colegul vede rapoartele altuia'; end if;
  raise notice 'OK: raportul e al autorului';
end $$;

\echo '--- 4. conducerea îl vede ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'e0000000-0000-0000-0000-000000000001', false);
do $$ begin
  if (select count(*) from public.reports) <> 1 then raise exception 'PROBLEMĂ: conducerea nu vede raportul'; end if;
  raise notice 'OK: conducerea vede rapoartele echipei';
end $$;

reset role;
drop table public._r;

\echo '--- toate verificările pe rapoarte au trecut ---'
