-- Serviciile (transport, instruire, punere în funcțiune) nu au poză: oferta
-- cere poză doar la produse. Bifa „serviciu” stă pe produsul din catalog și se
-- copiază pe linia ofertei; liniile libere o primesc la adăugare.
--
-- Scriptul se poate rula de mai multe ori fără erori.

alter table public.catalog_items add column if not exists is_service boolean not null default false;
alter table public.quote_items add column if not exists is_service boolean not null default false;

comment on column public.catalog_items.is_service is 'Serviciu: apare pe ofertă fără poză.';
comment on column public.quote_items.is_service is 'Serviciu: apare pe ofertă fără poză.';

-- Ce e deja în catalog la „Servicii” e serviciu; liniile ofertelor urmează catalogul.
update public.catalog_items set is_service = true
where not is_service and category ilike '%servici%';

update public.quote_items i set is_service = true
from public.catalog_items c
where c.id = i.catalog_item_id and c.is_service and not i.is_service;
