-- Pozele produselor: agentul pune o poză lipsă, doar conducerea o înlocuiește.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('f1000000-0000-0000-0000-000000000001', 'sef@poze.ro'),
  ('f1000000-0000-0000-0000-000000000002', 'ana@poze.ro');
create table public._p (k text primary key, v text);
grant all on public._p to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', false);
insert into public.organizations (name, join_domains) values ('Poze SRL', array['poze.ro']);
insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations where name = 'Poze SRL';
insert into public._p select 'org', id::text from public.organizations where name = 'Poze SRL';
insert into public.catalog_items (org_id, name, unit_price)
select (select v from public._p where k='org')::uuid, 'Pompă cu poză', 100;
insert into public._p select 'item', id::text from public.catalog_items where name = 'Pompă cu poză';

reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000002', false);
select public.join_org_by_domain();

\echo '--- 1. agentul pune poza unui produs care n-are ---'
select public.save_catalog_image((select v from public._p where k='item')::uuid, 'image/jpeg', 'AAAA', 'magazin', 'https://x/p.jpg');
select source, mime from public.catalog_images;

\echo '--- 2. dar nu o poate înlocui ---'
do $$ begin
  perform public.save_catalog_image((select v from public._p where k='item')::uuid, 'image/png', 'BBBB', 'incarcat');
  raise exception 'PROBLEMĂ: agentul a înlocuit o poză existentă';
exception when raise_exception then
  if sqlerrm like 'PROBLEMĂ%' then raise; end if;
  raise notice 'OK: poza existentă o înlocuiește doar conducerea';
end $$;

\echo '--- 3. conducerea o înlocuiește ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'f1000000-0000-0000-0000-000000000001', false);
select public.save_catalog_image((select v from public._p where k='item')::uuid, 'image/png', 'CCCC', 'incarcat');
select source, mime, data_b64 from public.catalog_images;

\echo '--- 4. poza unei linii libere, prin ofertă ---'
insert into public.quotes (org_id, number, created_by) select (select v from public._p where k='org')::uuid, 'POZ-1', auth.uid();
insert into public.quote_items (quote_id, position, name, unit, quantity, unit_price, vat_rate)
select id, 1, 'Linie liberă', 'buc', 1, 10, 21 from public.quotes where number = 'POZ-1';
insert into public.quote_item_images (quote_item_id, mime, data_b64)
select id, 'image/jpeg', 'DDDD' from public.quote_items where name = 'Linie liberă';
select count(*) as poze_linii from public.quote_item_images;

reset role;
drop table public._p;

\echo '--- toate verificările pe poze au trecut ---'
