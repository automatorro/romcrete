-- Viteza: starea firmelor (client_state) se calcula de mai multe ori pe rând.
--
-- 1. Planificatorul „desfăcea” subinterogarea cu răspunsurile adunate și chema
--    merge_visit_answers o dată pentru fiecare coloană care le folosea (de ~8
--    ori pe firmă). OFFSET 0 le calculează o singură dată.
-- 2. client_focus recalcula prioritatea și fezabilitatea de până la 5 ori;
--    acum fiecare se calculează o dată, iar focusul se deduce din ele.
-- 3. Vizitele unei firme se citeau în trei subinterogări, cu regulile de acces
--    verificate la fiecare vizită. Acum se citesc într-o funcție care verifică
--    accesul o dată pe firmă, cu aceeași regulă ca tabelul clients.
--
-- Coloanele vederii și rezultatele rămân identice. Scriptul se poate rula de
-- mai multe ori fără erori.

-- ------------------------------------------------ focusul, din cele două axe

create or replace function public.focus_from(p_priority text, p_feasibility text)
returns text
language sql
immutable
as $$
  select case
    when p_priority = '?' or p_feasibility = '?' then 'necunoscut'
    when p_priority in ('A', 'B') and p_feasibility = 'da' then 'urmareste'
    when p_priority in ('A', 'B') then 'deblocheaza'
    when p_feasibility = 'da' then 'educa'
    else 'lasa'
  end;
$$;

create or replace function public.client_focus(a jsonb)
returns text
language sql
immutable
as $$
  select public.focus_from(public.client_priority(a), public.client_feasibility(a));
$$;

-- ------------------------------------------------ accesul, verificat o dată pe firmă

-- Aceeași regulă ca politica tabelului clients: conducerea vede tot, agentul
-- firmele lui. Cine vede firma îi vede și toate vizitele (politica visits).
create or replace function public.can_see_client(p_client uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.clients c
    where c.id = p_client
      and public.is_member(c.org_id)
      and (public.is_org_admin(c.org_id) or c.owner_agent_id = auth.uid())
  );
$$;

-- Răspunsurile tuturor vizitelor unei firme, adunate. Rulează ca proprietar,
-- deci nu verifică accesul la fiecare vizită, ci o dată, la început.
create or replace function public.merge_visit_answers(p_client uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row record;
  v_key text;
  v_val jsonb;
  v_acc jsonb := '{}'::jsonb;
begin
  if not public.can_see_client(p_client) then
    return v_acc;
  end if;

  for v_row in
    select answers from public.visits
    where client_id = p_client
    order by visit_date, created_at
  loop
    for v_key, v_val in select * from jsonb_each(coalesce(v_row.answers, '{}'::jsonb)) loop
      if jsonb_typeof(v_val) = 'array' then
        v_acc := jsonb_set(v_acc, array[v_key], (
          select coalesce(jsonb_agg(distinct e), '[]'::jsonb)
          from jsonb_array_elements(coalesce(v_acc -> v_key, '[]'::jsonb) || v_val) e
        ));
      elsif v_val is not null and v_val <> 'null'::jsonb and v_val <> '""'::jsonb then
        v_acc := jsonb_set(v_acc, array[v_key], v_val);
      end if;
    end loop;
  end loop;
  return v_acc;
end;
$$;

-- Ce trebuie știut din vizitele unei firme, citit o dată: câte sunt, ultima,
-- pasul următor deschis și întrebările tehnice în așteptare.
create or replace function public.client_visit_state(p_client uuid)
returns table (
  visit_count bigint,
  last_visit date,
  ns_visit_id uuid,
  ns_step text,
  ns_step_date date,
  ns_done_at timestamptz,
  pending_escalations bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select v.cnt, v.last, ns.id, ns.step, ns.step_date, ns.done_at, e.cnt
  from (select public.can_see_client(p_client) as ok) guard
  cross join lateral (
    select count(*) as cnt, max(visit_date) as last
    from public.visits where client_id = p_client
  ) v
  left join lateral (
    select x.id, x.answers ->> 'urmator' as step, x.next_step_date as step_date, x.next_step_done_at as done_at
    from public.visits x
    where x.client_id = p_client
      and (x.answers ? 'urmator' or x.next_step_date is not null)
    order by x.visit_date desc, x.created_at desc
    limit 1
  ) ns on true
  cross join lateral (
    select count(*) as cnt
    from public.visits x
    where x.client_id = p_client
      and jsonb_typeof(x.answers -> 'esc') = 'array'
      and jsonb_array_length(x.answers -> 'esc') > 0
      and x.escalation_done_at is null
  ) e
  where guard.ok;
$$;

-- ------------------------------------------------ vederea, cu aceleași coloane

drop view if exists public.client_state;

create view public.client_state
with (security_invoker = on)
as
select
  c.id                as client_id,
  c.org_id,
  c.owner_agent_id,
  c.name,
  c.trade_type,
  c.domain,
  c.city,
  c.phone,
  a.answers,
  a.answers ->> 'etapa'   as stage,
  a.answers ->> 'interes' as interest,
  sc.priority,
  sc.feasibility,
  fo.focus,
  coalesce(s.visit_count, 0) as visit_count,
  s.last_visit,
  case when s.ns_done_at is null then s.ns_step      end as next_step,
  case when s.ns_done_at is null then s.ns_step_date end as next_step_date,
  case when s.ns_done_at is null then s.ns_visit_id  end as next_step_visit_id,
  (s.ns_done_at is null and s.ns_step_date is not null and s.ns_step_date < current_date) as next_step_late,
  coalesce(s.pending_escalations, 0) as pending_escalations,
  w.is_warm,
  case
    when s.last_visit is null then null
    else s.last_visit + (case when w.is_warm then o.recontact_days_warm else o.recontact_days_cold end)
  end as recontact_due,
  (
    (s.ns_visit_id is null or s.ns_done_at is not null)
    and s.last_visit is not null
    and s.last_visit + (case when w.is_warm then o.recontact_days_warm else o.recontact_days_cold end)
        <= current_date
  ) as needs_recontact,
  c.contact_person,
  c.cui,
  c.reg_com,
  c.email,
  c.address,
  c.county
from public.clients c
join public.organizations o on o.id = c.org_id
-- OFFSET 0 împiedică planificatorul să recalculeze subinterogarea în fiecare coloană.
cross join lateral (select public.merge_visit_answers(c.id) as answers offset 0) a
cross join lateral (
  select public.client_priority(a.answers) as priority, public.client_feasibility(a.answers) as feasibility
  offset 0
) sc
cross join lateral (select public.focus_from(sc.priority, sc.feasibility) as focus offset 0) fo
cross join lateral (
  select (a.answers ->> 'interes' in ('oferta', 'gata') or fo.focus = 'urmareste') as is_warm
) w
left join lateral public.client_visit_state(c.id) s on true;
