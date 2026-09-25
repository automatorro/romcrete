-- Pozele produselor, păstrate în baza de date. Oferta nu pleacă fără poze, deci
-- nu poate depinde de magazin în momentul tipăririi: poza se descarcă o dată
-- (sau se încarcă de mână) și de atunci intră în PDF din baza de date.

create table public.catalog_images (
  catalog_item_id uuid primary key references public.catalog_items (id) on delete cascade,
  org_id          uuid not null references public.organizations (id) on delete cascade,
  mime            text not null check (mime like 'image/%'),
  -- Imaginea în base64: se citește direct în pagina de tipărire, ca data: URI.
  data_b64        text not null,
  source          text not null check (source in ('magazin', 'incarcat')),
  source_url      text,
  updated_at      timestamptz not null default now()
);

comment on table public.catalog_images is
  'Poza fiecărui produs din catalog, descărcată din magazin sau încărcată de mână; intră în PDF-ul ofertei.';

alter table public.catalog_images enable row level security;

create policy "poze catalog: membrii citesc" on public.catalog_images
  for select using (public.is_member(org_id));

-- Conducerea poate înlocui sau șterge poze; restul intră prin funcția de mai jos.
create policy "poze catalog: conducerea modifică" on public.catalog_images
  for all using (public.is_org_admin(org_id)) with check (public.is_org_admin(org_id));

/**
 * Salvează poza unui produs din catalog. Orice membru poate pune poza unui
 * produs care nu are încă una (descărcată automat la prima ofertă sau încărcată
 * de agent); o poză existentă o înlocuiește doar conducerea.
 */
create or replace function public.save_catalog_image(
  p_item uuid, p_mime text, p_data text, p_source text, p_source_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
begin
  select org_id into v_org from public.catalog_items where id = p_item;
  if v_org is null or not public.is_member(v_org) then
    raise exception 'Produsul nu există sau nu e al organizației tale';
  end if;

  if exists (select 1 from public.catalog_images where catalog_item_id = p_item) then
    if not public.is_org_admin(v_org) then
      raise exception 'Produsul are deja poză; o poate înlocui doar conducerea';
    end if;
    update public.catalog_images
      set mime = p_mime, data_b64 = p_data, source = p_source, source_url = p_source_url, updated_at = now()
      where catalog_item_id = p_item;
  else
    insert into public.catalog_images (catalog_item_id, org_id, mime, data_b64, source, source_url)
    values (p_item, v_org, p_mime, p_data, p_source, p_source_url);
  end if;
end;
$$;

-- Poza unei linii libere (ce nu e în catalog), pusă de mână pe ofertă.
create table public.quote_item_images (
  quote_item_id uuid primary key references public.quote_items (id) on delete cascade,
  mime          text not null check (mime like 'image/%'),
  data_b64      text not null,
  updated_at    timestamptz not null default now()
);

comment on table public.quote_item_images is
  'Poza unei linii libere de pe ofertă, încărcată de mână; intră în PDF.';

alter table public.quote_item_images enable row level security;

-- Ca liniile ofertei: prin ofertă, după regulile ei.
create policy "poze linii: acces prin ofertă" on public.quote_item_images
  for all using (
    exists (
      select 1 from public.quote_items i join public.quotes q on q.id = i.quote_id
      where i.id = quote_item_id and public.is_member(q.org_id)
    )
  ) with check (
    exists (
      select 1 from public.quote_items i join public.quotes q on q.id = i.quote_id
      where i.id = quote_item_id and public.is_member(q.org_id)
    )
  );
