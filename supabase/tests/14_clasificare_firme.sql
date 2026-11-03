-- Încadrarea firmelor: păstrează vechile valori, confirmă ocupația și limitează editarea la conducere.
\set ON_ERROR_STOP on
\pset pager off

insert into auth.users (id, email) values
  ('d0000000-0000-0000-0000-000000000001', 'owner@classificare.ro'),
  ('d0000000-0000-0000-0000-000000000002', 'agent@classificare.ro');

set role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000001', false);

insert into public.organizations (name, join_domains)
values ('Romcrete Clasificare', array['clasificare.ro']);
insert into public.memberships (user_id, org_id, role)
select auth.uid(), id, 'owner' from public.organizations where name = 'Romcrete Clasificare';
insert into public.memberships (user_id, org_id, role)
select 'd0000000-0000-0000-0000-000000000002', id, 'agent'
from public.organizations where name = 'Romcrete Clasificare';

insert into public.org_occupations (org_id, domain_id, label, created_by)
select id, 'marcaje', 'Aplicator marcaje rutiere', auth.uid()
from public.organizations where name = 'Romcrete Clasificare';
insert into public.org_occupations (org_id, domain_id, label, created_by)
select id, 'constructii', 'Zugrav', auth.uid()
from public.organizations where name = 'Romcrete Clasificare';

insert into public.clients (org_id, owner_agent_id, name, trade_type, domain)
select id, 'd0000000-0000-0000-0000-000000000002', 'Firmă de verificat', 'tencuitor', 'constructii'
from public.organizations where name = 'Romcrete Clasificare';

do $$
declare
  v_client uuid;
  v_org uuid;
  v_status text;
begin
  select id, org_id, classification_status into v_client, v_org, v_status
  from public.clients where name = 'Firmă de verificat';
  if v_status <> 'needs_review' then
    raise exception 'Firma nouă trebuie să rămână în coada de revizuire';
  end if;
  if (select trade_type from public.clients where id = v_client) <> 'tencuitor' then
    raise exception 'Meseria istorică nu trebuie suprascrisă';
  end if;

  update public.clients
  set domain = 'marcaje',
      occupation_id = (
        select id from public.org_occupations
        where org_id = v_org and domain_id = 'marcaje'
      ),
      classification_status = 'confirmed',
      classification_note = 'Confirmată după verificarea activității firmei'
  where id = v_client;

  if not exists (
    select 1 from public.clients
    where id = v_client and domain = 'marcaje'
      and classification_status = 'confirmed'
      and classified_at is not null
      and classified_by = auth.uid()
  ) then
    raise exception 'Confirmarea trebuie să actualizeze domeniul și să păstreze autorul';
  end if;

  if (select count(*) from public.client_classification_history where client_id = v_client) <> 1 then
    raise exception 'Confirmarea trebuie înregistrată în istoric';
  end if;

  begin
    update public.clients
    set occupation_id = (
      select id from public.org_occupations
      where org_id = v_org and domain_id = 'constructii'
    )
    where id = v_client;
    raise exception 'O ocupație din alt domeniu a fost acceptată';
  exception when check_violation then
    null;
  end;
end $$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', 'd0000000-0000-0000-0000-000000000002', false);

do $$
declare
  v_client uuid;
begin
  select id into v_client from public.clients where name = 'Firmă de verificat';
  begin
    update public.clients
    set classification_note = 'încercare agent'
    where id = v_client;
    raise exception 'Un agent a putut modifica încadrarea';
  exception when insufficient_privilege then
    null;
  end;
end $$;

reset role;
\echo '--- verificările pentru încadrarea firmelor au trecut ---'