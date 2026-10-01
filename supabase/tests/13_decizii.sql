-- Deciziile din rapoarte: cine le vede, cine le închide, ce refuză baza.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('f0000000-0000-0000-0000-000000000001', 'sef@decizii.ro'),
  ('f0000000-0000-0000-0000-000000000002', 'ana@decizii.ro'),
  ('f0000000-0000-0000-0000-000000000003', 'dan@decizii.ro');

create table public._d (k text primary key, v text);
grant all on public._d to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', false);
insert into public.organizations (name, join_domains) values ('Decizii SRL', array['decizii.ro']);
insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations where name = 'Decizii SRL';
insert into public._d select 'org', id::text from public.organizations where name = 'Decizii SRL';

reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000002', false);
select public.join_org_by_domain();
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000003', false);
select public.join_org_by_domain();

\echo '--- 1. conducerea notează o decizie pentru Ana ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000001', false);
insert into public.report_decisions (org_id, agent_filter, text, owner, due_date)
values ((select v from public._d where k='org')::uuid, 'f0000000-0000-0000-0000-000000000002',
        'Partener de leasing pentru pompe', 'conducerea', '2026-10-15');
insert into public._d select 'dec', id::text from public.report_decisions;

\echo '--- 2. Ana o vede și o închide; Dan nu o vede ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000002', false);
update public.report_decisions set status = 'facuta', closed_at = now(), outcome = 'Contract cu BT Leasing.';
do $$ begin
  if (select status from public.report_decisions) <> 'facuta' then
    raise exception 'PROBLEMĂ: agentul nu poate închide decizia luată pentru el';
  end if;
  raise notice 'OK: agentul închide decizia lui';
end $$;

reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'f0000000-0000-0000-0000-000000000003', false);
do $$ begin
  if (select count(*) from public.report_decisions) <> 0 then
    raise exception 'PROBLEMĂ: colegul vede deciziile altuia';
  end if;
  raise notice 'OK: colegul nu vede decizia';
end $$;

\echo '--- 3. agentul nu notează decizii pentru altcineva ---'
do $$ begin
  insert into public.report_decisions (org_id, agent_filter, text)
  values ((select v from public._d where k='org')::uuid, 'f0000000-0000-0000-0000-000000000002', 'x');
  raise exception 'PROBLEMĂ: agentul a notat o decizie pentru alt agent';
exception when insufficient_privilege then
  raise notice 'OK: agentul notează doar pentru el';
end $$;

\echo '--- 4. o decizie închisă are data închiderii ---'
reset role;
do $$ begin
  update public.report_decisions set status = 'renuntat', closed_at = null;
  raise exception 'PROBLEMĂ: s-a închis o decizie fără dată';
exception when check_violation then
  raise notice 'OK: închiderea cere data';
end $$;

drop table public._d;

\echo '--- toate verificările pe decizii au trecut ---'
