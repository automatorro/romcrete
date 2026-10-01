-- Ținta lunară în bani: valoarea ofertelor acceptate într-o lună, cu TVA.
--
-- Până acum ținta lunară era doar un număr de oferte, iar zece oferte mici
-- nu fac cât una mare. Raportul lunar compară acum vânzările cu o sumă.
-- 0 la firmă înseamnă „fără țintă”: raportul nu mai arată bara de progres.

alter table public.organizations
  add column if not exists target_sales_per_month numeric(14,2) not null default 0
    check (target_sales_per_month >= 0);

comment on column public.organizations.target_sales_per_month is
  'Ținta lunară de vânzări a unui agent: valoarea ofertelor acceptate, cu TVA. 0 = fără țintă.';

-- Pe om, ca celelalte ținte. Null = ținta firmei.
alter table public.memberships
  add column if not exists target_sales_per_month numeric(14,2)
    check (target_sales_per_month is null or target_sales_per_month >= 0);

comment on column public.memberships.target_sales_per_month is
  'Ținta lunară de vânzări a persoanei, cu TVA; null = ținta firmei.';
