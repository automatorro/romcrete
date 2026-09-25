-- Arhiva ofertelor. „Șterge” de pe o ofertă o mută în arhivă: dispare din liste
-- și din rapoarte, dar se poate restaura oricând. Ștergerea definitivă o face
-- doar conducerea, și doar pentru o ofertă aflată deja în arhivă.

alter table public.quotes
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users (id) on delete set null;

create index quotes_active_idx on public.quotes (org_id, created_at desc) where archived_at is null;

comment on column public.quotes.archived_at is
  'Momentul arhivării. Null = oferta e activă; altfel nu apare în liste și nu se numără în rapoarte.';

-- Politica „pentru tot” se împarte: citirea, crearea și modificarea rămân ca
-- înainte (inclusiv arhivarea, care e o modificare), ștergerea devine a conducerii.
drop policy "quotes: urmează firma" on public.quotes;

create policy "oferte: citire, urmează firma" on public.quotes
  for select using (public.is_member(org_id) and (
    public.is_org_admin(org_id)
    or created_by = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_id and c.owner_agent_id = auth.uid())));

create policy "oferte: creare, urmează firma" on public.quotes
  for insert with check (public.is_member(org_id) and (
    public.is_org_admin(org_id)
    or created_by = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_id and c.owner_agent_id = auth.uid())));

create policy "oferte: modificare, urmează firma" on public.quotes
  for update
  using (public.is_member(org_id) and (
    public.is_org_admin(org_id)
    or created_by = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_id and c.owner_agent_id = auth.uid())))
  with check (public.is_member(org_id) and (
    public.is_org_admin(org_id)
    or created_by = auth.uid()
    or exists (select 1 from public.clients c where c.id = client_id and c.owner_agent_id = auth.uid())));

create policy "oferte: ștergere definitivă, doar conducerea, din arhivă" on public.quotes
  for delete using (public.is_org_admin(org_id) and archived_at is not null);

-- ------------------------------------------------ arhivarea intră în istoric

create or replace function public.log_quote_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.client_id is null then
    return new;
  end if;

  if tg_op = 'INSERT' then
    insert into public.client_activities (org_id, client_id, agent_id, kind, quote_id, meta)
    values (new.org_id, new.client_id, coalesce(auth.uid(), new.created_by), 'oferta_creata', new.id,
            jsonb_build_object('number', new.number, 'status', new.status));
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.client_activities (org_id, client_id, agent_id, kind, quote_id, meta)
    values (new.org_id, new.client_id, coalesce(auth.uid(), new.created_by), 'oferta_stare', new.id,
            jsonb_build_object('number', new.number, 'status', new.status, 'from', old.status));
  end if;

  if (new.archived_at is null) is distinct from (old.archived_at is null) then
    insert into public.client_activities (org_id, client_id, agent_id, kind, quote_id, meta)
    values (new.org_id, new.client_id, coalesce(auth.uid(), new.created_by), 'oferta_stare', new.id,
            jsonb_build_object('number', new.number, 'status', new.status,
                               'event', case when new.archived_at is null then 'restaurata' else 'arhivata' end));
  end if;
  return new;
end;
$$;

drop trigger quotes_log_activity on public.quotes;
create trigger quotes_log_activity
  after insert or update of status, archived_at on public.quotes
  for each row execute function public.log_quote_activity();
