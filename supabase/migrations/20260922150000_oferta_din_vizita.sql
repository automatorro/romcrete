-- Leagă oferta de vizita din care a pornit.
--
-- Fără legătura asta nu se poate răspunde la întrebarea care contează pentru
-- conducere: din câte vizite iese o ofertă și din câte oferte iese un client.

alter table public.quotes
  add column visit_id uuid references public.visits (id) on delete set null;

create index quotes_visit_idx on public.quotes (visit_id);

comment on column public.quotes.visit_id is
  'Vizita de teren din care a pornit oferta. Null pentru ofertele făcute direct de la birou.';
