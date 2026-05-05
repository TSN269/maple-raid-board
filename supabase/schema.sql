-- Maple Raid Board Supabase schema / UI-V12
-- Permission model:
--   - anonymous/general players: read raid data and insert signup only
--   - raid leader: manage one raid by leader management code through RPC functions
-- Run this whole file once in Supabase SQL Editor after deploying UI-V12.

create schema if not exists extensions;
create extension if not exists pgcrypto with schema extensions;
set search_path = public, extensions;

create table if not exists public.raid_groups (
  id text primary key,
  title text not null,
  boss text not null,
  raid_date date not null,
  raid_time time not null,
  leader text not null,
  min_level integer not null default 1 check (min_level >= 1),
  capacity integer not null default 18,
  status text not null default 'open' check (status in ('open', 'closed', 'finished')),
  notice text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.raid_groups add column if not exists leader_code_hash text;
update public.raid_groups
set leader_code_hash = crypt('demo123', gen_salt('bf'))
where leader_code_hash is null;
alter table public.raid_groups alter column leader_code_hash set not null;

alter table public.raid_groups drop constraint if exists raid_groups_capacity_check;
update public.raid_groups set capacity = least(greatest(capacity, 1), 18);
alter table public.raid_groups add constraint raid_groups_capacity_check check (capacity between 1 and 18);

create table if not exists public.raid_members (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references public.raid_groups(id) on delete cascade,
  name text not null,
  job text not null,
  level integer not null check (level >= 1),
  role text not null,
  party integer not null default 1,
  status text not null default '待確認' check (status in ('待確認', '已確認', '候補', '請假')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.raid_members drop constraint if exists raid_members_party_check;
update public.raid_members set party = least(greatest(party, 1), 3);
alter table public.raid_members add constraint raid_members_party_check check (party between 1 and 3);

create index if not exists raid_groups_raid_date_idx on public.raid_groups (raid_date, raid_time);
create index if not exists raid_members_group_id_idx on public.raid_members (group_id);
create index if not exists raid_members_party_idx on public.raid_members (group_id, party);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_raid_groups_updated_at on public.raid_groups;
create trigger set_raid_groups_updated_at
before update on public.raid_groups
for each row execute function public.set_updated_at();

drop trigger if exists set_raid_members_updated_at on public.raid_members;
create trigger set_raid_members_updated_at
before update on public.raid_members
for each row execute function public.set_updated_at();

create or replace function public.is_raid_leader(p_group_id text, p_leader_code text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.raid_groups g
    where g.id = p_group_id
      and p_leader_code is not null
      and length(p_leader_code) >= 4
      and crypt(p_leader_code, g.leader_code_hash) = g.leader_code_hash
  );
$$;

create or replace function public.can_signup_to_group(p_group_id text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.raid_groups g
    where g.id = p_group_id
      and g.status = 'open'
      and (g.raid_date::timestamp + g.raid_time) > now()
      and (select count(*) from public.raid_members m where m.group_id = g.id) < least(g.capacity, 18)
  );
$$;

create or replace function public.create_raid_group_with_code(
  p_id text,
  p_title text,
  p_boss text,
  p_raid_date date,
  p_raid_time time,
  p_leader text,
  p_min_level integer,
  p_capacity integer,
  p_status text,
  p_notice text,
  p_leader_code text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_leader_code is null or length(p_leader_code) < 4 then
    raise exception '團長管理碼至少需要 4 個字元';
  end if;

  insert into public.raid_groups (
    id, title, boss, raid_date, raid_time, leader, min_level, capacity, status, notice, leader_code_hash
  ) values (
    p_id,
    p_title,
    p_boss,
    p_raid_date,
    p_raid_time,
    p_leader,
    greatest(coalesce(p_min_level, 1), 1),
    least(greatest(coalesce(p_capacity, 18), 1), 18),
    case when p_status in ('open', 'closed', 'finished') then p_status else 'open' end,
    coalesce(p_notice, ''),
    crypt(p_leader_code, gen_salt('bf'))
  );
end;
$$;

create or replace function public.verify_raid_leader_code(p_group_id text, p_leader_code text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select public.is_raid_leader(p_group_id, p_leader_code);
$$;

create or replace function public.update_raid_group_status_with_code(p_group_id text, p_status text, p_leader_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_raid_leader(p_group_id, p_leader_code) then
    raise exception '團長管理碼錯誤，無法修改團隊狀態';
  end if;

  if p_status not in ('open', 'closed', 'finished') then
    raise exception '不支援的團隊狀態';
  end if;

  update public.raid_groups
  set status = p_status
  where id = p_group_id;
end;
$$;

create or replace function public.update_raid_member_status_with_code(p_member_id uuid, p_status text, p_leader_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_group_id text;
begin
  select group_id into v_group_id from public.raid_members where id = p_member_id;
  if v_group_id is null then
    raise exception '找不到成員';
  end if;

  if not public.is_raid_leader(v_group_id, p_leader_code) then
    raise exception '團長管理碼錯誤，無法修改成員狀態';
  end if;

  if p_status not in ('待確認', '已確認', '候補', '請假') then
    raise exception '不支援的成員狀態';
  end if;

  update public.raid_members
  set status = p_status
  where id = p_member_id;
end;
$$;

create or replace function public.delete_raid_member_with_code(p_member_id uuid, p_leader_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_group_id text;
begin
  select group_id into v_group_id from public.raid_members where id = p_member_id;
  if v_group_id is null then
    raise exception '找不到成員';
  end if;

  if not public.is_raid_leader(v_group_id, p_leader_code) then
    raise exception '團長管理碼錯誤，無法刪除成員';
  end if;

  delete from public.raid_members where id = p_member_id;
end;
$$;

create or replace function public.delete_raid_group_with_code(p_group_id text, p_leader_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not public.is_raid_leader(p_group_id, p_leader_code) then
    raise exception '團長管理碼錯誤，無法刪除團';
  end if;

  delete from public.raid_groups where id = p_group_id;
end;
$$;

alter table public.raid_groups enable row level security;
alter table public.raid_members enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.raid_groups to anon, authenticated;
grant select, insert on public.raid_members to anon, authenticated;

grant execute on function public.create_raid_group_with_code(text, text, text, date, time, text, integer, integer, text, text, text) to anon, authenticated;
grant execute on function public.verify_raid_leader_code(text, text) to anon, authenticated;
grant execute on function public.update_raid_group_status_with_code(text, text, text) to anon, authenticated;
grant execute on function public.update_raid_member_status_with_code(uuid, text, text) to anon, authenticated;
grant execute on function public.delete_raid_member_with_code(uuid, text) to anon, authenticated;
grant execute on function public.delete_raid_group_with_code(text, text) to anon, authenticated;

-- Remove old public CRUD policies from demo mode.
drop policy if exists "Public read raid groups" on public.raid_groups;
drop policy if exists "Public create raid groups" on public.raid_groups;
drop policy if exists "Public update raid groups" on public.raid_groups;
drop policy if exists "Public delete raid groups" on public.raid_groups;
drop policy if exists "Public read raid members" on public.raid_members;
drop policy if exists "Public create raid members" on public.raid_members;
drop policy if exists "Public update raid members" on public.raid_members;
drop policy if exists "Public delete raid members" on public.raid_members;

drop policy if exists "Read raid groups" on public.raid_groups;
create policy "Read raid groups"
on public.raid_groups
for select
to anon, authenticated
using (true);

drop policy if exists "Read raid members" on public.raid_members;
create policy "Read raid members"
on public.raid_members
for select
to anon, authenticated
using (true);

drop policy if exists "Players can signup only" on public.raid_members;
create policy "Players can signup only"
on public.raid_members
for insert
to anon, authenticated
with check (
  status = '待確認'
  and party between 1 and 3
  and public.can_signup_to_group(group_id)
);

-- Realtime support.
alter table public.raid_groups replica identity full;
alter table public.raid_members replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'raid_groups'
  ) then
    alter publication supabase_realtime add table public.raid_groups;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'raid_members'
  ) then
    alter publication supabase_realtime add table public.raid_members;
  end if;
end $$;

-- Demo seed. Demo leader management code: demo123
insert into public.raid_groups (id, title, boss, raid_date, raid_time, leader, min_level, capacity, status, notice, leader_code_hash)
values
  ('demo-zakum-soon', '炎魔固定團 - 今晚 22:30', '殘暴炎魔 Zakum｜HARD', current_date + 1, '22:30', 'Cocoa', 90, 18, 'open', '請提前 10 分鐘到門口集合。缺萬能、聖水、眼藥水請先補。', crypt('demo123', gen_salt('bf'))),
  ('demo-horntail-weekend', '龍王拓荒團 - 週末', '闇黑龍王 Horntail｜HARD', current_date + 3, '21:00', 'Tyok', 120, 18, 'open', '拓荒團，請確認命中、藥水與復活規則。未達門檻可先排候補。', crypt('demo123', gen_salt('bf'))),
  ('demo-papulatus-casual', '鐘王休閒團 - 缺 3', '鐘王 Papulatus｜NORMAL', current_date + 1, '23:00', 'Momo', 100, 12, 'open', '輕鬆打，報名後請留職業與等級。', crypt('demo123', gen_salt('bf')))
on conflict (id) do update set
  title = excluded.title,
  boss = excluded.boss,
  raid_date = excluded.raid_date,
  raid_time = excluded.raid_time,
  leader = excluded.leader,
  min_level = excluded.min_level,
  capacity = excluded.capacity,
  status = excluded.status,
  notice = excluded.notice,
  leader_code_hash = excluded.leader_code_hash;

delete from public.raid_members where group_id in ('demo-zakum-soon', 'demo-horntail-weekend', 'demo-papulatus-casual');

insert into public.raid_members (group_id, name, job, level, role, party, status, note)
values
  ('demo-zakum-soon', '可可', '主教', 128, '補師', 1, '已確認', '可開語音'),
  ('demo-zakum-soon', '阿楓', '英雄', 132, '主輸出', 1, '已確認', ''),
  ('demo-zakum-soon', '小夜', '夜使者', 121, '主輸出', 1, '待確認', '可能晚 5 分鐘'),
  ('demo-zakum-soon', '冰茶', '冰雷魔導士', 116, '副輸出', 2, '已確認', ''),
  ('demo-zakum-soon', '黑糖', '黑騎士', 119, '輔助', 2, '已確認', '聖火'),
  ('demo-zakum-soon', '弩弓手90', '神射手', 94, '副輸出', 3, '候補', '第一次打'),
  ('demo-horntail-weekend', 'Tyok', '黑騎士', 145, '隊長', 1, '已確認', '指揮'),
  ('demo-horntail-weekend', '梅子', '主教', 137, '補師', 1, '已確認', ''),
  ('demo-horntail-weekend', '貓拳', '拳霸', 129, '副輸出', 2, '待確認', ''),
  ('demo-papulatus-casual', 'Momo', '暗影神偷', 125, '隊長', 1, '已確認', ''),
  ('demo-papulatus-casual', '橘子', '箭神', 111, '主輸出', 1, '已確認', '');
