-- Fundamentul CRM: vizite de teren, agenți cu firmele lor, administratori care văd tot.
--
-- Trei schimbări de fond față de aplicația de ofertare:
--   1. un agent vede doar firmele lui; rolurile owner/admin văd toată organizația
--   2. vizita devine unitatea de bază — starea unei firme se derivă din vizitele ei
--   3. invitațiile: un coleg nou intră în organizația existentă, nu își creează una nouă

-- ------------------------------------------------------------------ roluri

-- Pereche pentru is_member: separă conducerea de agenți. Security definer,
-- ca politicile să nu intre în recursiune pe memberships.
create or replace function public.is_org_admin(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

-- ------------------------------------------------------- firme și persoane

alter table public.clients
  add column trade_type     text,
  add column owner_agent_id uuid references auth.users (id) on delete set null default auth.uid();

comment on column public.clients.trade_type is
  'Meseria: tencuitor, glet, sapist, general, firma, alt';
comment on column public.clients.owner_agent_id is
  'Agentul care răspunde de firmă. Conducerea vede toate firmele indiferent de valoare.';

-- Firmele existente rămân vizibile: trec la primul owner al organizației.
update public.clients c
set owner_agent_id = (
  select m.user_id from public.memberships m
  where m.org_id = c.org_id and m.role = 'owner'
  order by m.created_at limit 1
)
where owner_agent_id is null;

create index clients_owner_agent_idx on public.clients (owner_agent_id);

-- Oamenii întâlniți la firmă: patron, șef de echipă, meșter…
create table public.client_contacts (
  id         uuid primary key default gen_random_uuid(),
  client_id  uuid not null references public.clients (id) on delete cascade,
  role       text,
  name       text,
  phone      text,
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index client_contacts_client_idx on public.client_contacts (client_id, position);

-- ------------------------------------------------------------------ vizite

create table public.visits (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references public.organizations (id) on delete cascade,
  client_id          uuid not null references public.clients (id) on delete cascade,
  agent_id           uuid references auth.users (id) on delete set null default auth.uid(),
  visit_date         date not null default current_date,

  -- Răspunsurile, pe id de grup de întrebări: text pentru alegere unică,
  -- listă pentru alegere multiplă. Structura o dă tabelul question_groups.
  answers            jsonb not null default '{}'::jsonb,
  -- „Altele”: text liber, pe același id de grup.
  notes              jsonb not null default '{}'::jsonb,
  -- Modelele de pompe discutate, prin codul Graco (sku din catalog).
  pump_skus          text[] not null default '{}',

  -- În afara răspunsurilor pentru că declanșează muncă și se filtrează pe ele.
  next_step_date     date,
  next_step_done_at  timestamptz,
  escalation_done_at timestamptz,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index visits_client_idx  on public.visits (client_id, visit_date desc);
create index visits_org_idx     on public.visits (org_id, visit_date desc);
create index visits_agent_idx   on public.visits (agent_id, visit_date desc);
create index visits_answers_idx on public.visits using gin (answers);

create trigger visits_touch_updated_at
  before update on public.visits
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------- starea derivată a firmei

-- Echivalentul lui derive() din aplicația de teren: parcurge vizitele în ordine
-- cronologică; la alegerile multiple face reuniune, la cele unice păstrează
-- ultima valoare dată. Nu cunoaște lista de întrebări, deci nu trebuie schimbată
-- când se adaugă întrebări noi.
create or replace function public.merge_visit_answers(p_client uuid)
returns jsonb
language plpgsql
stable
set search_path = public
as $$
declare
  v_row record;
  v_key text;
  v_val jsonb;
  v_acc jsonb := '{}'::jsonb;
begin
  for v_row in
    select answers from public.visits
    where client_id = p_client
    order by visit_date, created_at
  loop
    for v_key, v_val in select * from jsonb_each(coalesce(v_row.answers, '{}'::jsonb)) loop
      if jsonb_typeof(v_val) = 'array' then
        v_acc := jsonb_set(v_acc, array[v_key], (
          select coalesce(jsonb_agg(distinct e), '[]'::jsonb)
          from jsonb_array_elements(coalesce(v_acc -> v_key, '[]'::jsonb) || v_val) e
        ));
      elsif v_val is not null and v_val <> 'null'::jsonb and v_val <> '""'::jsonb then
        v_acc := jsonb_set(v_acc, array[v_key], v_val);
      end if;
    end loop;
  end loop;
  return v_acc;
end;
$$;

-- Prioritatea A/B/C, cu aceleași praguri ca în aplicația de teren.
-- Sub 3 criterii completate rămâne „?”: nu inventăm un scor din date lipsă.
create or replace function public.client_priority(a jsonb)
returns text
language sql
immutable
as $$
  with c as (
    select
      case a ->> 'interes'
        when 'nu' then 0 when 'curios' then 1 when 'vezi' then 2
        when 'oferta' then 3 when 'gata' then 4 end as interes,
      case a ->> 'decide'
        when 'singur' then 2 when 'influ' then 1 when 'nu' then 0 end as decide,
      case a ->> 'volum'
        when 'l12' then 0 when 'l35' then 1 when 'l6' then 2 end as volum,
      case a ->> 'cand'
        when 'acum' then 2 when 'l13' then 1 when 'l3p' then 0 end as cand,
      case when jsonb_typeof(a -> 'atragere') = 'array'
                and jsonb_array_length(a -> 'atragere') > 0
        then least(2, (
          select count(*) from jsonb_array_elements_text(a -> 'atragere') x
          where x <> 'nimic'
        ))
      end as atragere
  ), t as (
    select
      (interes is not null)::int + (decide is not null)::int + (volum is not null)::int
        + (cand is not null)::int + (atragere is not null)::int as n,
      coalesce(interes, 0) + coalesce(decide, 0) + coalesce(volum, 0)
        + coalesce(cand, 0) + coalesce(atragere, 0) as sc
    from c
  )
  select case when n < 3 then '?' when sc >= 8 then 'A' when sc >= 5 then 'B' else 'C' end
  from t;
$$;

-- Ce vede lista de firme și ce alimentează raportul. security_invoker: view-ul
-- respectă politicile utilizatorului care interoghează.
create view public.client_state
with (security_invoker = on)
as
select
  c.id                as client_id,
  c.org_id,
  c.owner_agent_id,
  c.name,
  c.trade_type,
  c.city,
  c.phone,
  a.answers,
  a.answers ->> 'etapa'   as stage,
  a.answers ->> 'interes' as interest,
  public.client_priority(a.answers) as priority,
  v.visit_count,
  v.last_visit,
  -- Pasul următor rămâne deschis doar dacă ultima vizită care l-a stabilit nu l-a bifat.
  case when ns.next_step_done_at is null then ns.step      end as next_step,
  case when ns.next_step_done_at is null then ns.step_date end as next_step_date,
  case when ns.next_step_done_at is null then ns.visit_id  end as next_step_visit_id,
  (ns.next_step_done_at is null and ns.step_date is not null and ns.step_date < current_date) as next_step_late,
  e.pending_escalations
from public.clients c
cross join lateral (select public.merge_visit_answers(c.id) as answers) a
left join lateral (
  select count(*) as visit_count, max(visit_date) as last_visit
  from public.visits v where v.client_id = c.id
) v on true
left join lateral (
  select v.id as visit_id, v.answers ->> 'urmator' as step,
         v.next_step_date as step_date, v.next_step_done_at
  from public.visits v
  where v.client_id = c.id
    and (v.answers ? 'urmator' or v.next_step_date is not null)
  order by v.visit_date desc, v.created_at desc
  limit 1
) ns on true
left join lateral (
  select count(*) as pending_escalations
  from public.visits v
  where v.client_id = c.id
    and jsonb_typeof(v.answers -> 'esc') = 'array'
    and jsonb_array_length(v.answers -> 'esc') > 0
    and v.escalation_done_at is null
) e on true;

-- ------------------------------------------------------------- invitații

create table public.invitations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  email       text not null,
  role        public.member_role not null default 'agent',
  code        text not null unique default encode(gen_random_bytes(9), 'hex'),
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null
);

create index invitations_org_idx on public.invitations (org_id, created_at desc);

-- Acceptarea rulează cu drepturi de definer: invitatul nu e încă membru,
-- deci nu poate citi invitația prin politicile normale.
create or replace function public.accept_invitation(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitations;
begin
  if auth.uid() is null then
    raise exception 'Trebuie să fii autentificat ca să accepți invitația.';
  end if;

  select * into v_inv from public.invitations
  where code = p_code and accepted_at is null;

  if v_inv.id is null then
    raise exception 'Invitația nu există sau a fost deja folosită.';
  end if;

  insert into public.memberships (user_id, org_id, role)
  values (auth.uid(), v_inv.org_id, v_inv.role)
  on conflict (user_id, org_id) do nothing;

  update public.invitations
  set accepted_at = now(), accepted_by = auth.uid()
  where id = v_inv.id;

  return v_inv.org_id;
end;
$$;

-- ------------------------------------------------------------------- RLS

alter table public.client_contacts enable row level security;
alter table public.visits          enable row level security;
alter table public.invitations     enable row level security;

-- Firmele: agentul doar pe ale lui, conducerea pe toate.
drop policy "clients: acces pe organizație" on public.clients;
create policy "clients: agentul pe ale lui, conducerea pe toate" on public.clients
  for all
  using      (public.is_member(org_id) and (public.is_org_admin(org_id) or owner_agent_id = auth.uid()))
  with check (public.is_member(org_id) and (public.is_org_admin(org_id) or owner_agent_id = auth.uid()));

create policy "contacte: prin firmă" on public.client_contacts
  for all
  using (exists (
    select 1 from public.clients c where c.id = client_id
      and public.is_member(c.org_id)
      and (public.is_org_admin(c.org_id) or c.owner_agent_id = auth.uid())))
  with check (exists (
    select 1 from public.clients c where c.id = client_id
      and public.is_member(c.org_id)
      and (public.is_org_admin(c.org_id) or c.owner_agent_id = auth.uid())));

-- Vizitele: ale mele, ale firmelor mele, sau toate dacă sunt conducere.
-- Vizitele proprii rămân vizibile și după ce firma trece la alt agent.
create policy "vizite: agentul pe ale lui, conducerea pe toate" on public.visits
  for all
  using (public.is_member(org_id) and (
    public.is_org_admin(org_id)
    or agent_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_id and c.owner_agent_id = auth.uid())))
  with check (public.is_member(org_id) and (
    public.is_org_admin(org_id)
    or agent_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_id and c.owner_agent_id = auth.uid())));

-- Ofertele urmează firma: agentul vede ofertele firmelor lui.
drop policy "quotes: acces pe organizație" on public.quotes;
create policy "quotes: urmează firma" on public.quotes
  for all
  using (public.is_member(org_id) and (
    public.is_org_admin(org_id)
    or created_by = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_id and c.owner_agent_id = auth.uid())))
  with check (public.is_member(org_id) and (
    public.is_org_admin(org_id)
    or created_by = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_id and c.owner_agent_id = auth.uid())));

-- Catalogul: toți agenții văd toate prețurile; îl modifică doar conducerea.
drop policy "catalog: acces pe organizație" on public.catalog_items;
create policy "catalog: toți membrii citesc" on public.catalog_items
  for select using (public.is_member(org_id));
create policy "catalog: conducerea modifică" on public.catalog_items
  for all
  using      (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

-- Datele firmei: le schimbă doar conducerea.
drop policy "org: membrii actualizează" on public.organizations;
create policy "org: conducerea actualizează" on public.organizations
  for update
  using      (public.is_org_admin(id) or created_by = auth.uid())
  with check (public.is_org_admin(id) or created_by = auth.uid());

-- Invitațiile: doar conducerea le vede și le emite. Acceptarea trece prin RPC.
create policy "invitații: conducerea gestionează" on public.invitations
  for all
  using      (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

-- Conducerea poate scoate un coleg din organizație.
create policy "membership: conducerea gestionează" on public.memberships
  for all
  using      (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));
