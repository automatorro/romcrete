-- Cursul EUR cu care se tipărește oferta.
--
-- Gol: oferta folosește cursul BNR al zilei în care e deschisă. Completat:
-- oferta rămâne la cursul negociat sau la cel din ziua emiterii, oricând ar fi
-- retipărită — și iese cu prețuri în euro chiar dacă BNR nu răspunde.

alter table public.quotes
  add column eur_rate numeric(10,4) check (eur_rate is null or eur_rate > 0);

comment on column public.quotes.eur_rate is
  'Lei pentru 1 EUR pe oferta tipărită. Null: cursul BNR al zilei.';
