-- UI-7.5 Artale price history storage
-- Run this file in Supabase SQL Editor before deploying UI-7.5.
-- Serverless API uses SUPABASE_SERVICE_ROLE_KEY to upsert daily latest prices.

create table if not exists public.artale_price_daily_records (
  item_key text not null,
  price_date date not null,
  item_name text not null,
  category text not null default '其他',
  last_price numeric not null check (last_price > 0),
  source text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (item_key, price_date)
);

create index if not exists artale_price_daily_records_item_date_idx
  on public.artale_price_daily_records (item_key, price_date desc);

create or replace function public.touch_artale_price_daily_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_artale_price_daily_records_updated_at on public.artale_price_daily_records;

create trigger touch_artale_price_daily_records_updated_at
before update on public.artale_price_daily_records
for each row execute function public.touch_artale_price_daily_records_updated_at();

alter table public.artale_price_daily_records enable row level security;

drop policy if exists "artale price history readable" on public.artale_price_daily_records;
create policy "artale price history readable"
on public.artale_price_daily_records
for select
to anon, authenticated
using (true);

grant select on public.artale_price_daily_records to anon, authenticated;
grant all on public.artale_price_daily_records to service_role;
