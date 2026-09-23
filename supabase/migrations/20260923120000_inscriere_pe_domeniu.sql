-- Înscriere fără invitații: agentul își face singur contul și intră în firmă.
--
-- Până acum, fiecare înregistrare crea o organizație nouă. Agenții trebuie să
-- intre în cea existentă — dar aplicația e publică, deci intrarea nu poate fi
-- liberă: oricine ar găsi adresa ar ajunge înăuntru, cu tot catalogul și toate
-- firmele. Filtrul e domeniul de email, nu un cod de invitație.

alter table public.organizations
  add column join_domains text[] not null default '{}';

comment on column public.organizations.join_domains is
  'Domeniile de email care intră automat ca agent. Gol = nimeni nu se poate înscrie singur.';

-- Firma existentă primește domeniul propriu; se completează din Setări.
update public.organizations set join_domains = array['romcrete.ro'];

-- Rulează cu drepturi de definer: cel care se înscrie nu e încă membru, deci nu
-- poate citi organizația prin politicile obișnuite, și nici propriul email din auth.
create or replace function public.join_org_by_domain()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email   text;
  v_domain  text;
  v_org     uuid;
  v_matches int;
begin
  if auth.uid() is null then
    raise exception 'Trebuie să fii autentificat.';
  end if;

  -- Deja membru undeva: nu are ce căuta aici.
  if exists (select 1 from public.memberships where user_id = auth.uid()) then
    return (select org_id from public.memberships where user_id = auth.uid() limit 1);
  end if;

  select lower(email) into v_email from auth.users where id = auth.uid();
  if v_email is null then return null; end if;
  v_domain := split_part(v_email, '@', 2);

  -- Domeniul identifică firma, nu presupunerea că există una singură: altfel
  -- apariția unei a doua organizații ar opri tăcut înscrierea agenților.
  select count(*), (array_agg(o.id))[1] into v_matches, v_org
  from public.organizations o
  where exists (
    select 1 from unnest(o.join_domains) d where lower(d) = v_domain
  );

  -- Zero: nicio firmă nu revendică domeniul, iar primul om își creează firma
  -- pe fluxul obișnuit. Mai multe: nu se poate ghici în care intră.
  if v_matches <> 1 then return null; end if;

  insert into public.memberships (user_id, org_id, role)
  values (auth.uid(), v_org, 'agent')
  on conflict (user_id, org_id) do nothing;

  return v_org;
end;
$$;

comment on function public.join_org_by_domain() is
  'Înscrie utilizatorul curent ca agent, dacă domeniul emailului e pe lista firmei. Null = nu are drept de intrare.';

-- Invitațiile nu se mai folosesc: agentul își face singur contul, iar filtrul
-- e domeniul de email. Schema nefolosită induce în eroare pe cine o citește
-- peste șase luni, așa că iese.
drop function if exists public.accept_invitation(text);
drop table if exists public.invitations;
