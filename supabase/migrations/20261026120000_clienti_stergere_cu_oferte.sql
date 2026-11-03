-- Ofertele rămân valide și după ștergerea clientului; păstrează datele folosite
-- la emitere într-un snapshot, fără a șterge documentele sau liniile lor.

alter table public.quotes
  add column client_snapshot jsonb;

update public.quotes q
set client_snapshot = jsonb_build_object(
  'name', c.name,
  'cui', c.cui,
  'reg_com', c.reg_com,
  'contact_person', c.contact_person,
  'email', c.email,
  'phone', c.phone,
  'address', c.address,
  'city', c.city,
  'county', c.county
)
from public.clients c
where c.id = q.client_id;

alter table public.quotes
  drop constraint quotes_client_id_fkey,
  add constraint quotes_client_id_fkey
    foreign key (client_id) references public.clients (id) on delete set null;

create or replace function public.snapshot_quote_client()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is null then
    return new;
  end if;

  select jsonb_build_object(
    'name', c.name,
    'cui', c.cui,
    'reg_com', c.reg_com,
    'contact_person', c.contact_person,
    'email', c.email,
    'phone', c.phone,
    'address', c.address,
    'city', c.city,
    'county', c.county
  )
  into new.client_snapshot
  from public.clients c
  where c.id = new.client_id;

  return new;
end;
$$;

create trigger quotes_snapshot_client
  before insert or update of client_id on public.quotes
  for each row execute function public.snapshot_quote_client();