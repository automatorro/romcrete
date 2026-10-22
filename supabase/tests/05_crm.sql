-- Verificări CRM: invitații, izolarea între agenți, starea derivată și prioritatea.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'sef@romcrete.ro'),
  ('a0000000-0000-0000-0000-000000000002', 'agent1@romcrete.ro'),
  ('a0000000-0000-0000-0000-000000000003', 'strain@gmail.com'),
  ('a0000000-0000-0000-0000-000000000004', 'agent2@romcrete.ro');

create table public._t (k text primary key, v text);
grant all on public._t to authenticated;

-- ========================= conducerea își face organizația =========================
set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000001', false);

insert into public.organizations (name) values ('Romcrete Echipamente');
insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations;
insert into public._t select 'org', id::text from public.organizations;

\echo '--- 1. agentul își face singur contul și intră pe domeniul firmei ---'
update public.organizations set join_domains = array['romcrete.ro'];

reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
select public.join_org_by_domain() is not null as a_intrat;
select role as rol_primit from public.memberships where user_id = auth.uid();

\echo '--- 2. un email din afara domeniului e refuzat ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000003', false);
select public.join_org_by_domain() is null as refuzat,
       (select count(*) from public.memberships where user_id = auth.uid()) as membru;

reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);

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
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000004', false);
select public.join_org_by_domain();

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

\echo '--- 11. prioritatea se bazează pe interes, rol, volum și termen ---'
select public.client_priority('{"interes":"curios","decide":"nu"}'::jsonb) as doua_criterii_astept_intrebare,
       public.client_priority('{"interes":"curios","decide":"nu","volum":"l12"}'::jsonb) as astept_C,
       public.client_priority('{"interes":"vezi","decide":"influ","volum":"l35","cand":"l13","atragere":["termene"]}'::jsonb) as astept_B,
       public.client_priority('{"interes":"gata","decide":"singur","volum":"l6","cand":"acum","atragere":["maimult","termene"]}'::jsonb) as astept_A,
       -- „Nu am aflat” nu se numără; motivele de atracție nu schimbă prioritatea.
       public.client_priority('{"interes":"gata","decide":"singur","volum":"l6","cand":"nustiu","atragere":["nimic"]}'::jsonb) as trei_criterii_scor_8_astept_A;

do $$ begin
  if public.client_priority('{"interes":"curios","decide":"influ","volum":"l35","cand":"l13"}'::jsonb)
     <> public.client_priority('{"interes":"curios","decide":"influ","volum":"l35","cand":"l13","atragere":["maimult","termene"]}'::jsonb) then
    raise exception 'Motivele de atracție nu trebuie să crească prioritatea';
  end if;
  if (select counts_for_priority from public.question_groups where id = 'atragere') then
    raise exception 'Întrebarea despre beneficii nu trebuie marcată drept criteriu de prioritate';
  end if;
  if not exists (
    select 1 from public.question_options where group_id = 'etapa' and id = 'amanat'
  ) then
    raise exception 'Lipsește etapa pentru oportunitatea amânată';
  end if;
  if public.client_feasibility('{"plata":"cash","capacitate":"des"}'::jsonb)
     <> public.client_feasibility('{"plata":"cash","capacitate":"des","alimentare":"faracurent"}'::jsonb) then
    raise exception 'Lipsa curentului nu trebuie să reducă fezabilitatea comercială';
  end if;
end $$;

\echo '--- 12. fezabilitatea: plată, alimentarea lucrării și cerere neacoperită ---'
select
  public.client_feasibility('{"plata":"cash"}'::jsonb)                                as un_criteriu_astept_intrebare,
  public.client_feasibility('{"plata":"cash","capacitate":"des"}'::jsonb)             as cerere_neacoperita_astept_da,
  public.client_feasibility('{"plata":"cash","capacitate":"des","alimentare":"generator"}'::jsonb) as generator_astept_da,
  public.client_feasibility('{"plata":"rate","alimentare":"faracurent"}'::jsonb)      as doar_plata_astept_intrebare,
  public.client_feasibility('{"plata":"nupoate","capacitate":"nu"}'::jsonb)            as scor_0_astept_nu,
  public.client_feasibility('{"plata":"nustie","capacitate":"des"}'::jsonb)            as nustie_nu_se_numara_astept_intrebare,
  public.client_feasibility('{"plata":"cash","capacitate":"des","alimentare":"faracurent","santier":["230v"]}'::jsonb) as curentul_nu_schimba_fezabilitatea;

do $$ begin
  if public.client_feasibility('{"plata":"cash","capacitate":"des","alimentare":"faracurent","santier":["230v"]}'::jsonb) <> 'da' then
    raise exception 'Lipsa curentului și condițiile generale nu trebuie să reducă fezabilitatea';
  end if;
end $$;

