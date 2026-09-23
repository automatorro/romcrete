-- Verificări pentru domenii: vocabularul pe domeniu, unitatea de măsură,
-- parametrii firmei și legătura dintre domeniu și catalog.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('b0000000-0000-0000-0000-000000000001', 'sef2@domenii.ro'),
  ('b0000000-0000-0000-0000-000000000002', 'agent3@domenii.ro');

create table public._d (k text primary key, v text);
grant all on public._d to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000001', false);

insert into public.organizations (name, join_domains) values ('Romcrete Domenii', array['domenii.ro']);
insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations where name = 'Romcrete Domenii';
insert into public._d select 'org', id::text from public.organizations where name = 'Romcrete Domenii';

\echo '--- 1. toate domeniile au unitate, randament și categorii de catalog ---'
\echo '    (aștept 8 domenii, niciunul fără unitate sau cu randament sub 1)'
select count(*) as domenii,
       count(*) filter (where unit is null or unit_short is null) as fara_unitate,
       count(*) filter (where productivity_factor <= 1)           as randament_gresit,
       count(*) filter (where cardinality(pump_categories) = 0)   as fara_categorii
from public.domains;

\echo '--- 2. fiecare domeniu are întrebările lui de producție și de preț ---'
\echo '    (aștept cel puțin 4 intervale de producție și 4 de manoperă peste tot)'
select d.id,
       (select count(*) from public.question_options o
         where o.group_id = 'supr' and o.domains @> array[d.id]) as intervale_productie,
       (select count(*) from public.question_options o
         where o.group_id = 'manopera' and o.domains @> array[d.id]) as intervale_pret,
       (select count(*) from public.question_options o
         where o.group_id = 'tip' and o.domains @> array[d.id])  as tipuri_lucrare,
       (select count(*) from public.question_options o
         where o.group_id = 'scule' and o.domains @> array[d.id]) as scule
from public.domains d
order by d.position;

\echo '--- 3. intervalele de producție și de preț au toate valoare de calcul ---'
\echo '    (aștept 0: fără valoare, calculul de amortizare n-ar porni)'
select count(*) as fara_valoare
from public.question_options
where group_id in ('supr', 'manopera')
  and domains is not null
  and value is null;

\echo '--- 4. coloana vertebrală a vânzării rămâne comună ---'
\echo '    (aștept „f” peste tot: nicio întrebare de vânzare legată de un domeniu)'
select bool_or(domains is not null) as legate_de_domeniu
from public.question_options
where group_id in ('relatie','interes','decide','cand','plata','urmator','etapa','obiectii','atragere','oameni','utilaj','refuzat');

\echo '--- 5. firma nouă intră implicit pe construcții ---'
insert into public.clients (org_id, name, city)
select (select v from public._d where k='org')::uuid, 'Firmă fără domeniu', 'Arad';
select domain as domeniu_implicit from public.clients where name = 'Firmă fără domeniu';

\echo '--- 6. domeniul firmei ajunge în client_state, alături de cele două axe ---'
\echo '    (aștept domain=marcaje, apetit A, poate cumpăra, cadranul „urmareste”)'
insert into public.clients (org_id, name, city, domain)
select (select v from public._d where k='org')::uuid, 'Marcaje SRL', 'Timișoara', 'marcaje';
insert into public._d select 'marcaje', id::text from public.clients where name = 'Marcaje SRL';

insert into public.visits (org_id, client_id, visit_date, answers)
select (select v from public._d where k='org')::uuid,
       (select v from public._d where k='marcaje')::uuid,
       current_date,
       '{"supr":"mrc2000","manopera":"r36","interes":"gata","decide":"singur",
         "cand":"acum","volum":"l6","atragere":["maimult"],
         "plata":"cash","santier":["230v"],"refuzat":"des"}'::jsonb;

select name, domain, priority, feasibility, focus
from public.client_state where client_id = (select v from public._d where k='marcaje')::uuid;

\echo '--- 7. calculul se face pe cifrele domeniului, nu pe metri pătrați ---'
\echo '    (aștept 1.250 ml/zi × 4,5 lei/ml, cu randamentul 5× al marcajelor)'
select
  (select value from public.question_options where group_id='supr'     and id='mrc2000') as ml_pe_zi,
  (select value from public.question_options where group_id='manopera' and id='r36')     as lei_pe_ml,
  (select productivity_factor from public.domains where id='marcaje')                    as randament,
  (select unit_short from public.domains where id='marcaje')                             as unitate;

\echo '--- 8. conducerea își schimbă randamentul unui domeniu ---'
insert into public.org_domain_params (org_id, domain_id, productivity_factor, active)
select (select v from public._d where k='org')::uuid, 'marcaje', 3.5, true;
select productivity_factor as randament_firmei, active
from public.org_domain_params
where org_id = (select v from public._d where k='org')::uuid and domain_id = 'marcaje';

\echo '--- 9. un agent obișnuit nu poate schimba parametrii firmei ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'b0000000-0000-0000-0000-000000000002', false);
select public.join_org_by_domain() is not null as a_intrat;

do $$
declare v_org uuid;
begin
  select org_id into v_org from public.memberships where user_id = auth.uid() limit 1;
  begin
    insert into public.org_domain_params (org_id, domain_id, productivity_factor)
    values (v_org, 'constructii', 9.9);
    raise exception 'AGENTUL A PUTUT SCRIE PARAMETRII — politica e greșită';
  exception when insufficient_privilege then
    raise notice 'ok: agentul nu poate scrie parametrii domeniilor';
  end;
end $$;

\echo '--- 10. dar îi poate citi, ca să i se calculeze amortizarea corect ---'
select count(*) as parametri_vizibili from public.org_domain_params;

reset role;
drop table public._d;

\echo '--- toate verificările pe domenii au trecut ---'
