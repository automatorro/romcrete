-- Fișa produsului luată din magazin: când un produs din catalog n-are încă
-- textele scrise (prezentare, conține, avantaje, recomandări, aplicații), ele
-- se iau din descrierea lui de pe shop.romcrete.ro la prima ofertă și se
-- păstrează în catalog pentru ofertele următoare.
--
-- Catalogul îl modifică doar conducerea; funcția de mai jos lasă orice membru
-- să completeze doar câmpurile goale, fără să schimbe ce a scris cineva.
-- Scriptul se poate rula de mai multe ori fără erori.

create or replace function public.fill_catalog_sheet(
  p_item uuid,
  p_intro text,
  p_package_contents text,
  p_benefits text,
  p_recommendations text,
  p_applications text
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

  update public.catalog_items set
    intro            = coalesce(nullif(trim(intro), ''), nullif(trim(p_intro), '')),
    package_contents = coalesce(nullif(trim(package_contents), ''), nullif(trim(p_package_contents), '')),
    benefits         = coalesce(nullif(trim(benefits), ''), nullif(trim(p_benefits), '')),
    recommendations  = coalesce(nullif(trim(recommendations), ''), nullif(trim(p_recommendations), '')),
    applications     = coalesce(nullif(trim(applications), ''), nullif(trim(p_applications), ''))
  where id = p_item;
end;
$$;