\echo '--- 13. cadranele: ce e de făcut cu firma ---'
with cazuri(descriere, a) as (values
  ('vrea și poate',        '{"interes":"gata","decide":"singur","volum":"l6","cand":"acum","atragere":["maimult","termene"],"plata":"cash","capacitate":"des","alimentare":"230v"}'::jsonb),
  ('vrea, dar e blocat',   '{"interes":"gata","decide":"singur","volum":"l6","cand":"acum","atragere":["maimult"],"plata":"nupoate","alimentare":"faracurent"}'::jsonb),
  ('poate, dar nu vrea',   '{"interes":"curios","decide":"nu","volum":"l12","plata":"cash","capacitate":"des"}'::jsonb),
  ('nici, nici',           '{"interes":"nu","decide":"nu","volum":"l12","plata":"nupoate","capacitate":"nu"}'::jsonb),
  ('date insuficiente',    '{"interes":"gata","plata":"cash"}'::jsonb)
)
select descriere,
       public.client_priority(a)    as apetit,
       public.client_feasibility(a) as fezabilitate,
       public.client_focus(a)       as cadran
from cazuri;

\echo '--- 14. etapa amânată rămâne distinctă de oportunitatea pierdută ---'
insert into public.clients (org_id, name, city)
select (select v from public._t where k='org')::uuid, 'Oportunitate amânată', 'Arad';
insert into public.visits (org_id, client_id, visit_date, answers)
select c.org_id, c.id, current_date, '{"etapa":"amanat"}'::jsonb
from public.clients c where c.name = 'Oportunitate amânată';
do $$ begin
  if (select stage from public.client_state where name = 'Oportunitate amânată') <> 'amanat' then
    raise exception 'Etapa amânată nu este păstrată în starea firmei';
  end if;
end $$;

\echo '--- 15. firme de reluat: caldă la 7 zile, rece la 30 ---'
insert into public.clients (org_id, name, city)
select (select v from public._t where k='org')::uuid, 'Caldă recentă', 'Arad';
insert into public.clients (org_id, name, city)
select (select v from public._t where k='org')::uuid, 'Caldă uitată', 'Arad';
insert into public.clients (org_id, name, city)
select (select v from public._t where k='org')::uuid, 'Rece uitată de 10 zile', 'Arad';
insert into public.clients (org_id, name, city)
select (select v from public._t where k='org')::uuid, 'Rece uitată de 40 zile', 'Arad';

-- Caldă = vrea ofertă. Fără pas următor, ca să intre în regula de reluare.
insert into public.visits (org_id, client_id, visit_date, answers)
select c.org_id, c.id, current_date - 3, '{"interes":"oferta"}'::jsonb
from public.clients c where c.name = 'Caldă recentă';
insert into public.visits (org_id, client_id, visit_date, answers)
select c.org_id, c.id, current_date - 10, '{"interes":"oferta"}'::jsonb
from public.clients c where c.name = 'Caldă uitată';
insert into public.visits (org_id, client_id, visit_date, answers)
select c.org_id, c.id, current_date - 10, '{"interes":"curios"}'::jsonb
from public.clients c where c.name = 'Rece uitată de 10 zile';
insert into public.visits (org_id, client_id, visit_date, answers)
select c.org_id, c.id, current_date - 40, '{"interes":"curios"}'::jsonb
from public.clients c where c.name = 'Rece uitată de 40 zile';

select name, is_warm as calda, last_visit, recontact_due as termen, needs_recontact as de_reluat
from public.client_state
where name in ('Caldă recentă','Caldă uitată','Rece uitată de 10 zile','Rece uitată de 40 zile')
order by name;

\echo '    (aștept: Caldă recentă = nu, Caldă uitată = DA, Rece 10 zile = nu, Rece 40 zile = DA)'

\echo '--- 16. o firmă cu pas următor deschis nu intră la reluare ---'
insert into public.visits (org_id, client_id, visit_date, answers, next_step_date)
select c.org_id, c.id, current_date - 40, '{"interes":"curios","urmator":"sun"}'::jsonb, current_date + 5
from public.clients c where c.name = 'Rece uitată de 40 zile';
select name, needs_recontact as de_reluat_dupa_ce_are_pas
from public.client_state where name = 'Rece uitată de 40 zile';

\echo '--- 17. agentul completează datele firmei lui și le vede în starea firmei ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'a0000000-0000-0000-0000-000000000002', false);
update public.clients
set contact_person = 'Ion Iacob', cui = 'RO123', reg_com = 'J02/1/2020',
    email = 'ion@iacob.ro', address = 'Str. Mare 1', county = 'Arad'
where id = (select v from public._t where k='firma1')::uuid;
do $$
begin
  if not exists (
    select 1 from public.client_state
    where client_id = (select v from public._t where k='firma1')::uuid
      and contact_person = 'Ion Iacob' and cui = 'RO123' and reg_com = 'J02/1/2020'
      and email = 'ion@iacob.ro' and address = 'Str. Mare 1' and county = 'Arad'
  ) then
    raise exception 'PROBLEMĂ: datele firmei nu apar în client_state';
  end if;
  raise notice 'ok: datele firmei apar în client_state';
end $$;

reset role;
drop table public._t;
\echo '--- toate verificările CRM au trecut ---'
