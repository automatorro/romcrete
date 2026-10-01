-- De ce pierdem: motivul unei oferte respinse sau expirate.
--
-- Fără el, raportul spune doar câte oferte s-au pierdut, nu ce e de schimbat:
-- prețul, finanțarea, momentul sau oferta tehnică. Motivul e o listă scurtă,
-- ca să se poată număra; nota spune restul, cu cuvintele clientului.

alter table public.quotes
  add column if not exists loss_reason text
    check (loss_reason is null or loss_reason in (
      'pret',        -- prețul prea mare
      'concurenta',  -- a cumpărat de la altcineva
      'amanat',      -- a amânat investiția
      'finantare',   -- n-a obținut bani, leasing sau fonduri
      'lucrari',     -- nu are destule lucrări
      'tehnic',      -- utilajul nu se potrivește lucrărilor lui
      'tacere',      -- nu a mai răspuns
      'altul'
    )),
  add column if not exists loss_note text;

comment on column public.quotes.loss_reason is
  'De ce s-a pierdut oferta (respinsă sau expirată): pret, concurenta, amanat, finantare, lucrari, tehnic, tacere, altul.';
comment on column public.quotes.loss_note is
  'Ce a spus clientul despre pierdere, pe scurt.';
