-- Catalog implicit pentru o organizație nouă (produse uzuale de beton și servicii).
-- Apelat o singură dată, la onboarding.

create or replace function public.seed_default_catalog(p_org uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_member(p_org) then
    raise exception 'Acces interzis pentru organizația %', p_org;
  end if;

  if exists (select 1 from public.catalog_items where org_id = p_org) then
    return; -- catalogul are deja produse, nu suprascriem nimic
  end if;

  insert into public.catalog_items (org_id, sku, name, description, category, unit, unit_price, vat_rate)
  values
    (p_org, 'C8/10',  'Beton C8/10',  'Beton de egalizare, clasa C8/10',          'Beton',   'mc',  310.00, 21),
    (p_org, 'C12/15', 'Beton C12/15', 'Beton simplu, clasa C12/15',               'Beton',   'mc',  330.00, 21),
    (p_org, 'C16/20', 'Beton C16/20', 'Beton armat, clasa C16/20',                'Beton',   'mc',  355.00, 21),
    (p_org, 'C20/25', 'Beton C20/25', 'Beton armat, clasa C20/25',                'Beton',   'mc',  375.00, 21),
    (p_org, 'C25/30', 'Beton C25/30', 'Beton armat, clasa C25/30',                'Beton',   'mc',  400.00, 21),
    (p_org, 'C30/37', 'Beton C30/37', 'Beton armat, clasa C30/37',                'Beton',   'mc',  430.00, 21),
    (p_org, 'SAP-1',  'Șapă autonivelantă', 'Șapă autonivelantă, grosime 5 cm',   'Șape',    'mp',   45.00, 21),
    (p_org, 'MRT-M100', 'Mortar M100', 'Mortar de zidărie M100',                  'Mortar',  'mc',  280.00, 21),
    (p_org, 'TRANSP', 'Transport autobetonieră', 'Transport beton, tarif pe km',  'Servicii','km',    8.50, 21),
    (p_org, 'POMPA',  'Pompă de beton',  'Închiriere pompă de beton, tarif orar', 'Servicii','ora', 450.00, 21),
    (p_org, 'ADITIV', 'Aditiv antiîngheț', 'Aditiv antiîngheț pentru beton',      'Aditivi', 'mc',   25.00, 21),
    (p_org, 'MANOP',  'Manoperă turnare', 'Manoperă turnare și vibrare beton',    'Servicii','mc',   60.00, 21);
end;
$$;
