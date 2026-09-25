-- Arhiva ofertelor: agentul arhivează și restaurează, conducerea șterge definitiv.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000001', 'sef@arhiva.ro'),
  ('d0000000-0000-0000-0000-000000000002', 'ana@arhiva.ro');

create table public._a (k text primary key, v text);
grant all on public._a to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', false);
insert into public.organizations (name, join_domains) values ('Arhiva SRL', array['arhiva.ro']);
insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations where name = 'Arhiva SRL';
insert into public._a select 'org', id::text from public.organizations where name = 'Arhiva SRL';

reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', false);
select public.join_org_by_domain();
insert into public.clients (org_id, name, owner_agent_id)
select (select v from public._a where k='org')::uuid, 'Firma de arhivă', auth.uid();
insert into public.quotes (org_id, client_id, number, created_by)
select (select v from public._a where k='org')::uuid, id, 'ARH-1', auth.uid()
from public.clients where name = 'Firma de arhivă';

\echo '--- 1. agentul arhivează propria ofertă ---'
update public.quotes set archived_at = now(), archived_by = auth.uid() where number = 'ARH-1';
select number, archived_at is not null as arhivata from public.quotes;

\echo '--- 2. agentul nu o poate șterge definitiv ---'
delete from public.quotes where number = 'ARH-1';
do $$ begin
  if not exists (select 1 from public.quotes where number = 'ARH-1') then
    raise exception 'PROBLEMĂ: agentul a șters definitiv o ofertă';
  end if;
  raise notice 'OK: ștergerea definitivă nu e a agentului';
end $$;

\echo '--- 3. restaurarea o readuce ---'
update public.quotes set archived_at = null, archived_by = null where number = 'ARH-1';

\echo '--- 4. conducerea nu șterge o ofertă activă, doar una din arhivă ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', false);
delete from public.quotes where number = 'ARH-1';
do $$ begin
  if not exists (select 1 from public.quotes where number = 'ARH-1') then
    raise exception 'PROBLEMĂ: s-a șters definitiv o ofertă care nu era în arhivă';
  end if;
  raise notice 'OK: oferta activă rămâne';
end $$;
update public.quotes set archived_at = now() where number = 'ARH-1';
delete from public.quotes where number = 'ARH-1';
do $$ begin
  if exists (select 1 from public.quotes where number = 'ARH-1') then
    raise exception 'PROBLEMĂ: conducerea n-a putut șterge din arhivă';
  end if;
  raise notice 'OK: conducerea șterge definitiv din arhivă';
end $$;

\echo '--- 5. istoricul păstrează arhivarea, restaurarea și a doua arhivare ---'
select meta ->> 'event' as eveniment, meta ->> 'number' as numar
from public.client_activities
where meta ? 'event' order by occurred_at, created_at;
do $$ begin
  if (select count(*) from public.client_activities where meta ? 'event') <> 3 then
    raise exception 'PROBLEMĂ: aștept 3 evenimente de arhivă în istoric';
  end if;
  raise notice 'OK: arhivarea intră în istoric';
end $$;

reset role;
drop table public._a;

\echo '--- toate verificările pe arhiva ofertelor au trecut ---'
