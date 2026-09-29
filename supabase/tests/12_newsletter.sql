-- Newsletterele: cine le scrie, cine le trimite, ce intră în istoric.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('7e000000-0000-0000-0000-000000000001', 'sef@stiri.ro'),
  ('7e000000-0000-0000-0000-000000000002', 'ana@stiri.ro'),
  ('7e000000-0000-0000-0000-000000000003', 'dan@stiri.ro'),
  ('7e000000-0000-0000-0000-000000000009', 'strain@altundeva.ro');

create table public._n (k text primary key, v text);
grant all on public._n to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', '7e000000-0000-0000-0000-000000000001', false);
insert into public.organizations (name, join_domains) values ('Stiri SRL', array['stiri.ro']);
insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations where name = 'Stiri SRL';
insert into public._n select 'org', id::text from public.organizations where name = 'Stiri SRL';

-- Conducerea scrie un newsletter pentru toată echipa.
insert into public.newsletters (org_id, title, subject, body)
select (select v from public._n where k='org')::uuid, 'Promoție toamnă', 'Reduceri la pompe', 'Bună ziua, {persoana}!';
insert into public._n select 'nl', id::text from public.newsletters where title = 'Promoție toamnă';

-- Ana are două firme: una îl primește, cealaltă a cerut să nu mai primească.
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '7e000000-0000-0000-0000-000000000002', false);
select public.join_org_by_domain();
insert into public.clients (org_id, name, email, owner_agent_id, preferred_channel)
select (select v from public._n where k='org')::uuid, 'Firma Anei', 'a@firma.ro', auth.uid(), 'whatsapp';
insert into public.clients (org_id, name, email, owner_agent_id, newsletter_opt_out)
select (select v from public._n where k='org')::uuid, 'Firma fără newsletter', 'b@firma.ro', auth.uid(), true;
insert into public._n select 'firma', id::text from public.clients where name = 'Firma Anei';
insert into public._n select 'stop', id::text from public.clients where name = 'Firma fără newsletter';

\echo '--- 1. agentul vede newsletterul scris de conducere ---'
do $$ begin
  if (select count(*) from public.newsletters) <> 1 then
    raise exception 'PROBLEMĂ: agentul nu vede newsletterul echipei';
  end if;
  raise notice 'OK: newsletterul e al întregii echipe';
end $$;

\echo '--- 2. dar nu îi poate schimba textul ---'
update public.newsletters set body = 'schimbat de agent';
do $$ begin
  if exists (select 1 from public.newsletters where body = 'schimbat de agent') then
    raise exception 'PROBLEMĂ: agentul a schimbat textul conducerii';
  end if;
  raise notice 'OK: textul îl schimbă autorul sau conducerea';
end $$;

\echo '--- 3. canalul preferat acceptă doar email sau whatsapp ---'
do $$ begin
  update public.clients set preferred_channel = 'fax' where name = 'Firma Anei';
  raise exception 'PROBLEMĂ: s-a acceptat un canal necunoscut';
exception when check_violation then
  raise notice 'OK: canalul e email sau whatsapp';
end $$;

\echo '--- 4. trimiterea se notează doar la firmele care nu au refuzat ---'
do $$
declare n int;
begin
  n := public.log_newsletter_sent(
    (select v from public._n where k='nl')::uuid, 'whatsapp',
    array[(select v from public._n where k='firma')::uuid, (select v from public._n where k='stop')::uuid]);
  if n <> 1 then raise exception 'PROBLEMĂ: aștept 1 firmă notată, am %', n; end if;
  if not exists (select 1 from public.client_activities
                 where kind = 'newsletter' and agent_id = auth.uid()
                   and meta ->> 'channel' = 'whatsapp'
                   and meta ->> 'newsletter_id' = (select v from public._n where k='nl')) then
    raise exception 'PROBLEMĂ: trimiterea nu e în istoric';
  end if;
  raise notice 'OK: trimiterea e în istoric, firma care a refuzat e sărită';
end $$;

\echo '--- 5. newsletterul nu se numără ca email în rapoarte ---'
do $$ begin
  if exists (select 1 from public.client_activities where kind in ('email', 'whatsapp')) then
    raise exception 'PROBLEMĂ: newsletterul a intrat la contacte';
  end if;
  raise notice 'OK: newsletterul are tipul lui';
end $$;

\echo '--- 6. un coleg nu poate nota trimiterea pe firmele Anei ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '7e000000-0000-0000-0000-000000000003', false);
select public.join_org_by_domain();
do $$
declare n int;
begin
  n := public.log_newsletter_sent((select v from public._n where k='nl')::uuid, 'email',
                                  array[(select v from public._n where k='firma')::uuid]);
  if n <> 0 then raise exception 'PROBLEMĂ: colegul a scris pe firma altui agent'; end if;
  raise notice 'OK: fiecare notează doar pe firmele lui';
end $$;

\echo '--- 7. altă firmă nu vede newsletterul ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '7e000000-0000-0000-0000-000000000009', false);
do $$ begin
  if (select count(*) from public.newsletters) <> 0 then
    raise exception 'PROBLEMĂ: newsletterul se vede din altă firmă';
  end if;
  begin
    perform public.log_newsletter_sent((select v from public._n where k='nl')::uuid, 'email', array[]::uuid[]);
    raise exception 'PROBLEMĂ: s-a notat un newsletter din altă firmă';
  exception when raise_exception then
    if sqlerrm like 'PROBLEMĂ%' then raise; end if;
  end;
  raise notice 'OK: newsletterele rămân în firmă';
end $$;

\echo '--- 8. conducerea șterge newsletterul, istoricul rămâne ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', '7e000000-0000-0000-0000-000000000001', false);
delete from public.newsletters;
do $$ begin
  if (select count(*) from public.client_activities where kind = 'newsletter') <> 1 then
    raise exception 'PROBLEMĂ: istoricul s-a pierdut odată cu newsletterul';
  end if;
  raise notice 'OK: istoricul păstrează titlul newsletterului';
end $$;

reset role;
drop table public._n;

\echo '--- toate verificările pe newslettere au trecut ---'
