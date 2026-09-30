-- Importul catalogului din magazin, din aplicație.
--
-- Până acum catalogul intra printr-o migrație care îl ȘTERGEA și îl rescria.
-- Asta nu mai merge: ofertele, vizitele și pozele trimit la produse, iar
-- reparațiile făcute de mână (nume, materiale, fișe) s-ar pierde la fiecare
-- actualizare de prețuri. Importul nou recunoaște produsul după cod și după
-- pagina lui din magazin, adaugă ce lipsește și actualizează doar prețul și
-- codul. Nu șterge nimic: ce nu mai apare în magazin se poate dezactiva.
--
-- Scriptul se poate rula de mai multe ori fără erori.

alter table public.catalog_items add column if not exists shop_seen_at timestamptz;

comment on column public.catalog_items.shop_seen_at is
  'Ultima dată când importul a găsit produsul în magazin; gol = n-a fost văzut de import.';

-- Importul caută produsele după pagina din magazin.
create index if not exists catalog_items_shop_url_idx on public.catalog_items (org_id, shop_url);
