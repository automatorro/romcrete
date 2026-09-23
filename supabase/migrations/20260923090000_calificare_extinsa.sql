-- Calificarea completă: de la „vrea?” la „poate?”.
--
-- Setul de întrebări măsura bine atitudinea și deloc aritmetica. Nu se putea
-- răspunde la întrebările care hotărăsc o investiție de capital: îi iese la bani,
-- are unde folosi utilajul, are cerere pentru capacitatea în plus, poate plăti.

-- ------------------------------------------- valori numerice pe opțiuni

-- O opțiune poate purta o valoare folosită în calcule: „15–25 lei/mp” → 20.
-- Se schimbă din aplicație, fără migrație, când realitatea din teren o cere.
alter table public.question_options
  add column value numeric(10,2);

comment on column public.question_options.value is
  'Valoarea numerică folosită în calcule (ex. mijlocul intervalului de preț). Null = nu intră în calcul.';

-- Intervalele existente de suprafață primesc valori, ca să poată intra în amortizare.
update public.question_options set value = 20  where group_id = 'supr' and id = 'm30';
update public.question_options set value = 45  where group_id = 'supr' and id = 'm60';
update public.question_options set value = 80  where group_id = 'supr' and id = 'm100';
update public.question_options set value = 120 where group_id = 'supr' and id = 'm100p';

-- ------------------------------------- ipotezele de calcul ale firmei

alter table public.organizations
  -- De câte ori se aplică mai mult material mecanizat față de manual.
  -- Ipoteză explicită, nu cifră ascunsă în cod: se corectează din Setări.
  add column productivity_factor     numeric(4,2) not null default 2.5,
  add column working_days_per_month  integer      not null default 21;

comment on column public.organizations.productivity_factor is
  'Randamentul mecanizat față de manual, folosit la calculul amortizării.';

-- ------------------------------------------------ întrebările noi

-- „Cine a fost prezent” iese din secțiunea de 20 de secunde: costă șapte bifări
-- și nu mută nimic în decizia de vânzare.
update public.question_sections set title = 'Context, întrebare pentru owner și etapă' where id = 'F';
update public.question_groups set section_id = 'F', position = 30 where id = 'prezenti';

insert into public.question_groups
  (id, section_id, label, kind, allows_note, options_source, counts_for_priority, position)
values
  ('santier',  'B', 'Condiții pe șantier',                    'multi',  true,  null, false, 10),
  ('refuzat',  'C', 'A refuzat lucrări în ultimele 3 luni',   'single', true,  null, false, 14),
  ('oameni',   'C', 'Găsește oameni',                         'single', true,  null, false, 15),
  ('utilaj',   'C', 'Ce utilaj are acum și de când',          'single', true,  null, false, 16),
  ('manopera', 'D', 'Cât ia pe mp',                           'single', true,  null, false, 21),
  ('plata',    'E', 'Cum ar plăti',                           'single', true,  null, false, 26);

insert into public.question_options (group_id, id, label, position, value) values
  -- Unde se poate folosi utilajul. „Fără curent” e cel mai frecvent motiv pentru
  -- care o pompă electrică nu poate fi vândută — și motivul pentru generator.
  ('santier', '230v',       'Are curent 230V',              1, null),
  ('santier', 'trifazic',   'Are trifazic',                 2, null),
  ('santier', 'faracurent', 'Șantiere fără curent',         3, null),
  ('santier', 'distanta',   'Pompare peste 20 m',           4, null),
  ('santier', 'etaj',       'Lucrează la etaj 3 sau mai sus',5, null),
  ('santier', 'acces',      'Acces greu / spațiu strâmt',   6, null),

  -- Faptul, nu dorința: dacă refuză lucrări, viteza se transformă direct în bani.
  ('refuzat', 'des',        'Da, des',                      1, null),
  ('refuzat', 'cateva',     'Da, o dată sau de două ori',   2, null),
  ('refuzat', 'nu',         'Nu',                           3, null),
  ('refuzat', 'naflat',     'Nu am aflat',                  4, null),

  -- Criza de personal e cel mai bun argument de mecanizare din piața asta.
  ('oameni',  'usor',       'Găsește ușor',                 1, null),
  ('oameni',  'greu',       'Găsește greu',                 2, null),
  ('oameni',  'imposibil',  'Nu găsește deloc',             3, null),
  ('oameni',  'naflat',     'Nu am aflat',                  4, null),

  -- Cel mai probabil client e cel care are deja o mașină care moare.
  ('utilaj',  'niciodata',  'N-a avut niciodată',           1, null),
  ('utilaj',  'sub2',       'Are, mai nouă de 2 ani',       2, null),
  ('utilaj',  'ani25',      'Are, între 2 și 5 ani',        3, null),
  ('utilaj',  'peste5',     'Are, mai veche de 5 ani',      4, null),
  ('utilaj',  'renuntat',   'A avut și a renunțat',         5, null),
  ('utilaj',  'naflat',     'Nu am aflat',                  6, null),

  -- Numărul fără de care nu se poate calcula amortizarea.
  -- Valorile sunt mijlocul intervalului; se corectează din aplicație.
  ('manopera', 'sub15',     'Sub 15 lei/mp',                1, 12),
  ('manopera', 'lei1525',   '15–25 lei/mp',                 2, 20),
  ('manopera', 'lei2540',   '25–40 lei/mp',                 3, 32),
  ('manopera', 'peste40',   'Peste 40 lei/mp',              4, 48),
  ('manopera', 'forfetar',  'Dă forfetar, nu pe mp',        5, null),
  ('manopera', 'naflat',    'Nu am aflat',                  6, null),

  ('plata',   'cash',       'Din banii firmei',             1, null),
  ('plata',   'rate',       'Rate sau leasing',             2, null),
  ('plata',   'fonduri',    'Fonduri europene',             3, null),
  ('plata',   'nustie',     'Nu știe încă',                 4, null),
  ('plata',   'nupoate',    'Nu poate acum',                5, null);

