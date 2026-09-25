-- Istoricul fiecărei firme: telefoane, emailuri, întâlniri scurte, note, ce s-a
-- întâmplat cu pașii următori și cu ofertele. Vizitele au tabelul lor și intră
-- în istoric direct de acolo; aici stă tot ce nu e o vizită cu formular.

create table public.client_activities (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  client_id   uuid not null references public.clients (id) on delete cascade,
  agent_id    uuid references auth.users (id) on delete set null default auth.uid(),
  kind        text not null check (kind in (
                'telefon',        -- a sunat sau a fost sunat
                'email',          -- a trimis sau a primit un email
                'intalnire',      -- s-au văzut, fără vizită completă
                'nota',           -- orice altceva de ținut minte
                'pas_amanat',     -- pasul următor mutat pe altă zi
                'pas_inchis',     -- pas închis fără o nouă revenire
                'oferta_creata',  -- scrise de trigger, din oferte
                'oferta_stare'
              )),
  occurred_at timestamptz not null default now(),
  body        text,
  -- Pasul la care se referă: din ce vizită vine și între ce date s-a mutat.
  visit_id    uuid references public.visits (id) on delete set null,
  step_from   date,
  step_to     date,
  quote_id    uuid references public.quotes (id) on delete set null,
  -- Pentru oferte: numărul și starea, ca istoricul să rămână citibil și după ștergere.
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index client_activities_client_idx on public.client_activities (client_id, occurred_at desc);
create index client_activities_agent_idx on public.client_activities (agent_id, occurred_at desc);

comment on table public.client_activities is
  'Istoricul firmei în afara vizitelor: telefoane, emailuri, note, pași mutați, oferte.';

alter table public.client_activities enable row level security;

-- Se vede ca vizitele: ale mele, ale firmelor mele, sau toate pentru conducere.
create policy "istoric: citire ca vizitele" on public.client_activities
  for select using (public.is_member(org_id) and (
    public.is_org_admin(org_id)
    or agent_id = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_id and c.owner_agent_id = auth.uid())));

-- Fiecare scrie în numele lui, doar pe firme din organizația lui.
create policy "istoric: scrie în numele tău" on public.client_activities
  for insert with check (
    public.is_member(org_id)
    and agent_id = auth.uid()
    and exists (select 1 from public.clients c where c.id = client_id and c.org_id = org_id));

-- O notă greșită o corectează sau o șterge autorul ei, ori conducerea.
create policy "istoric: autorul corectează" on public.client_activities
  for update using (public.is_member(org_id) and (public.is_org_admin(org_id) or agent_id = auth.uid()))
  with check (public.is_member(org_id) and (public.is_org_admin(org_id) or agent_id = auth.uid()));

create policy "istoric: autorul șterge" on public.client_activities
  for delete using (public.is_member(org_id) and (public.is_org_admin(org_id) or agent_id = auth.uid()));


-- ------------------------------------------------ ofertele intră singure în istoric

-- Security definer: cine schimbă starea unei oferte o poate face și pe o firmă
-- care nu e a lui (conducerea), iar rândul de istoric trebuie scris oricum.
create or replace function public.log_quote_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.client_activities (org_id, client_id, agent_id, kind, quote_id, meta)
    values (new.org_id, new.client_id, coalesce(auth.uid(), new.created_by), 'oferta_creata', new.id,
            jsonb_build_object('number', new.number, 'status', new.status));
  elsif new.status is distinct from old.status then
    insert into public.client_activities (org_id, client_id, agent_id, kind, quote_id, meta)
    values (new.org_id, new.client_id, coalesce(auth.uid(), new.created_by), 'oferta_stare', new.id,
            jsonb_build_object('number', new.number, 'status', new.status, 'from', old.status));
  end if;
  return new;
end;
$$;

create trigger quotes_log_activity
  after insert or update of status on public.quotes
  for each row execute function public.log_quote_activity();

-- Ofertele de dinainte intră în istoric cu data la care au fost create.
insert into public.client_activities (org_id, client_id, agent_id, kind, occurred_at, quote_id, meta)
select q.org_id, q.client_id, q.created_by, 'oferta_creata', q.created_at, q.id,
       jsonb_build_object('number', q.number, 'status', q.status)
from public.quotes q
where q.client_id is not null;
