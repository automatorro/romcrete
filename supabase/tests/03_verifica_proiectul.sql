-- Verifică starea unui proiect Supabase real: ce s-a aplicat din migrații și ce lipsește.
-- Se rulează în SQL Editor, pe proiectul propriu. Nu modifică nimic — doar citește.

select 'tabele' as verificare,
       count(*)::text || ' / 7' as gasit,
       case when count(*) = 7 then 'OK' else 'LIPSESC TABELE' end as stare
from information_schema.tables
where table_schema = 'public'
  and table_name in ('organizations', 'memberships', 'clients',
                     'catalog_items', 'quotes', 'quote_items', 'quote_counters')

union all
select 'coloana organizations.created_by',
       case when count(*) = 1 then 'prezentă' else 'absentă' end,
       case when count(*) = 1 then 'OK'
            else 'LIPSEȘTE — onboarding-ul se va bloca la prima firmă' end
from information_schema.columns
where table_schema = 'public' and table_name = 'organizations' and column_name = 'created_by'

union all
select 'funcții',
       count(*)::text || ' / 4',
       case when count(*) = 4 then 'OK' else 'LIPSESC FUNCȚII' end
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_member', 'next_quote_number', 'seed_default_catalog', 'touch_updated_at')

union all
select 'view quote_totals',
       case when count(*) = 1 then 'prezent' else 'absent' end,
       case when count(*) = 1 then 'OK' else 'LIPSEȘTE — lista de oferte nu va avea totaluri' end
from pg_views where schemaname = 'public' and viewname = 'quote_totals'

union all
select 'RLS activ pe tabele',
       count(*)::text || ' / 7',
       case when count(*) = 7 then 'OK' else 'ATENȚIE — date expuse fără RLS' end
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relrowsecurity
  and c.relname in ('organizations', 'memberships', 'clients',
                    'catalog_items', 'quotes', 'quote_items', 'quote_counters')

union all
select 'politici RLS',
       count(*)::text || ' / 11',
       case when count(*) = 11 then 'OK' else 'NUMĂR NEAȘTEPTAT' end
from pg_policies where schemaname = 'public'

union all
select 'trigger updated_at',
       case when count(*) = 1 then 'prezent' else 'absent' end,
       case when count(*) = 1 then 'OK' else 'LIPSEȘTE' end
from pg_trigger where tgname = 'quotes_touch_updated_at'

order by 1;
