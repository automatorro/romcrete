-- Catalogul păstrează tot ce știm despre un produs, nu doar prețul.
--
-- La primul import am reținut doar denumirea, prețul și o descriere, iar
-- materialele compatibile cu fiecare pompă s-au pierdut. Fără ele nu se poate
-- răspunde la întrebarea de pe teren: „meseriașul lucrează cu glet și termosistem
-- — ce pompă îi trebuie?”

alter table public.catalog_items
  -- { "certain": [...], "equivalent": [...] } — certe vin din fișa produsului,
  -- echivalentele sunt deduse după consistență și cer confirmare tehnică.
  add column materials      jsonb not null default '{"certain": [], "equivalent": []}'::jsonb,
  -- Airless / Rotor-Stator / Air-Assisted / HVLP / Bicomponent
  add column tech_type      text,
  add column shop_url       text,
  -- Presiune, debit, motor, pistol și furtun livrate, variante de accesoriu.
  add column details        jsonb not null default '{}'::jsonb,
  -- Prețul afișat în magazin, păstrat ca să se poată verifica conversia fără TVA.
  add column price_with_vat numeric(12,2);

create index catalog_items_materials_idx on public.catalog_items using gin (materials);
create index catalog_items_tech_idx on public.catalog_items (org_id, tech_type);

comment on column public.catalog_items.materials is
  'Materialele pe care le aplică echipamentul: certain = din fișa produsului, equivalent = dedus, de confirmat tehnic.';
comment on column public.catalog_items.price_with_vat is
  'Prețul din magazin, cu TVA. unit_price rămâne prețul fără TVA, folosit pe ofertă.';
