-- Încadrarea firmelor și catalogul de ocupații, fără a rescrie valorile istorice.
-- Ocupațiile se introduc după verificarea bazei reale; nu presupunem o taxonomie.

create table public.org_occupations (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations (id) on delete cascade,
  domain_id   text not null references public.domains (id),
  label       text not null check (length(btrim(label)) between 2 and 100),
  active      boolean not null default true,
  created_by  uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (org_id, id)
);

create unique index org_occupations_label_idx
  on public.org_occupations (org_id, domain_id, lower(btrim(label)));
create index org_occupations_domain_idx
  on public.org_occupations (org_id, domain_id, active, label);

alter table public.org_occupations enable row level security;

create policy "ocupații: membrii citesc"
  on public.org_occupations for select to authenticated
  using (public.is_member(org_id));

create policy "ocupații: conducerea adaugă"
  on public.org_occupations for insert to authenticated
  with check (public.is_org_admin(org_id) and (created_by is null or created_by = auth.uid()));

create policy "ocupații: conducerea corectează"
  on public.org_occupations for update to authenticated
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

alter table public.clients
  add column occupation_id uuid,
  add column classification_status text not null default 'needs_review'
    check (classification_status in ('needs_review', 'confirmed')),
  add column classification_note text,
  add column classified_at timestamptz,
  add column classified_by uuid,
  add constraint clients_occupation_org_fk
    foreign key (org_id, occupation_id)
    references public.org_occupations (org_id, id);

create index clients_classification_idx
  on public.clients (org_id, classification_status, domain);

comment on column public.clients.classification_status is
  'needs_review by default; confirmed only after a manager validates the firm''s domain and occupation.';
comment on column public.clients.occupation_id is
  'Organization-managed occupation vocabulary; legacy trade_type is retained unchanged.';

create table public.client_classification_history (
  id                    bigint generated always as identity primary key,
  org_id                uuid not null references public.organizations (id) on delete cascade,
  client_id             uuid not null references public.clients (id) on delete cascade,
  old_domain            text,
  new_domain            text,
  old_occupation_id     uuid,
  new_occupation_id     uuid,
  old_status            text not null,
  new_status            text not null,
  classification_note   text,
  changed_by            uuid references auth.users (id) on delete set null,
  changed_at            timestamptz not null default now()
);

create index client_classification_history_client_idx
  on public.client_classification_history (org_id, client_id, changed_at desc);

alter table public.client_classification_history enable row level security;

create policy "istoric încadrări: conducerea citește"
  on public.client_classification_history for select to authenticated
  using (public.is_org_admin(org_id));

create or replace function public.guard_client_classification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_occupation_domain text;
  v_changed boolean;
begin
  if new.classification_status not in ('needs_review', 'confirmed') then
    raise exception 'Stare de încadrare invalidă' using errcode = '23514';
  end if;

  if new.occupation_id is not null then
    select domain_id into v_occupation_domain
    from public.org_occupations
    where org_id = new.org_id and id = new.occupation_id;

    if not found or v_occupation_domain is distinct from new.domain then
      raise exception 'Ocupația trebuie să aparțină domeniului selectat' using errcode = '23514';
    end if;
  end if;

  if new.classification_status = 'confirmed' and new.occupation_id is null then
    raise exception 'O încadrare confirmată trebuie să aibă o ocupație' using errcode = '23514';
  end if;

  if tg_op = 'UPDATE' then
    v_changed :=
      new.domain is distinct from old.domain
      or new.occupation_id is distinct from old.occupation_id
      or new.classification_status is distinct from old.classification_status
      or new.classification_note is distinct from old.classification_note
      or new.classified_at is distinct from old.classified_at
      or new.classified_by is distinct from old.classified_by;
  else
    v_changed := new.occupation_id is not null
      or new.classification_status <> 'needs_review'
      or new.classification_note is not null;
  end if;

  if v_changed and not public.is_org_admin(new.org_id) then
    raise exception 'Doar conducerea poate modifica încadrarea firmelor' using errcode = '42501';
  end if;

  if v_changed and new.classification_status = 'confirmed' then
    new.classified_at := now();
    new.classified_by := auth.uid();
  elsif v_changed then
    new.classified_at := null;
    new.classified_by := null;
  end if;

  return new;
end;
$$;

create or replace function public.audit_client_classification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.domain is distinct from old.domain
    or new.occupation_id is distinct from old.occupation_id
    or new.classification_status is distinct from old.classification_status
    or new.classification_note is distinct from old.classification_note then
    insert into public.client_classification_history (
      org_id, client_id, old_domain, new_domain, old_occupation_id, new_occupation_id,
      old_status, new_status, classification_note, changed_by
    ) values (
      new.org_id, new.id, old.domain, new.domain, old.occupation_id, new.occupation_id,
      old.classification_status, new.classification_status, new.classification_note, auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger clients_guard_classification
  before insert or update on public.clients
  for each row execute function public.guard_client_classification();

create trigger clients_audit_classification
  after update on public.clients
  for each row execute function public.audit_client_classification();