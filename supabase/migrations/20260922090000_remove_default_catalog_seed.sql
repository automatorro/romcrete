-- Elimină catalogul implicit.
--
-- Funcția popula fiecare firmă nouă cu produse de betoane (clase de beton, șape,
-- mortar), presupuse greșit la construirea aplicației. O firmă nouă începe cu
-- catalogul gol și își importă propriile produse.

drop function if exists public.seed_default_catalog(uuid);
