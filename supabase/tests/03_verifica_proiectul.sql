-- Verifică starea unui proiect Supabase real: ce s-a aplicat din migrații și ce lipsește.
-- Se rulează în SQL Editor, pe proiectul propriu. Nu modifică nimic — doar citește.

select 'tabele' as verificare,
       count(*)::text || ' / 13' as gasit,
       case when count(*) = 13 then 'OK' else 'LIPSESC TABELE' end as stare
from information_schema.tables
where table_schema = 'public' and table_type = 'BASE TABLE'

union all
select 'RLS activ pe toate tabelele',
       count(*)::text || ' / 13',
       case when count(*) = 13 then 'OK' else 'ATENȚIE — date expuse fără RLS' end
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relrowsecurity

union all
select 'politici RLS',
       count(*)::text || ' / 19',
       case when count(*) = 19 then 'OK' else 'NUMĂR NEAȘTEPTAT' end
from pg_policies where schemaname = 'public'

union all
select 'funcții',
       count(*)::text || ' / 7',
       case when count(*) = 7 then 'OK' else 'LIPSESC FUNCȚII' end
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('is_member', 'is_org_admin', 'next_quote_number', 'touch_updated_at',
                    'merge_visit_answers', 'client_priority', 'accept_invitation')

union all
select 'view-uri (quote_totals, client_state)',
       count(*)::text || ' / 2',
       case when count(*) = 2 then 'OK' else 'LIPSEȘTE UN VIEW' end
from pg_views where schemaname = 'public' and viewname in ('quote_totals', 'client_state')

union all
select 'coloana organizations.created_by',
       case when count(*) = 1 then 'prezentă' else 'absentă' end,
       case when count(*) = 1 then 'OK'
            else 'LIPSEȘTE — onboarding-ul se va bloca la prima firmă' end
from information_schema.columns
where table_schema = 'public' and table_name = 'organizations' and column_name = 'created_by'

union all
select 'catalogul de întrebări',
       (select count(*) from public.question_sections)::text || ' secțiuni, ' ||
       (select count(*) from public.question_groups)::text  || ' grupuri, ' ||
       (select count(*) from public.question_options)::text || ' opțiuni',
       case when (select count(*) from public.question_sections) = 6
             and (select count(*) from public.question_groups)  = 25
             and (select count(*) from public.question_options) = 125
            then 'OK' else 'INCOMPLET' end

union all
select 'trigger updated_at (oferte, vizite)',
       count(*)::text || ' / 2',
       case when count(*) = 2 then 'OK' else 'LIPSEȘTE' end
from pg_trigger where tgname in ('quotes_touch_updated_at', 'visits_touch_updated_at')

order by 1;