-- ------------------------------------------- a doua axă: fezabilitatea

-- Prioritatea măsoară apetitul: vrea? Fezabilitatea măsoară posibilitatea:
-- poate plăti, are unde folosi, are cerere pentru capacitatea în plus.
-- Fără ea, un om entuziasmat fără curent pe șantier și fără bani iese „A”,
-- iar agentul se întoarce la el a treia oară convins că e aproape.
create or replace function public.client_feasibility(a jsonb)
returns text
language sql
immutable
as $$
  with c as (
    select
      case a ->> 'plata'
        when 'cash' then 2 when 'rate' then 2 when 'fonduri' then 1
        when 'nupoate' then 0 end as plata,
      case
        -- Cheia lipsă trebuie tratată explicit: jsonb_typeof(null) e null, nu 'null',
        -- deci o comparație obișnuită ar cădea pe ramura implicită.
        when a -> 'santier' is null
          or jsonb_typeof(a -> 'santier') <> 'array'
          or jsonb_array_length(a -> 'santier') = 0
          then null
        when (a -> 'santier') ? '230v' or (a -> 'santier') ? 'trifazic' then 2
        when (a -> 'santier') ? 'faracurent' then 0
        else 1 end as santier,
      case a ->> 'refuzat'
        when 'des' then 2 when 'cateva' then 1 when 'nu' then 0 end as cerere
  ), t as (
    select
      (plata is not null)::int + (santier is not null)::int + (cerere is not null)::int as n,
      coalesce(plata, 0) + coalesce(santier, 0) + coalesce(cerere, 0) as sc
    from c
  )
  -- Media pe criteriile chiar completate, nu suma: altfel cineva care a răspuns
  -- la două din trei ar fi penalizat pentru întrebarea nepusă.
  select case
    when n < 2 then '?'
    when sc::numeric / n >= 1.5 then 'da'
    when sc::numeric / n >= 0.75 then 'blocaj'
    else 'nu'
  end
  from t;
$$;

-- Cele două axe împreună spun ce e de făcut cu firma, nu doar cât e de caldă.
create or replace function public.client_focus(a jsonb)
returns text
language sql
immutable
as $$
  select case
    when public.client_priority(a) = '?' or public.client_feasibility(a) = '?' then 'necunoscut'
    when public.client_priority(a) in ('A', 'B') and public.client_feasibility(a) = 'da' then 'urmareste'
    when public.client_priority(a) in ('A', 'B') then 'deblocheaza'
    when public.client_feasibility(a) = 'da' then 'educa'
    else 'lasa'
  end;
$$;

comment on function public.client_focus(jsonb) is
  'urmareste = vrea și poate · deblocheaza = vrea, dar ceva îl oprește · educa = poate, dar nu vede încă rostul · lasa = niciuna';

-- View-ul expune ambele axe și cadranul.
drop view public.client_state;

create view public.client_state
with (security_invoker = on)
as
select
  c.id                as client_id,
  c.org_id,
  c.owner_agent_id,
  c.name,
  c.trade_type,
  c.city,
  c.phone,
  a.answers,
  a.answers ->> 'etapa'   as stage,
  a.answers ->> 'interes' as interest,
  public.client_priority(a.answers)    as priority,
  public.client_feasibility(a.answers) as feasibility,
  public.client_focus(a.answers)       as focus,
  v.visit_count,
  v.last_visit,
  case when ns.next_step_done_at is null then ns.step      end as next_step,
  case when ns.next_step_done_at is null then ns.step_date end as next_step_date,
  case when ns.next_step_done_at is null then ns.visit_id  end as next_step_visit_id,
  (ns.next_step_done_at is null and ns.step_date is not null and ns.step_date < current_date) as next_step_late,
  e.pending_escalations
from public.clients c
cross join lateral (select public.merge_visit_answers(c.id) as answers) a
left join lateral (
  select count(*) as visit_count, max(visit_date) as last_visit
  from public.visits v where v.client_id = c.id
) v on true
left join lateral (
  select v.id as visit_id, v.answers ->> 'urmator' as step,
         v.next_step_date as step_date, v.next_step_done_at
  from public.visits v
  where v.client_id = c.id
    and (v.answers ? 'urmator' or v.next_step_date is not null)
  order by v.visit_date desc, v.created_at desc
  limit 1
) ns on true
left join lateral (
  select count(*) as pending_escalations
  from public.visits v
  where v.client_id = c.id
    and jsonb_typeof(v.answers -> 'esc') = 'array'
    and jsonb_array_length(v.answers -> 'esc') > 0
    and v.escalation_done_at is null
) e on true;

-- ------------------------------ pragurile, schimbabile din aplicație

-- Valorile din intervale sunt ipoteze despre piață, nu adevăruri: pragul de
-- manoperă pe mp diferă între Timiș și Vaslui, și se schimbă de la an la an.
-- Conducerea le corectează din Setări, fără migrație.
create or replace function public.is_any_org_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = auth.uid() and m.role in ('owner', 'admin')
  );
$$;

create policy "opțiuni: conducerea corectează valorile" on public.question_options
  for update to authenticated
  using (public.is_any_org_admin())
  with check (public.is_any_org_admin());
