-- Oferta după modelul Romcrete: agentul își pune singur datele și semnătura,
-- dar nu își poate schimba rolul; ștampila o pune doar conducerea.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('f2000000-0000-0000-0000-000000000001', 'sef@model.ro'),
  ('f2000000-0000-0000-0000-000000000002', 'ana@model.ro');
create table public._m (k text primary key, v text);
grant all on public._m to authenticated;

set role authenticated;
select set_config('request.jwt.claim.sub', 'f2000000-0000-0000-0000-000000000001', false);
insert into public.organizations (name, join_domains) values ('Model SRL', array['model.ro']);
insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations where name = 'Model SRL';
insert into public._m select 'org', id::text from public.organizations where name = 'Model SRL';

reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'f2000000-0000-0000-0000-000000000002', false);
select public.join_org_by_domain();

\echo '--- 1. agentul își completează datele de pe ofertă și semnătura ---'
select public.save_my_offer_profile((select v from public._m where k='org')::uuid, ' dna. Ana Pop ', '0722 000 111', '');
select public.save_my_signature((select v from public._m where k='org')::uuid, 'image/png', 'SEMN');
select full_name, phone, contact_email, signature_mime, role from public.memberships where user_id = auth.uid();

\echo '--- 2. dar nu își poate schimba rolul ---'
update public.memberships set role = 'owner' where user_id = auth.uid();
select role as rol_ramas from public.memberships where user_id = auth.uid();

\echo '--- 3. nici ștampila firmei ---'
update public.organizations set stamp_mime = 'image/png', stamp_b64 = 'X' where id = (select v from public._m where k='org')::uuid;
select count(*) as stampile_puse_de_agent from public.organizations where stamp_b64 is not null and name = 'Model SRL';

\echo '--- 4. conducerea pune ștampila ---'
reset role; set role authenticated;
select set_config('request.jwt.claim.sub', 'f2000000-0000-0000-0000-000000000001', false);
update public.organizations set stamp_mime = 'image/png', stamp_b64 = 'STAMP' where id = (select v from public._m where k='org')::uuid;
select stamp_b64 from public.organizations where name = 'Model SRL';

\echo '--- 5. conducerea vede semnătura agentului, pentru ofertele lui ---'
select signature_b64 from public.memberships where user_id = 'f2000000-0000-0000-0000-000000000002';

do $$ begin
  if (select role from public.memberships where user_id = 'f2000000-0000-0000-0000-000000000002') <> 'agent' then
    raise exception 'PROBLEMĂ: agentul și-a schimbat rolul';
  end if;
  if (select full_name from public.memberships where user_id = 'f2000000-0000-0000-0000-000000000002') <> 'dna. Ana Pop' then
    raise exception 'PROBLEMĂ: numele nu s-a salvat curat';
  end if;
  if (select contact_email from public.memberships where user_id = 'f2000000-0000-0000-0000-000000000002') is not null then
    raise exception 'PROBLEMĂ: emailul gol trebuia să rămână gol';
  end if;
end $$;

reset role;
drop table public._m;
\echo '--- toate verificările pe oferta model au trecut ---'
