-- WhatsApp ca fel de contact în istoricul firmei: oferta trimisă pe WhatsApp
-- se notează singură, iar agentul poate nota și o discuție purtată acolo.

alter table public.client_activities drop constraint client_activities_kind_check;

alter table public.client_activities add constraint client_activities_kind_check check (kind in (
  'telefon', 'email', 'whatsapp', 'intalnire', 'nota',
  'pas_amanat', 'pas_inchis', 'oferta_creata', 'oferta_stare'
));
