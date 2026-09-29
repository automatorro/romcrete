-- Newslettere și anunțuri către firmele din portofoliu, trimise din Outlook-ul
-- local sau din WhatsApp. Aplicația nu trimite nimic singură: pregătește textul,
-- îl arată exact cum îl va vedea clientul, deschide Outlook / WhatsApp, iar
-- trimiterea se notează în istoricul firmei.
--
-- Scriptul se poate rula de mai multe ori fără erori.

-- ------------------------------------------------ preferința firmei

-- Canalul preferat al firmei: gol = emailul dacă îl are, altfel WhatsApp.
alter table public.clients add column if not exists preferred_channel text;
alter table public.clients drop constraint if exists clients_preferred_channel_check;
alter table public.clients add constraint clients_preferred_channel_check
  check (preferred_channel in ('email', 'whatsapp'));

-- Firma a cerut să nu mai primească newslettere: rămâne în listă, dar nu se mai bifează.
alter table public.clients add column if not exists newsletter_opt_out boolean not null default false;

comment on column public.clients.preferred_channel is
  'Canalul pe care firma vrea newsletterele: email sau whatsapp; gol = emailul dacă există.';
comment on column public.clients.newsletter_opt_out is
  'Firma a cerut să nu mai primească newslettere.';

-- ------------------------------------------------ newsletterele

create table if not exists public.newsletters (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  title        text not null,
  subject      text not null default '',
  body         text not null default '',
  -- La final: „Dacă nu mai doriți aceste mesaje, răspundeți cu STOP.”
  unsubscribe_note boolean not null default true,
  created_by   uuid references auth.users (id) on delete set null default auth.uid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists newsletters_org_idx on public.newsletters (org_id, updated_at desc);

comment on table public.newsletters is
  'Newslettere și anunțuri: textul se scrie o dată și se trimite pe email sau WhatsApp firmelor alese.';

drop trigger if exists newsletters_touch_updated_at on public.newsletters;
create trigger newsletters_touch_updated_at
  before update of title, subject, body, unsubscribe_note on public.newsletters
  for each row execute function public.touch_updated_at();

alter table public.newsletters enable row level security;

-- Toată echipa vede newsletterele firmei: un text bun îl folosesc toți agenții.
drop policy if exists "newslettere: membrii citesc" on public.newsletters;
create policy "newslettere: membrii citesc" on public.newsletters
  for select using (public.is_member(org_id));

drop policy if exists "newslettere: scrie în numele tău" on public.newsletters;
create policy "newslettere: scrie în numele tău" on public.newsletters
  for insert with check (public.is_member(org_id) and created_by = auth.uid());

-- Textul îl schimbă autorul sau conducerea.
drop policy if exists "newslettere: autorul sau conducerea modifică" on public.newsletters;
create policy "newslettere: autorul sau conducerea modifică" on public.newsletters
  for update using (public.is_member(org_id) and (public.is_org_admin(org_id) or created_by = auth.uid()))
  with check (public.is_member(org_id) and (public.is_org_admin(org_id) or created_by = auth.uid()));

drop policy if exists "newslettere: autorul sau conducerea șterge" on public.newsletters;
create policy "newslettere: autorul sau conducerea șterge" on public.newsletters
  for delete using (public.is_member(org_id) and (public.is_org_admin(org_id) or created_by = auth.uid()));

grant select, insert, update, delete on public.newsletters to authenticated;

-- ------------------------------------------------ trimiterea intră în istoric

-- Un tip separat de „email” și „whatsapp”: o trimitere în masă nu e un contact
-- personal și nu trebuie să umfle telefoanele și emailurile din rapoarte.
alter table public.client_activities drop constraint if exists client_activities_kind_check;
alter table public.client_activities add constraint client_activities_kind_check check (kind in (
  'telefon', 'email', 'whatsapp', 'intalnire', 'nota',
  'pas_amanat', 'pas_inchis', 'oferta_creata', 'oferta_stare', 'newsletter'
));

create index if not exists client_activities_newsletter_idx
  on public.client_activities ((meta ->> 'newsletter_id'))
  where kind = 'newsletter';

-- Notează trimiterea unui newsletter la firmele date, pe canalul dat. Fiecare
-- rând se scrie în numele celui care trimite, doar pe firmele pe care le vede
-- (RLS pe clients: agentul pe ale lui, conducerea pe toate). Întoarce câte
-- firme s-au notat.
create or replace function public.log_newsletter_sent(p_newsletter uuid, p_channel text, p_clients uuid[])
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  n public.newsletters%rowtype;
  v_count integer;
begin
  if p_channel not in ('email', 'whatsapp') then
    raise exception 'Canal necunoscut: %', p_channel;
  end if;

  select * into n from public.newsletters where id = p_newsletter;
  if not found then
    raise exception 'Newsletterul nu există.';
  end if;

  insert into public.client_activities (org_id, client_id, agent_id, kind, body, meta)
  select c.org_id, c.id, auth.uid(), 'newsletter',
         format('Newsletter „%s” trimis pe %s.', n.title, case p_channel when 'email' then 'email' else 'WhatsApp' end),
         jsonb_build_object('newsletter_id', n.id, 'title', n.title, 'channel', p_channel)
  from public.clients c
  where c.id = any (p_clients) and c.org_id = n.org_id and not c.newsletter_opt_out;
  get diagnostics v_count = row_count;

  return v_count;
end;
$$;

revoke execute on function public.log_newsletter_sent(uuid, text, uuid[]) from public, anon;
grant execute on function public.log_newsletter_sent(uuid, text, uuid[]) to authenticated;
