-- UI-7.8 / UI-7.7 SQLFIX1 Artale key merge by current fixed Google Sheet id
-- Purpose:
--   Merge legacy price rows into the fixed id rows from current Google Sheet.
--   This avoids old history being invisible when item_key changed from "商品名稱-index" to fixed "id".
--
-- Deploy order:
--   1. Deploy UI-7.8
--   2. Press "重新讀取報價" once
--   3. Run this SQL in Supabase SQL Editor
--   4. Press "重新讀取報價" again
--
-- The API will call merge_artale_price_key_aliases_for_items(items jsonb) automatically.
-- This file also provides merge_artale_price_key_aliases_from_table() for manual rescue.

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

create or replace function public.artale_price_normalize_name(p_name text)
returns text
language sql
immutable
as $$
  select lower(regexp_replace(trim(coalesce(p_name, '')), '\s+', '', 'g'));
$$;

create or replace function public.merge_artale_price_key_aliases_for_items(p_items jsonb)
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
  create temporary table tmp_current_items on commit drop as
  select distinct
    btrim(coalesce(x.id, '')) as new_key,
    btrim(coalesce(x.name, '')) as item_name,
    public.artale_price_normalize_name(x.name) as name_key
  from jsonb_to_recordset(coalesce(p_items, '[]'::jsonb)) as x(id text, name text)
  where btrim(coalesce(x.id, '')) <> ''
    and btrim(coalesce(x.name, '')) <> '';

  create temporary table tmp_artale_key_map on commit drop as
  select distinct
    r.item_name,
    r.item_key as old_key,
    c.new_key
  from public.artale_price_daily_records r
  join tmp_current_items c
    on public.artale_price_normalize_name(r.item_name) = c.name_key
  where r.item_key <> c.new_key;

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
    coalesce(c.item_name, r.item_name),
    r.category,
    r.last_price,
    r.source,
    r.created_at,
    r.updated_at
  from public.artale_price_daily_records r
  join tmp_artale_key_map m on m.old_key = r.item_key
  left join tmp_current_items c on c.new_key = m.new_key
  order by m.new_key, r.price_date, r.updated_at desc
  on conflict (item_key, price_date) do update
  set
    item_name = excluded.item_name,
    category = excluded.category,
    last_price = case
      when excluded.updated_at >= public.artale_price_daily_records.updated_at
        then excluded.last_price
      else public.artale_price_daily_records.last_price
    end,
    source = case
      when excluded.updated_at >= public.artale_price_daily_records.updated_at
        then excluded.source
      else public.artale_price_daily_records.source
    end,
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

create or replace function public.merge_artale_price_key_aliases_from_table()
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
declare
  v_items jsonb;
begin
  -- Choose likely fixed ids already inserted by UI-7.7 / UI-7.8:
  -- Prefer item_keys that are not the legacy "item_name-number" pattern.
  select jsonb_agg(jsonb_build_object('id', item_key, 'name', item_name))
  into v_items
  from (
    select distinct on (public.artale_price_normalize_name(item_name))
      item_key,
      item_name,
      updated_at
    from public.artale_price_daily_records
    where item_key !~ ('.*-[0-9]+$')
       or item_key like 'name:%'
    order by public.artale_price_normalize_name(item_name), updated_at desc
  ) s;

  return query
  select *
  from public.merge_artale_price_key_aliases_for_items(coalesce(v_items, '[]'::jsonb));
end;
$$;

-- Backward-compatible wrapper used by UI-7.7.
create or replace function public.merge_artale_price_key_aliases()
returns table (
  item_name text,
  old_key text,
  new_key text,
  moved_rows integer
)
language sql
security definer
set search_path = public
as $$
  select * from public.merge_artale_price_key_aliases_from_table();
$$;

grant execute on function public.artale_price_normalize_name(text) to anon, authenticated, service_role;
grant execute on function public.merge_artale_price_key_aliases_for_items(jsonb) to service_role;
grant execute on function public.merge_artale_price_key_aliases_from_table() to service_role;
grant execute on function public.merge_artale_price_key_aliases() to service_role;

-- One-time manual merge based on fixed ids already present in table.
select * from public.merge_artale_price_key_aliases_from_table();
