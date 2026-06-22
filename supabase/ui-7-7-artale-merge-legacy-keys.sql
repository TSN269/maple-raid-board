-- UI-7.7 Artale price key merge fix
-- Purpose:
--   Merge old item_key records like "商品名稱-0" into the new fixed id key from Google Sheet.
-- How it works:
--   1. Group records by item_name
--   2. Choose canonical key:
--      - Prefer keys that do NOT end with "-number"
--      - If multiple fixed keys exist, use the latest updated key
--   3. Upsert old daily records into canonical key
--   4. Delete old alias-key rows
--   5. Keep a backup in artale_price_daily_records_key_merge_backup
--
-- Recommended order:
--   1. Deploy UI-7.7
--   2. Press "重新讀取報價" once, so new fixed id records are inserted
--   3. Run this SQL
--   4. Press "重新讀取報價" again

create table if not exists public.artale_price_daily_records_key_merge_backup (
  backup_at timestamptz not null default now(),
  item_key text not null,
  price_date date not null,
  item_name text not null,
  category text not null default '其他',
  last_price numeric not null,
  source text not null default '',
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create or replace function public.merge_artale_price_key_aliases()
returns table (
  item_name text,
  old_key text,
  new_key text,
  moved_rows integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  create temporary table tmp_artale_key_map on commit drop as
  with key_stats as (
    select
      r.item_name,
      r.item_key,
      max(r.updated_at) as last_updated
    from public.artale_price_daily_records r
    group by r.item_name, r.item_key
  ),
  canonical as (
    select distinct on (ks.item_name)
      ks.item_name,
      ks.item_key as canonical_key
    from key_stats ks
    order by
      ks.item_name,
      case when ks.item_key !~ '-[0-9]+$' then 0 else 1 end,
      ks.last_updated desc,
      ks.item_key
  )
  select
    ks.item_name,
    ks.item_key as old_key,
    c.canonical_key as new_key
  from key_stats ks
  join canonical c on c.item_name = ks.item_name
  where ks.item_key <> c.canonical_key;

  insert into public.artale_price_daily_records_key_merge_backup (
    item_key,
    price_date,
    item_name,
    category,
    last_price,
    source,
    created_at,
    updated_at
  )
  select
    r.item_key,
    r.price_date,
    r.item_name,
    r.category,
    r.last_price,
    r.source,
    r.created_at,
    r.updated_at
  from public.artale_price_daily_records r
  join tmp_artale_key_map m on m.old_key = r.item_key;

  insert into public.artale_price_daily_records (
    item_key,
    price_date,
    item_name,
    category,
    last_price,
    source,
    created_at,
    updated_at
  )
  select distinct on (m.new_key, r.price_date)
    m.new_key,
    r.price_date,
    r.item_name,
    r.category,
    r.last_price,
    r.source,
    r.created_at,
    r.updated_at
  from public.artale_price_daily_records r
  join tmp_artale_key_map m on m.old_key = r.item_key
  order by m.new_key, r.price_date, r.updated_at desc
  on conflict (item_key, price_date) do update
  set
    item_name = excluded.item_name,
    category = excluded.category,
    last_price = excluded.last_price,
    source = excluded.source,
    created_at = least(public.artale_price_daily_records.created_at, excluded.created_at),
    updated_at = greatest(public.artale_price_daily_records.updated_at, excluded.updated_at);

  delete from public.artale_price_daily_records r
  using tmp_artale_key_map m
  where r.item_key = m.old_key;

  return query
  select
    m.item_name,
    m.old_key,
    m.new_key,
    count(b.*)::integer as moved_rows
  from tmp_artale_key_map m
  left join public.artale_price_daily_records_key_merge_backup b
    on b.item_key = m.old_key
   and b.item_name = m.item_name
   and b.backup_at > now() - interval '5 minutes'
  group by m.item_name, m.old_key, m.new_key
  order by m.item_name, m.old_key;
end;
$$;

grant execute on function public.merge_artale_price_key_aliases() to service_role;

-- Execute one-time merge now.
-- If the new fixed id rows do not exist yet, this will not have anything useful to merge.
-- In that case: deploy UI-7.7, press "重新讀取報價", then run this SQL again.
select * from public.merge_artale_price_key_aliases();
