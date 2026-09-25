-- Rapoartele salvate: zilnic, săptămânal, lunar, trimestrial. Un raport se
-- generează din date, se editează (rezumat, observații, secțiuni), apoi se
-- descarcă și se trimite prin Outlook. Cifrele se păstrează „înghețate” la
-- salvare, ca raportul trimis să rămână exact cum l-a citit destinatarul.

create table public.reports (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  created_by     uuid references auth.users (id) on delete set null default auth.uid(),
  type           text not null check (type in ('zi', 'saptamana', 'luna', 'trimestru')),
  period_from    date not null,
  period_to      date not null,
  agent_filter   uuid references auth.users (id) on delete set null,
  domain_filter  text,
  title          text not null,
  summary        text,
  -- Observația scrisă sub fiecare secțiune, pe cheia secțiunii.
  section_notes  jsonb not null default '{}'::jsonb,
  sections       text[] not null default '{}',
  -- Cifrele de la momentul salvării (sau al ultimei actualizări cerute).
  data           jsonb not null,
  status         text not null default 'ciorna' check (status in ('ciorna', 'trimis')),
  recipients     text[] not null default '{}',
  sent_at        timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (period_to >= period_from)
);

create index reports_org_idx on public.reports (org_id, period_from desc);

create trigger reports_touch_updated_at
  before update on public.reports
  for each row execute function public.touch_updated_at();

comment on table public.reports is
  'Rapoarte salvate, cu cifrele înghețate la salvare, rezumat și observații; se trimit prin Outlook.';

alter table public.reports enable row level security;

-- Conducerea vede toate rapoartele; agentul, pe ale lui.
create policy "rapoarte: citire" on public.reports
  for select using (public.is_member(org_id) and (public.is_org_admin(org_id) or created_by = auth.uid()));

create policy "rapoarte: creare în numele tău" on public.reports
  for insert with check (public.is_member(org_id) and created_by = auth.uid());

create policy "rapoarte: autorul sau conducerea modifică" on public.reports
  for update
  using (public.is_member(org_id) and (public.is_org_admin(org_id) or created_by = auth.uid()))
  with check (public.is_member(org_id) and (public.is_org_admin(org_id) or created_by = auth.uid()));

create policy "rapoarte: autorul sau conducerea șterge" on public.reports
  for delete using (public.is_member(org_id) and (public.is_org_admin(org_id) or created_by = auth.uid()));

-- Cui se trimit de obicei rapoartele: se completează singur la fiecare raport.
alter table public.organizations
  add column report_recipients text[] not null default '{}';

comment on column public.organizations.report_recipients is
  'Adresele la care se trimit de obicei rapoartele; propuse automat la trimiterea prin Outlook.';
