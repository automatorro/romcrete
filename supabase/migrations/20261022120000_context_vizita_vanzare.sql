-- Răspunsul despre lucrările refuzate rămâne context de piață. Pentru calcul
-- folosim o întrebare separată, care confirmă cauza: lipsa oamenilor/capacității.
insert into public.question_groups
  (id, section_id, label, kind, allows_note, options_source, counts_for_priority, position)
values
  ('capacitate', 'C', 'A pierdut lucrări din lipsă de oameni sau capacitate?', 'single', true, null, false, 17),
  ('alimentare', 'B', 'Ce variantă de alimentare se potrivește lucrării discutate?', 'single', true, null, false, 10);

update public.question_groups
set position = 11,
  label = 'Ce condiții de lucru întâlnește în general?'
where id = 'santier';

update public.question_groups
set domains = array['constructii', 'industrial', 'ignifugare', 'izolatii', 'marcaje', 'lemn', 'auto', 'injectari']
where id = 'alimentare';

insert into public.question_options (group_id, id, label, position) values
  ('capacitate', 'des', 'Da, des', 1),
  ('capacitate', 'cateva', 'Da, o dată sau de două ori', 2),
  ('capacitate', 'nu', 'Nu', 3),
  ('capacitate', 'naflat', 'Nu am aflat', 4),
  ('alimentare', '230v', 'Monofazic, 230 V', 1),
  ('alimentare', 'trifazic', 'Trifazic', 2),
  ('alimentare', 'generator', 'Generator disponibil', 3),
  ('alimentare', 'benzina', 'Utilaj cu motor pe benzină', 4),
  ('alimentare', 'faracurent', 'Nu există o sursă externă (rețea sau generator)', 5),
  ('alimentare', 'naflat', 'Nu am aflat', 6);

-- Aceste opțiuni descriu ansamblul șantierelor firmei, nu lucrarea punctuală
-- pentru care se calculează fezabilitatea.
update public.question_options
set label = case id
  when '230v' then 'Întâlnește și șantiere cu 230 V'
  when 'trifazic' then 'Întâlnește și șantiere trifazice'
  when 'faracurent' then 'Întâlnește și șantiere fără curent'
end
where group_id = 'santier'
  and id in ('230v', 'trifazic', 'faracurent');

-- „Nu acum” era folosit ca etapă pierdută, dar înseamnă amânare. Păstrăm
-- răspunsul istoric ca oportunitate amânată și rezervăm „pierdut” pentru pierderi reale.
update public.question_options
set label = 'Pierdut / nu se mai urmărește'
where group_id = 'etapa' and id = 'pierdut';

insert into public.question_options (group_id, id, label, position)
values ('etapa', 'amanat', 'Nu acum; reia discuția la data stabilită', 8);

update public.visits
set answers = jsonb_set(answers, '{etapa}', '"amanat"'::jsonb)
where answers ->> 'etapa' = 'pierdut';

create or replace function public.client_priority(a jsonb)
returns text
language sql
immutable
as $$
  with c as (
    select
      case a ->> 'interes'
        when 'nu' then 0 when 'curios' then 1 when 'vezi' then 2
        when 'oferta' then 3 when 'gata' then 4 end as interes,
      case a ->> 'decide'
        when 'singur' then 2 when 'influ' then 1 when 'nu' then 0 end as decide,
      case a ->> 'volum'
        when 'l12' then 0 when 'l35' then 1 when 'l6' then 2 end as volum,
      case a ->> 'cand'
        when 'acum' then 2 when 'l13' then 1 when 'l3p' then 0 end as cand
  ), t as (
    select
      (interes is not null)::int + (decide is not null)::int
        + (volum is not null)::int + (cand is not null)::int as n,
      coalesce(interes, 0) + coalesce(decide, 0)
        + coalesce(volum, 0) + coalesce(cand, 0) as sc
    from c
  )
  select case when n < 3 then '?' when sc >= 8 then 'A' when sc >= 5 then 'B' else 'C' end
  from t;
$$;

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
      case a ->> 'capacitate'
        when 'des' then 2 when 'cateva' then 1 when 'nu' then 0
      end as capacitate
  ), t as (
    select
      (plata is not null)::int + (capacitate is not null)::int as n,
      coalesce(plata, 0) + coalesce(capacitate, 0) as sc
    from c
  )
  select case
    when n < 2 then '?'
    when sc::numeric / n >= 1.5 then 'da'
    when sc::numeric / n >= 0.75 then 'blocaj'
    else 'nu'
  end
  from t;
$$;

comment on function public.client_priority(jsonb) is
  'Apetitul de cumpărare: interes, rol în decizie, volum și termen. Beneficiile dorite nu cresc scorul.';

comment on function public.client_feasibility(jsonb) is
  'Fezabilitatea: modalitatea de plată și cererea pierdută din lipsă de capacitate. Alimentarea este context pentru alegerea utilajului, nu un blocaj comercial.';

update public.question_groups
set counts_for_priority = false
where id = 'atragere';