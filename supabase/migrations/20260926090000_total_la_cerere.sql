-- Totalul de la finalul ofertei, la cerere. Implicit fiecare produs are prețul
-- lui și oferta nu le adună (clientul alege unul); când clientul vrea toate
-- produsele, agentul pornește totalul: recapitulare plus total de plată.

alter table public.quotes
  add column show_total boolean not null default false;

comment on column public.quotes.show_total is
  'Oferta arată la final recapitularea și totalul tuturor produselor. Implicit nu.';
