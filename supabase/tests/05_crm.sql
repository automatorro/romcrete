-- Verificări CRM: invitații, izolarea între agenți, starea derivată și prioritatea.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'sef@romcrete.ro'),
  ('a0000000-0000-0000-0000-000000000002', 'agent1@romcrete.ro'),
  ('a0000000-0000-0000-0000-000000000003', 'agent2@romcrete.ro');

create table public._t (k text primary key, v text);
grant all on public._t to authenticated;

-- ========================= conducerea își face organizația =========================
set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);

insert into public.organizations (name) values ('Romcrete Echipamente');
insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations;
insert into public._t select 'org', id::text from public.organizations;

\echo '--- 1. conducerea emite două invitații de agent ---'
insert into public.invitations (org_id, email, role, code)
select (select v from public._t where k='org')::uuid, 'agent1@romcrete.ro', 'agent', 'cod-agent-1';
insert into public.invitations (org_id, email, role, code)
select (select v from public._t where k='org')::uuid, 'agent2@romcrete.ro', 'agent', 'cod-agent-2';
select count(*) as invitatii from public.invitations;

-- ========================= agentul 1 acceptă și lucrează =========================
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);

\echo '--- 2. agentul acceptă invitația și intră în organizația existentă ---'
select public.accept_invitation('cod-agent-1') is not null as a_intrat;
select count(*) as organizatii_vizibile from public.organizations;

\echo '--- 3. un cod deja folosit nu mai merge ---'
do $$ begin
  perform public.accept_invitation('cod-agent-1');
  raise exception 'PROBLEMĂ: codul s-a putut refolosi';
exception when others then
  if sqlerrm like 'PROBLEMĂ%' then raise; end if;
  raise notice 'OK: %', sqlerrm;
end $$;

insert into public.clients (org_id, name, city, trade_type)
select (select v from public._t where k='org')::uuid, 'Iacob', 'Arad', 'general';
insert into public._t select 'firma1', id::text from public.clients where name = 'Iacob';

-- Prima vizită: manual, curios, decide singur.
insert into public.visits (org_id, client_id, visit_date, answers, next_step_date)
select (select v from public._t where k='org')::uuid, (select v from public._t where k='firma1')::uuid,
       current_date - 10,
       '{"mod":"manual","interes":"curios","decide":"singur","materiale":["termo"],
         "atragere":["termene"],"urmator":"sun","etapa":"cunoscut"}'::jsonb,
       current_date - 3;

\echo '--- 4. o singură vizită: 3 criterii, scor 4 (aștept C) ---'
select priority, stage, interest, visit_count, next_step, next_step_late
from public.client_state where client_id = (select v from public._t where k='firma1')::uuid;

-- A doua vizită: se răzgândește, interes mai mare, alte materiale.
insert into public.visits (org_id, client_id, visit_date, answers, next_step_date)
select (select v from public._t where k='org')::uuid, (select v from public._t where k='firma1')::uuid,
       current_date - 2,
       '{"mod":"mixt","interes":"gata","decide":"singur","volum":"l6","cand":"acum",
         "materiale":["glet","vopsea"],"atragere":["maimult","termene"],
         "urmator":"oferta","etapa":"interes"}'::jsonb,
       current_date + 5;

\echo '--- 5. starea derivată: alegerile unice iau ultima valoare, cele multiple se adună ---'
\echo '    (aștept mod=mixt, interes=gata, materiale = termo+glet+vopsea, prioritate A)'
select answers ->> 'mod' as mod, answers ->> 'interes' as interes,
       answers -> 'materiale' as materiale, priority, visit_count,
       next_step, next_step_date, next_step_late
from public.client_state where client_id = (select v from public._t where k='firma1')::uuid;

\echo '--- 6. pasul bifat ca făcut dispare din listă ---'
update public.visits set next_step_done_at = now()
where client_id = (select v from public._t where k='firma1')::uuid and visit_date = current_date - 2;
select next_step, next_step_date from public.client_state
where client_id = (select v from public._t where k='firma1')::uuid;

\echo '--- 7. agentul nu poate modifica catalogul, dar îl citește ---'
do $$ begin
  insert into public.catalog_items (org_id, name, unit_price)
  values ((select v from public._t where k='org')::uuid, 'Pompă inventată', 1);
  raise exception 'PROBLEMĂ: agentul a modificat catalogul';
