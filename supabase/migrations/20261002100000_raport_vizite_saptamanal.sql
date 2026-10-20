alter table public.visits
  add column report_contact text,
  add column report_discussion text,
  add column report_outcome text,
  add column report_proposal_made boolean,
  add column report_next_visit_date date,
  add column report_observations text;