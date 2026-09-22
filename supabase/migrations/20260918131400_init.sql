-- Romcrete — schema inițială pentru ofertare și devize
-- Rulează în Supabase: SQL Editor sau `supabase db push`.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- organizații

create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  cui         text,
  reg_com     text,
  address     text,
  city        text,
  county      text,
  email       text,
  phone       text,
  iban        text,
  bank        text,
  vat_rate    numeric(5,2) not null default 21,   -- cota TVA standard implicită
  quote_terms text,                               -- condiții afișate pe ofertă
  created_by  uuid references auth.users (id) on delete set null default auth.uid(),
  created_at  timestamptz not null default now()
);

create type public.member_role as enum ('owner', 'admin', 'agent');

create table public.memberships (
  user_id    uuid not null references auth.users (id) on delete cascade,
  org_id     uuid not null references public.organizations (id) on delete cascade,
  role       public.member_role not null default 'agent',
  full_name  text,
  created_at timestamptz not null default now(),
  primary key (user_id, org_id)
);

create index memberships_org_id_idx on public.memberships (org_id);

-- Evită recursiunea din politicile RLS: rulează cu drepturi de definer.
create or replace function public.is_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = auth.uid()
  );
$$;

-- -------------------------------------------------------------------- clienți

create table public.clients (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organizations (id) on delete cascade,
  name           text not null,
  cui            text,
  reg_com        text,
  contact_person text,
  email          text,
  phone          text,
  address        text,
  city           text,
  county         text,
  notes          text,
  created_at     timestamptz not null default now()
);

create index clients_org_id_idx on public.clients (org_id);

-- ------------------------------------------------------------------- catalog

create table public.catalog_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  sku         text,
  name        text not null,
  description text,
  category    text,
  unit        text not null default 'mc',
  unit_price  numeric(12,2) not null default 0,
  vat_rate    numeric(5,2) not null default 21,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index catalog_items_org_id_idx on public.catalog_items (org_id);
create unique index catalog_items_org_sku_idx
  on public.catalog_items (org_id, sku) where sku is not null;

-- --------------------------------------------------------------------- oferte

create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired');

create table public.quotes (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.organizations (id) on delete cascade,
  client_id    uuid references public.clients (id) on delete restrict,
  number       text not null,
  title        text,
  status       public.quote_status not null default 'draft',
  issue_date   date not null default current_date,
  valid_until  date,
  currency     text not null default 'RON',
  discount_pct numeric(5,2) not null default 0,   -- discount pe total ofertă
  site_address text,                              -- adresa șantierului
  notes        text,
  terms        text,
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create unique index quotes_org_number_idx on public.quotes (org_id, number);
create index quotes_client_id_idx on public.quotes (client_id);

create table public.quote_items (
  id           uuid primary key default gen_random_uuid(),
  quote_id     uuid not null references public.quotes (id) on delete cascade,
  position     integer not null default 0,
  name         text not null,
  description  text,
  unit         text not null default 'mc',
  quantity     numeric(12,3) not null default 1,
  unit_price   numeric(12,2) not null default 0,
  vat_rate     numeric(5,2) not null default 21,
  discount_pct numeric(5,2) not null default 0,   -- discount pe linie
  created_at   timestamptz not null default now()
);

create index quote_items_quote_id_idx on public.quote_items (quote_id, position);

-- Numerotare oferte: serie per organizație și an.
create table public.quote_counters (
  org_id      uuid not null references public.organizations (id) on delete cascade,
  year        integer not null,
  last_number integer not null default 0,
  primary key (org_id, year)
);

create or replace function public.next_quote_number(p_org uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date);
  v_num  int;
begin
  if not public.is_member(p_org) then
    raise exception 'Acces interzis pentru organizația %', p_org;
  end if;

  insert into public.quote_counters (org_id, year, last_number)
  values (p_org, v_year, 1)
  on conflict (org_id, year)
    do update set last_number = public.quote_counters.last_number + 1
  returning last_number into v_num;

  return 'OF-' || v_year || '-' || lpad(v_num::text, 4, '0');
end;
$$;

-- updated_at automat pe oferte
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger quotes_touch_updated_at
  before update on public.quotes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------- totaluri (view)

-- security_invoker: view-ul respectă RLS-ul utilizatorului care interoghează.
create view public.quote_totals
with (security_invoker = on)
as
select
  q.id as quote_id,
  coalesce(sum(i.quantity * i.unit_price * (1 - i.discount_pct / 100)), 0)::numeric(14,2) as lines_net,
  (coalesce(sum(i.quantity * i.unit_price * (1 - i.discount_pct / 100)), 0)::numeric(14,2)
    * (1 - q.discount_pct / 100))::numeric(14,2) as net_total,
  (coalesce(sum(i.quantity * i.unit_price * (1 - i.discount_pct / 100) * i.vat_rate / 100), 0)::numeric(14,2)
    * (1 - q.discount_pct / 100))::numeric(14,2) as vat_total
from public.quotes q
left join public.quote_items i on i.quote_id = q.id
group by q.id, q.discount_pct;

-- ------------------------------------------------------------------- RLS

alter table public.organizations  enable row level security;
alter table public.memberships    enable row level security;
alter table public.clients        enable row level security;
alter table public.catalog_items  enable row level security;
alter table public.quotes         enable row level security;
alter table public.quote_items    enable row level security;
alter table public.quote_counters enable row level security;

-- organizations
-- `created_by` acoperă momentul dintre crearea firmei și adăugarea primului membru:
-- fără el, cel care tocmai a creat organizația nu ar putea nici măcar să o citească.
create policy "org: membrii citesc" on public.organizations
  for select using (public.is_member(id) or created_by = auth.uid());
create policy "org: orice utilizator autentificat poate crea" on public.organizations
  for insert to authenticated with check (true);
create policy "org: membrii actualizează" on public.organizations
  for update using (public.is_member(id) or created_by = auth.uid())
  with check (public.is_member(id) or created_by = auth.uid());

-- memberships
create policy "membership: vezi colegii din organizațiile tale" on public.memberships
  for select using (public.is_member(org_id));
create policy "membership: te poți adăuga pe tine" on public.memberships
  for insert to authenticated with check (user_id = auth.uid());
create policy "membership: îți poți șterge apartenența" on public.memberships
  for delete using (user_id = auth.uid());

-- tabele de date: totul pe apartenența la organizație
create policy "clients: acces pe organizație" on public.clients
  for all using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "catalog: acces pe organizație" on public.catalog_items
  for all using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "quotes: acces pe organizație" on public.quotes
  for all using (public.is_member(org_id)) with check (public.is_member(org_id));
create policy "counters: acces pe organizație" on public.quote_counters
  for select using (public.is_member(org_id));

create policy "quote_items: acces prin ofertă" on public.quote_items
  for all using (
    exists (select 1 from public.quotes q where q.id = quote_id and public.is_member(q.org_id))
  ) with check (
    exists (select 1 from public.quotes q where q.id = quote_id and public.is_member(q.org_id))
  );
