-- Partea scrisă a raportului, pe patru întrebări fixe: ce a mers, ce n-a mers
-- și de ce, ce se vede în piață, de ce e nevoie de la conducere. Un singur
-- câmp liber de rezumat rămânea de obicei gol; patru întrebări scurte se
-- completează, iar ultima face din raport un dialog, nu doar un control.

alter table public.reports
  add column if not exists reflection jsonb not null default '{}'::jsonb;

comment on column public.reports.reflection is
  'Răspunsurile autorului la cele patru întrebări ale raportului: amers, nuamers, piata, nevoie.';
