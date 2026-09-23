-- Datele de identificare ale firmei ajung și pe teren: persoana de contact,
-- CUI, nr. Reg. Com., adresa, județul, emailul. Coloanele există în `clients`
-- de la început; aici doar le expunem în starea firmei, ca lista de firme,
-- fișa și exportul să le poată arăta și căuta.
--
-- `create or replace` păstrează drepturile view-ului; coloanele noi se pot
-- adăuga doar la sfârșit.

create or replace view public.client_state
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
  case
    when v.last_visit is null then null
    else v.last_visit + (case when w.is_warm then o.recontact_days_warm else o.recontact_days_cold end)
  end as recontact_due,
  (
    (ns.visit_id is null or ns.next_step_done_at is not null)
    and v.last_visit is not null
    and v.last_visit + (case when w.is_warm then o.recontact_days_warm else o.recontact_days_cold end)
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
