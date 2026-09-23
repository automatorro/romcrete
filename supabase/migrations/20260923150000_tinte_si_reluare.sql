-- Ținte, progres și firme de reluat: aplicația trece de la carnet la organizator.
--
-- Până acum agentul primea o listă. Nu avea „ce am de făcut azi”, nu știa unde
-- stă față de așteptări, iar firmele fără pas următor cădeau la fundul listei —
-- exact cele de care nu se mai ocupa nimeni.

alter table public.organizations
  add column target_visits_per_day    integer not null default 5,
  add column target_quotes_per_month  integer not null default 10,
  -- O firmă caldă se răcește în două săptămâni; una rece poate aștepta o lună.
  add column recontact_days_warm      integer not null default 7,
  add column recontact_days_cold      integer not null default 30;

comment on column public.organizations.recontact_days_warm is
  'După câte zile fără contact revine în listă o firmă caldă (vrea ofertă, e gata, sau e în „Urmărește acum”).';

-- Ținta se poate pune altfel pe un om nou față de unul cu vechime.
-- Null = se folosește valoarea firmei.
alter table public.memberships
  add column target_visits_per_day   integer,
  add column target_quotes_per_month integer;

-- View-ul spune acum și când o firmă trebuie reluată.
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
  e.pending_escalations,
  w.is_warm,
  -- Când ar trebui reluată, dacă nu are deja un pas deschis.
  case
    when v.last_visit is null then null
    else v.last_visit + (case when w.is_warm then o.recontact_days_warm else o.recontact_days_cold end)
  end as recontact_due,
  -- De reluat: fără pas următor deschis și trecută de termenul de recontactare.
  (
    (ns.visit_id is null or ns.next_step_done_at is not null)
    and v.last_visit is not null
    and v.last_visit + (case when w.is_warm then o.recontact_days_warm else o.recontact_days_cold end)
        <= current_date
  ) as needs_recontact
from public.clients c
join public.organizations o on o.id = c.org_id
cross join lateral (select public.merge_visit_answers(c.id) as answers) a
cross join lateral (
  select (a.answers ->> 'interes' in ('oferta', 'gata')
          or public.client_focus(a.answers) = 'urmareste') as is_warm
) w
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
