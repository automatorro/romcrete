-- Ștergerea clientului păstrează ofertele și datele clientului folosite la emitere.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000014', 'stergere-client@romcrete.ro');

create table public._stergere_client (k text primary key, v text);
grant all on public._stergere_client to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000014', false);
insert into public.organizations (name) values ('Ștergere client test');
insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations where name = 'Ștergere client test';
insert into public._stergere_client
select 'org', id::text from public.organizations where name = 'Ștergere client test';

insert into public.clients (org_id, name, cui, city, owner_agent_id)
select (select v from public._stergere_client where k = 'org')::uuid,
       'Client de șters', 'RO123456', 'Cluj-Napoca', auth.uid();

insert into public.quotes (org_id, client_id, number, created_by)
select (select v from public._stergere_client where k = 'org')::uuid,
       id, 'DEL-1', auth.uid()
from public.clients where name = 'Client de șters';

delete from public.clients where name = 'Client de șters';

do $$ begin
  if exists (select 1 from public.clients where name = 'Client de șters') then
    raise exception 'PROBLEMĂ: clientul nu a fost șters';
  end if;
  if not exists (
    select 1 from public.quotes
    where number = 'DEL-1'
      and client_id is null
      and client_snapshot ->> 'name' = 'Client de șters'
      and client_snapshot ->> 'cui' = 'RO123456'
      and client_snapshot ->> 'city' = 'Cluj-Napoca'
  ) then
    raise exception 'PROBLEMĂ: oferta sau snapshot-ul clientului nu a fost păstrat';
  end if;
  raise notice 'OK: clientul a fost șters, iar oferta și datele ei au rămas';
end $$;

reset role;
drop table public._stergere_client;

\echo '--- verificările ștergerii clientului au trecut ---'