exception when insufficient_privilege then
  raise notice 'OK: catalogul e doar pentru citire la agenți';
end $$;

-- ========================= agentul 2 nu vede firmele colegului =========================
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
select public.accept_invitation('cod-agent-2');

\echo '--- 8. izolarea între agenți (aștept 0 firme, 0 vizite) ---'
select (select count(*) from public.clients) as firme,
       (select count(*) from public.visits)  as vizite,
       (select count(*) from public.client_state) as in_lista;

insert into public.clients (org_id, name, city, trade_type)
select (select v from public._t where k='org')::uuid, 'Pop Construct', 'Timișoara', 'firma';

\echo '--- 9. agentul 2 își vede doar firma lui (aștept 1: Pop Construct) ---'
select name from public.clients;

-- ========================= conducerea vede tot =========================
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);

\echo '--- 10. conducerea vede ambele firme și toate vizitele ---'
select (select count(*) from public.clients) as firme,
       (select count(*) from public.visits)  as vizite;
select name, priority, visit_count from public.client_state order by name;

\echo '--- 11. praguri de prioritate ---'
select public.client_priority('{"interes":"curios","decide":"nu"}'::jsonb) as doua_criterii_astept_intrebare,
       public.client_priority('{"interes":"curios","decide":"nu","volum":"l12"}'::jsonb) as astept_C,
       public.client_priority('{"interes":"vezi","decide":"influ","volum":"l35","atragere":["termene"]}'::jsonb) as astept_B,
       public.client_priority('{"interes":"gata","decide":"singur","volum":"l6","cand":"acum","atragere":["maimult","termene"]}'::jsonb) as astept_A,
       -- „nu știu” nu se numără deloc; „nimic” se numără drept criteriu completat, dar aduce 0 puncte
       public.client_priority('{"interes":"gata","decide":"singur","volum":"l6","cand":"nustiu","atragere":["nimic"]}'::jsonb) as patru_criterii_scor_8_astept_A;

\echo '--- 12. fezabilitatea: poate cumpăra și are unde folosi? ---'
select
  public.client_feasibility('{"plata":"cash"}'::jsonb)                                as un_criteriu_astept_intrebare,
  public.client_feasibility('{"plata":"cash","refuzat":"des"}'::jsonb)                as scor_4_astept_da,
  public.client_feasibility('{"plata":"rate","santier":["faracurent"]}'::jsonb)       as scor_2_astept_blocaj,
  public.client_feasibility('{"plata":"nupoate","refuzat":"nu"}'::jsonb)              as scor_0_astept_nu,
  public.client_feasibility('{"plata":"nustie","refuzat":"des"}'::jsonb)              as nustie_nu_se_numara_astept_intrebare,
  public.client_feasibility('{"santier":["230v","distanta"],"refuzat":"cateva"}'::jsonb) as curent_plus_cerere_astept_da;

\echo '--- 13. cadranele: ce e de făcut cu firma ---'
with cazuri(descriere, a) as (values
  ('vrea și poate',        '{"interes":"gata","decide":"singur","volum":"l6","cand":"acum","atragere":["maimult","termene"],"plata":"cash","refuzat":"des"}'::jsonb),
  ('vrea, dar e blocat',   '{"interes":"gata","decide":"singur","volum":"l6","cand":"acum","atragere":["maimult"],"plata":"nupoate","santier":["faracurent"]}'::jsonb),
  ('poate, dar nu vrea',   '{"interes":"curios","decide":"nu","volum":"l12","plata":"cash","refuzat":"des"}'::jsonb),
  ('nici, nici',           '{"interes":"nu","decide":"nu","volum":"l12","plata":"nupoate","refuzat":"nu"}'::jsonb),
  ('date insuficiente',    '{"interes":"gata","plata":"cash"}'::jsonb)
)
select descriere,
       public.client_priority(a)    as apetit,
       public.client_feasibility(a) as fezabilitate,
       public.client_focus(a)       as cadran
from cazuri;

reset role;
drop table public._t;
\echo '--- toate verificările CRM au trecut ---'
