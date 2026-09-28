-- Ștergerea unui raport salvat, fără să depindă de politicile RLS ale tabelului.
--
-- În producție, ștergerea directă (DELETE prin API) a lăsat raportul pe loc fără
-- nicio eroare, deși utilizatorul îl vedea: politica de ștergere lipsea sau nu se
-- potrivea cu cea de citire. Funcția verifică ea însăși aceeași regulă ca citirea
-- (autorul sau conducerea firmei) și spune exact de ce refuză, ca aplicația să
-- poată arăta motivul în loc de „nu s-a șters”.

-- Politica de ștergere, refăcută identic cu cea din 20260925180000_rapoarte.sql,
-- pentru proiectele în care lipsește.
drop policy if exists "rapoarte: autorul sau conducerea șterge" on public.reports;
create policy "rapoarte: autorul sau conducerea șterge" on public.reports
  for delete using (public.is_member(org_id) and (public.is_org_admin(org_id) or created_by = auth.uid()));

grant select, insert, update, delete on public.reports to authenticated;

create or replace function public.delete_report(p_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reports%rowtype;
begin
  if auth.uid() is null then
    return 'neautentificat';
  end if;

  select * into r from public.reports where id = p_id;
  if not found then
    return 'nu_exista';
  end if;

  if not public.is_member(r.org_id) then
    return 'alta_firma';
  end if;
  if not (public.is_org_admin(r.org_id) or r.created_by = auth.uid()) then
    return 'fara_drept';
  end if;

  delete from public.reports where id = p_id;
  return 'sters';
end;
$$;

revoke execute on function public.delete_report(uuid) from public, anon;
grant execute on function public.delete_report(uuid) to authenticated;

comment on function public.delete_report(uuid) is
  'Șterge un raport salvat dacă utilizatorul e autorul lui sau conducerea firmei; întoarce motivul când refuză.';
