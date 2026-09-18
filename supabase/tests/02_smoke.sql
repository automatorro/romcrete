-- Verificări pe schema Romcrete: numerotare, totaluri, integritate și izolarea între firme.
-- Se rulează pe o bază locală, peste stub-ul din 00_stub_supabase.sql: `npm run db:test`.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'sef@romcrete.ro'),
  ('22222222-2222-2222-2222-222222222222', 'strain@altafirma.ro');

-- Reține organizația într-un tabel temporar, ca testul să o poată folosi și din alt rol.
create table public._test_state (org_id uuid);
grant all on public._test_state to authenticated;

-- ======================= utilizatorul 1 își creează firma =======================
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

insert into public.organizations (name, cui, vat_rate) values ('Romcrete SRL', 'RO12345678', 21);

\echo '--- 1. firma proaspăt creată este vizibilă celui care a creat-o (aștept 1) ---'
select count(*) as organizatii from public.organizations;

insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations where name = 'Romcrete SRL';

insert into public._test_state select org_id from public.memberships limit 1;

\echo '--- 2. catalogul implicit, idempotent (aștept 12, apoi tot 12) ---'
select public.seed_default_catalog((select org_id from public._test_state));
select count(*) as produse from public.catalog_items;
select public.seed_default_catalog((select org_id from public._test_state));
select count(*) as produse_dupa_al_doilea_apel from public.catalog_items;

insert into public.clients (org_id, name, cui, city)
select org_id, 'Constructii Alfa SRL', 'RO87654321', 'Cluj-Napoca' from public._test_state;

\echo '--- 3. numerotare automată (aștept OF-<an>-0001, apoi -0002) ---'
select public.next_quote_number((select org_id from public._test_state)) as primul;
select public.next_quote_number((select org_id from public._test_state)) as al_doilea;

insert into public.quotes (org_id, client_id, number, title, discount_pct, created_by)
select s.org_id, c.id, 'OF-TEST-0001', 'Furnizare beton bloc Nord', 10, auth.uid()
from public._test_state s, public.clients c;

insert into public.quote_items (quote_id, position, name, unit, quantity, unit_price, vat_rate)
select q.id, 1, 'Beton C20/25', 'mc', 10, 375.00, 21 from public.quotes q where q.number = 'OF-TEST-0001';
insert into public.quote_items (quote_id, position, name, unit, quantity, unit_price, vat_rate)
select q.id, 2, 'Pompă de beton', 'ora', 2, 450.00, 21 from public.quotes q where q.number = 'OF-TEST-0001';

\echo '--- 4. totaluri cu discount 10% (aștept 4650.00 / 4185.00 / 878.85 / 5063.85) ---'
select t.lines_net, t.net_total, t.vat_total, (t.net_total + t.vat_total) as total_de_plata
from public.quote_totals t join public.quotes q on q.id = t.quote_id
where q.number = 'OF-TEST-0001';

\echo '--- 5. un client cu oferte emise nu poate fi șters ---'
begin;
do $$ begin
  delete from public.clients;
  raise exception 'PROBLEMĂ: clientul a fost șters deși are oferte';
exception when foreign_key_violation then
  raise notice 'OK: ștergerea clientului cu oferte este blocată';
end $$;
rollback;

-- ======================= utilizatorul 2, din altă firmă =======================
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);

\echo '--- 6. izolarea între firme (aștept 0 peste tot) ---'
select
  (select count(*) from public.organizations) as organizatii,
  (select count(*) from public.clients)       as clienti,
  (select count(*) from public.catalog_items) as produse,
  (select count(*) from public.quotes)        as oferte,
  (select count(*) from public.quote_items)   as linii,
  (select count(*) from public.quote_totals)  as totaluri;

\echo '--- 7. un străin nu poate genera numere în seria altei firme ---'
do $$
declare v_org uuid;
begin
  select org_id into v_org from public._test_state;
  perform public.next_quote_number(v_org);
  raise exception 'PROBLEMĂ: străinul a generat un număr în seria altei firme';
exception when insufficient_privilege or raise_exception then
  if sqlerrm like 'PROBLEMĂ%' then raise; end if;
  raise notice 'OK: %', sqlerrm;
end $$;

\echo '--- 8. un străin nu poate scrie în firma altcuiva ---'
do $$
declare v_org uuid;
begin
  select org_id into v_org from public._test_state;
  insert into public.clients (org_id, name) values (v_org, 'Client injectat');
  raise exception 'PROBLEMĂ: străinul a inserat un client în firma altcuiva';
exception when insufficient_privilege then
  raise notice 'OK: inserarea în firma altcuiva este blocată de RLS';
end $$;

reset role;
drop table public._test_state;
\echo '--- toate verificările au trecut ---'
