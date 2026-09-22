-- Ce migrații are înregistrate proiectul. Se rulează separat, în SQL Editor.
-- Dacă dă eroare că schema nu există, înseamnă că migrațiile au fost aplicate
-- manual (din SQL Editor), nu prin CLI sau prin integrarea GitHub.
select version, name
from supabase_migrations.schema_migrations
order by version;
