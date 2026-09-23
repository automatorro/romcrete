-- Pozițiile ascunse din catalog: 31 de pompe existau în bază, dar nu se vedeau.
--
-- La import am marcat `is_active = false` tot ce venea fără preț sau cu numele
-- tăiat, ca să nu ajungă așa pe o ofertă. Efectul a fost mai rău decât problema:
-- la marcaje rutiere TOATE cele 12 pompe LineLazer erau fără preț în sursă,
-- deci categoria întreagă a dispărut din catalog. La fel spuma poliuretanică,
-- cu toate cele 6 Reactor. Agentul care intra la o firmă de marcaje nu avea ce
-- să-i arate, deși pompele erau acolo.
--
-- Corect e invers: pompa se vede și se discută, iar prețul lipsă se spune ca
-- atare. „Preț la cerere” e un răspuns normal pentru un LineLazer sau un
-- Reactor, care oricum se configurează la comandă. Ce nu e normal e un zero
-- afișat ca preț, așa că devine o stare explicită, nu o cifră.
--
-- Corectura stă într-o funcție, nu în UPDATE-uri libere, dintr-un motiv practic:
-- migrația de import șterge și rescrie catalogul. Dacă mâine se încarcă
-- prețurile noi, corecturile s-ar pierde tăcut, iar marcajele ar dispărea din
-- nou. De aceea ORICE migrație viitoare care reîncarcă catalogul se încheie cu:
--
--     select public.catalog_repara_pozitiile();

alter table public.catalog_items
  add column price_on_request boolean not null default false;

comment on column public.catalog_items.price_on_request is
  'Prețul se stabilește la comandă. unit_price rămâne 0 și nu se afișează ca preț.';

create or replace function public.catalog_repara_pozitiile()
returns text
language plpgsql
as $$
declare
  v_nume     int;
  v_cerere   int;
  v_activate int;
begin
  -- Șapte poziții aveau preț și cod, dar numele ciuntit la import — li se tăiase
  -- începutul („a airless Graco King E-Max…”, „bare”, „pentru textura Big 150”).
  -- Le refac din adresa produsului din magazin, singura sursă sigură de aici,
  -- în stilul celorlalte poziții din aceeași categorie.
  update public.catalog_items set name = case sku
      when '2009106' then 'King E-Max XT 40:1 - aplicare materiale anticorozive'
      when '2009108' then 'King E-Max XT 60:1 completă - aplicare materiale anticorozive'
      when '2009110' then 'King E-Max XT 70:1 - aplicare materiale anticorozive'
      when '2009122' then 'King E-Max XT 70:1, Big 150 - aplicare materiale anticorozive'
      when '2009101' then 'King E-Max XT 40:1, bare'
      when '2009117' then 'King E-Max XT 40:1, echipată complet pentru textură'
      when '2009129' then 'King E-Max XT 70:1, pentru textură Big 150'
      when '2009116' then 'King E-Max XT 40, textură completă'
    end
  where sku in ('2009106','2009108','2009110','2009122','2009101','2009117','2009129','2009116');
  get diagnostics v_nume = row_count;

  -- Motivele stăteau în descriere, ca avertisment pentru mine. Acum unul stă în
  -- coloană și celălalt e rezolvat, deci descrierea se întoarce la ce e:
  -- la ce folosește pompa.
  update public.catalog_items
  set description = nullif(trim(
        replace(
          replace(description, '⚠ FĂRĂ PREȚ ÎN SURSĂ — de completat.', ''),
          '⚠ DENUMIRE INCOMPLETĂ LA IMPORT — de corectat.', '')), '')
  where description like '⚠%';

  update public.catalog_items
  set price_on_request = (unit_price = 0)
  where price_on_request <> (unit_price = 0);
  get diagnostics v_cerere = row_count;

  update public.catalog_items set is_active = true where not is_active;
  get diagnostics v_activate = row_count;

  return format('%s nume refăcute, %s poziții cu preț la cerere, %s reactivate',
                v_nume, v_cerere, v_activate);
end;
$$;

comment on function public.catalog_repara_pozitiile() is
  'Corecturile de import ale catalogului. Se cheamă la finalul oricărei migrații care reîncarcă catalogul.';

do $$
begin
  raise notice 'Catalog: %', public.catalog_repara_pozitiile();
end $$;
