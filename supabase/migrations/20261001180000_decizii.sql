-- Deciziile luate pe baza rapoartelor și urmărirea lor.
--
-- Un raport care nu duce la o decizie e doar un control. O decizie care nu se
-- verifică data viitoare se uită. De aceea deciziile stau separat de raport:
-- se notează în raportul în care s-au luat și reapar în rapoartele următoare
-- cu aceeași țintă (același agent, sau echipa) până se închid.

create table public.report_decisions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organizations (id) on delete cascade,
  -- Raportul în care s-a luat; dacă raportul se șterge, decizia rămâne.
  report_id     uuid references public.reports (id) on delete set null,
  -- Pentru cine e: un agent sau, null, echipa. Aceeași regulă ca la rapoarte.
  agent_filter  uuid references auth.users (id) on delete set null,
  text          text not null check (length(trim(text)) > 0),
  -- Cine se ocupă, cum s-a spus în ședință: „Lucian”, „conducerea”, „service”.
  owner         text,
  due_date      date,
  status        text not null default 'deschisa' check (status in ('deschisa', 'in_lucru', 'facuta', 'renuntat')),
  -- Ce a ieșit: se scrie la închidere.
  outcome       text,
  closed_at     timestamptz,
  created_by    uuid references auth.users (id) on delete set null default auth.uid(),
  created_at    timestamptz not null default now(),
  -- O decizie închisă are data închiderii; una deschisă nu.
  check ((status in ('facuta', 'renuntat')) = (closed_at is not null))
);

create index report_decisions_org_idx on public.report_decisions (org_id, agent_filter, status);
create index report_decisions_report_idx on public.report_decisions (report_id);

comment on table public.report_decisions is
  'Deciziile luate pe baza rapoartelor; reapar în rapoartele următoare până se închid.';

alter table public.report_decisions enable row level security;

-- Le vede conducerea, autorul și agentul pentru care s-au luat.
create policy "decizii: citire" on public.report_decisions
  for select using (public.is_member(org_id) and (
    public.is_org_admin(org_id) or created_by = auth.uid() or agent_filter = auth.uid()));

create policy "decizii: creare în numele tău" on public.report_decisions
  for insert with check (public.is_member(org_id) and created_by = auth.uid()
    -- Agentul notează decizii doar pentru el; conducerea, pentru oricine.
    and (public.is_org_admin(org_id) or agent_filter = auth.uid()));

-- Starea o actualizează și agentul pentru care s-a luat decizia: el o duce la capăt.
create policy "decizii: actualizare" on public.report_decisions
  for update
  using (public.is_member(org_id) and (
    public.is_org_admin(org_id) or created_by = auth.uid() or agent_filter = auth.uid()))
  with check (public.is_member(org_id) and (
    public.is_org_admin(org_id) or created_by = auth.uid() or agent_filter = auth.uid()));

create policy "decizii: autorul sau conducerea șterge" on public.report_decisions
  for delete using (public.is_member(org_id) and (public.is_org_admin(org_id) or created_by = auth.uid()));

grant select, insert, update, delete on public.report_decisions to authenticated;
