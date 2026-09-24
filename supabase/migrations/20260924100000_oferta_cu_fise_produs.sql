-- Oferta devine prezentare: fiecare produs cu poza și caracteristicile lui,
-- apoi tabelul de prețuri.
--
-- Pentru asta linia de ofertă trebuie să știe din ce poziție de catalog vine.
-- Până acum copia doar numele și prețul, așa că poza, tehnologia și fișa
-- tehnică rămâneau în catalog. Legătura e opțională: liniile libere n-au
-- corespondent, iar o poziție ștearsă din catalog nu strică oferta.

alter table public.catalog_items
  add column image_url text;

comment on column public.catalog_items.image_url is
  'Poza produsului pe ofertă. Goală: se ia poza principală de pe pagina din magazin (shop_url).';

alter table public.quote_items
  add column catalog_item_id uuid references public.catalog_items (id) on delete set null;

comment on column public.quote_items.catalog_item_id is
  'Poziția de catalog din care vine linia: de aici se iau poza și caracteristicile pe oferta tipărită.';

create index quote_items_catalog_item_idx on public.quote_items (catalog_item_id);

-- Liniile deja existente se leagă după nume, în catalogul aceleiași organizații.
-- Unde numele apare de mai multe ori, linia rămâne nelegată decât să ia poza greșită.
update public.quote_items qi
set catalog_item_id = ci.id
from public.quotes q, public.catalog_items ci
where q.id = qi.quote_id
  and ci.org_id = q.org_id
  and ci.name = qi.name
  and qi.catalog_item_id is null
  and (select count(*) from public.catalog_items x where x.org_id = q.org_id and x.name = qi.name) = 1;
