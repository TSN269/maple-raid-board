-- Maple Raid Board Supabase schema / UI-3.2
-- Permission model:
--   - anonymous/general players: read raid data and submit signup through RPC only
--   - raid leader: manage one raid by leader management code through RPC functions
--   - anti-spam: per-raid signup code, duplicate-name prevention, input validation, honeypot, browser nonce cooldown
-- Run this whole file in Supabase SQL Editor after deploying UI-1.3.

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
alter table public.raid_groups add column if not exists signup_code_hash text;
alter table public.raid_groups add column if not exists role_requirements jsonb not null default '{"1":["打手","打手","火","煙霧機","輔助","大法"],"2":["打手","打手","火","煙霧機","輔助","大法"],"3":["打手","打手","火","煙霧機","輔助","大法"]}'::jsonb;

update public.raid_groups
set leader_code_hash = crypt('demo123', gen_salt('bf'))
where leader_code_hash is null;

update public.raid_groups
set signup_code_hash = crypt('raid2026', gen_salt('bf'))
where signup_code_hash is null;

alter table public.raid_groups alter column leader_code_hash set not null;
alter table public.raid_groups alter column signup_code_hash set not null;

alter table public.raid_groups drop constraint if exists raid_groups_capacity_check;
alter table public.raid_groups drop constraint if exists raid_groups_title_length_check;
alter table public.raid_groups drop constraint if exists raid_groups_leader_length_check;
alter table public.raid_groups drop constraint if exists raid_groups_notice_length_check;

-- Clean old/demo rows before applying stricter 1.3 constraints.
-- Older UI versions allowed longer titles/leaders/notices, so constraints must be added after cleanup.
update public.raid_groups
set
  capacity = least(greatest(coalesce(capacity, 18), 1), 18),
  title = case
    when char_length(left(nullif(btrim(regexp_replace(coalesce(title, ''), '[[:cntrl:]]', '', 'g')), ''), 40)) >= 2
      then left(nullif(btrim(regexp_replace(coalesce(title, ''), '[[:cntrl:]]', '', 'g')), ''), 40)
    else '未命名突襲場次'
  end,
  leader = case
    when char_length(left(nullif(btrim(regexp_replace(coalesce(leader, ''), '[[:cntrl:]]', '', 'g')), ''), 16)) >= 2
      then left(nullif(btrim(regexp_replace(coalesce(leader, ''), '[[:cntrl:]]', '', 'g')), ''), 16)
    else '團長'
  end,
  notice = left(regexp_replace(coalesce(notice, ''), '[[:cntrl:]]', '', 'g'), 300);

alter table public.raid_groups add constraint raid_groups_capacity_check check (capacity between 1 and 18);
alter table public.raid_groups add constraint raid_groups_title_length_check check (char_length(btrim(title)) between 2 and 40);
alter table public.raid_groups add constraint raid_groups_leader_length_check check (char_length(btrim(leader)) between 2 and 16);
alter table public.raid_groups add constraint raid_groups_notice_length_check check (char_length(notice) <= 300);

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

alter table public.raid_members drop constraint if exists raid_members_level_check;
alter table public.raid_members drop constraint if exists raid_members_name_length_check;
alter table public.raid_members drop constraint if exists raid_members_job_length_check;
alter table public.raid_members drop constraint if exists raid_members_role_length_check;
alter table public.raid_members drop constraint if exists raid_members_note_length_check;
alter table public.raid_members drop constraint if exists raid_members_no_control_chars_check;

-- Clean old member rows before applying stricter anti-spam constraints.
update public.raid_members
set
  level = least(greatest(coalesce(level, 1), 1), 300),
  name = case
    when char_length(left(nullif(btrim(regexp_replace(coalesce(name, ''), '[[:cntrl:]]', '', 'g')), ''), 16)) >= 2
      then left(nullif(btrim(regexp_replace(coalesce(name, ''), '[[:cntrl:]]', '', 'g')), ''), 16)
    else '玩家' || left(id::text, 6)
  end,
  job = case
    when char_length(left(nullif(btrim(regexp_replace(coalesce(job, ''), '[[:cntrl:]]', '', 'g')), ''), 24)) >= 1
      then left(nullif(btrim(regexp_replace(coalesce(job, ''), '[[:cntrl:]]', '', 'g')), ''), 24)
    else '其他'
  end,
  role = case
    when char_length(left(nullif(btrim(regexp_replace(coalesce(role, ''), '[[:cntrl:]]', '', 'g')), ''), 24)) >= 1
      then left(nullif(btrim(regexp_replace(coalesce(role, ''), '[[:cntrl:]]', '', 'g')), ''), 24)
    else '輸出'
  end,
  note = left(regexp_replace(coalesce(note, ''), '[[:cntrl:]]', '', 'g'), 100);

alter table public.raid_members add constraint raid_members_level_check check (level between 1 and 300);
alter table public.raid_members add constraint raid_members_name_length_check check (char_length(btrim(name)) between 2 and 16);
alter table public.raid_members add constraint raid_members_job_length_check check (char_length(btrim(job)) between 1 and 24);
alter table public.raid_members add constraint raid_members_role_length_check check (char_length(btrim(role)) between 1 and 24);
alter table public.raid_members add constraint raid_members_note_length_check check (char_length(note) <= 100);
alter table public.raid_members add constraint raid_members_no_control_chars_check check (
  name !~ '[[:cntrl:]]'
  and job !~ '[[:cntrl:]]'
  and role !~ '[[:cntrl:]]'
  and note !~ '[[:cntrl:]]'
);

create table if not exists public.signup_attempts (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references public.raid_groups(id) on delete cascade,
  client_nonce text not null,
  created_at timestamptz not null default now()
);

create index if not exists raid_groups_raid_date_idx on public.raid_groups (raid_date, raid_time);
create index if not exists raid_members_group_id_idx on public.raid_members (group_id);
create index if not exists raid_members_party_idx on public.raid_members (group_id, party);
create index if not exists signup_attempts_nonce_idx on public.signup_attempts (group_id, client_nonce, created_at desc);

-- Make duplicate-name cleanup safe before adding the unique index.
with ranked as (
  select ctid, row_number() over (partition by group_id, lower(btrim(name)) order by created_at asc, id asc) as rn
  from public.raid_members
)
delete from public.raid_members m
using ranked r
where m.ctid = r.ctid
  and r.rn > 1;

drop index if exists raid_members_group_lower_name_unique;
create unique index raid_members_group_lower_name_unique on public.raid_members (group_id, lower(btrim(name)));

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

create or replace function public.is_signup_code_valid(p_group_id text, p_signup_code text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1
    from public.raid_groups g
    where g.id = p_group_id
      and p_signup_code is not null
      and length(p_signup_code) >= 4
      and crypt(p_signup_code, g.signup_code_hash) = g.signup_code_hash
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
  p_leader_code text,
  p_signup_code text
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if p_leader_code is null or length(btrim(p_leader_code)) < 4 then
    raise exception '團長管理碼至少需要 4 個字元';
  end if;

  if p_signup_code is null or length(btrim(p_signup_code)) < 4 then
    raise exception '報名邀請碼至少需要 4 個字元';
  end if;

  if char_length(btrim(p_title)) not between 2 and 40 then
    raise exception '標題長度需為 2 到 40 個字';
  end if;

  if char_length(btrim(p_leader)) not between 2 and 16 then
    raise exception '團長名稱長度需為 2 到 16 個字';
  end if;

  insert into public.raid_groups (
    id, title, boss, raid_date, raid_time, leader, min_level, capacity, status, notice, leader_code_hash, signup_code_hash, role_requirements
  ) values (
    p_id,
    btrim(p_title),
    btrim(p_boss),
    p_raid_date,
    p_raid_time,
    btrim(p_leader),
    greatest(coalesce(p_min_level, 1), 1),
    least(greatest(coalesce(p_capacity, 18), 1), 18),
    case when p_status in ('open', 'closed', 'finished') then p_status else 'open' end,
    left(coalesce(p_notice, ''), 300),
    crypt(btrim(p_leader_code), gen_salt('bf')),
    crypt(btrim(p_signup_code), gen_salt('bf')),
    '{"1":["打手","打手","火","煙霧機","輔助","大法"],"2":["打手","打手","火","煙霧機","輔助","大法"],"3":["打手","打手","火","煙霧機","輔助","大法"]}'::jsonb
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

create or replace function public.create_raid_member_with_code(
  p_group_id text,
  p_name text,
  p_job text,
  p_level integer,
  p_role text,
  p_party integer,
  p_note text,
  p_signup_code text,
  p_client_nonce text,
  p_honeypot text default ''
)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_job text := btrim(coalesce(p_job, ''));
  v_role text := btrim(coalesce(p_role, ''));
  v_note text := left(coalesce(p_note, ''), 100);
begin
  delete from public.signup_attempts where created_at < now() - interval '1 day';

  if coalesce(p_honeypot, '') <> '' then
    raise exception '報名資料格式不正確';
  end if;

  if p_client_nonce is null or char_length(p_client_nonce) < 16 or char_length(p_client_nonce) > 80 then
    raise exception '請重新整理頁面後再報名';
  end if;

  if exists (
    select 1 from public.signup_attempts
    where group_id = p_group_id
      and client_nonce = p_client_nonce
      and created_at > now() - interval '30 seconds'
  ) then
    raise exception '送出太頻繁，請稍後再試';
  end if;

  insert into public.signup_attempts (group_id, client_nonce) values (p_group_id, p_client_nonce);

  if not public.is_signup_code_valid(p_group_id, p_signup_code) then
    raise exception '報名邀請碼錯誤';
  end if;

  if not public.can_signup_to_group(p_group_id) then
    raise exception '此團目前無法報名';
  end if;

  if char_length(v_name) not between 2 and 16 then
    raise exception '角色名稱長度需為 2 到 16 個字';
  end if;

  if v_name ~ '[[:cntrl:]]' or v_job ~ '[[:cntrl:]]' or v_role ~ '[[:cntrl:]]' or v_note ~ '[[:cntrl:]]' then
    raise exception '報名資料不可包含控制字元';
  end if;

  if char_length(v_job) not between 1 and 24 or char_length(v_role) not between 1 and 24 then
    raise exception '職業或定位格式不正確';
  end if;

  if coalesce(p_level, 0) < 1 or coalesce(p_level, 0) > 300 then
    raise exception '等級需介於 1 到 300';
  end if;

  if not exists (
    select 1
    from public.raid_groups g,
      jsonb_each(g.role_requirements) as party_roles(party_no, roles),
      jsonb_array_elements_text(party_roles.roles) as allowed(role)
    where g.id = p_group_id
      and allowed.role = v_role
  ) then
    raise exception '此角色定位不符合目前團隊需求';
  end if;

  if exists (
    select 1 from public.raid_members
    where group_id = p_group_id
      and lower(btrim(name)) = lower(v_name)
  ) then
    raise exception '此角色已報名，請勿重複送出';
  end if;

  insert into public.raid_members (group_id, name, job, level, role, party, status, note)
  values (
    p_group_id,
    v_name,
    v_job,
    p_level,
    v_role,
    least(greatest(coalesce(p_party, 1), 1), 3),
    '待確認',
    v_note
  );
end;
$$;


create or replace function public.update_raid_role_requirements_with_code(p_group_id text, p_role_requirements jsonb, p_leader_code text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_allowed text[] := array['打手','控時','火','煙霧機','輔助','大法','清球','清魔靈'];
  v_party_count integer;
  v_key text;
  v_value jsonb;
  v_role text;
begin
  if not public.is_raid_leader(p_group_id, p_leader_code) then
    raise exception '團長管理碼錯誤，無法修改角色定位需求';
  end if;

  if p_role_requirements is null or jsonb_typeof(p_role_requirements) <> 'object' then
    raise exception '角色定位需求格式不正確';
  end if;

  select greatest(1, ceil(least(greatest(coalesce(capacity, 18), 1), 18)::numeric / 6)::integer)
  into v_party_count
  from public.raid_groups
  where id = p_group_id;

  for v_key, v_value in select key, value from jsonb_each(p_role_requirements) loop
    if v_key !~ '^[1-9][0-9]*$' or v_key::integer < 1 or v_key::integer > v_party_count then
      raise exception '隊伍需求超出此團隊伍數';
    end if;

    if jsonb_typeof(v_value) <> 'array' or jsonb_array_length(v_value) > 6 then
      raise exception '每隊最多設定 6 個定位需求';
    end if;

    for v_role in select jsonb_array_elements_text(v_value) loop
      if not (v_role = any(v_allowed)) then
        raise exception '不支援的角色定位需求：%', v_role;
      end if;
    end loop;
  end loop;

  update public.raid_groups
  set role_requirements = p_role_requirements,
      updated_at = now()
  where id = p_group_id;
end;
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
alter table public.signup_attempts enable row level security;

revoke insert, update, delete on public.raid_groups from anon, authenticated;
revoke insert, update, delete on public.raid_members from anon, authenticated;
revoke all on public.signup_attempts from anon, authenticated;

grant usage on schema public to anon, authenticated;
grant select on public.raid_groups to anon, authenticated;
grant select on public.raid_members to anon, authenticated;

grant execute on function public.create_raid_group_with_code(text, text, text, date, time, text, integer, integer, text, text, text, text) to anon, authenticated;
grant execute on function public.verify_raid_leader_code(text, text) to anon, authenticated;
grant execute on function public.create_raid_member_with_code(text, text, text, integer, text, integer, text, text, text, text) to anon, authenticated;
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
-- No direct INSERT policy on raid_members. Public signups must go through create_raid_member_with_code().

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

-- Demo seed.
-- Demo leader management code: demo123
-- Demo signup invite code: raid2026
insert into public.raid_groups (id, title, boss, raid_date, raid_time, leader, min_level, capacity, status, notice, leader_code_hash, signup_code_hash, role_requirements)
values
  ('demo-zakum-soon', '炎魔固定團 - 今晚 22:30', '殘暴炎魔 Zakum｜HARD', current_date + 1, '22:30', 'Cocoa', 90, 18, 'open', '請提前 10 分鐘到門口集合。缺萬能、聖水、眼藥水請先補。', crypt('demo123', gen_salt('bf')), crypt('raid2026', gen_salt('bf')), '{"1":["打手","打手","火","煙霧機","輔助","大法"],"2":["打手","打手","火","煙霧機","輔助","大法"],"3":["打手","打手","火","煙霧機","輔助","大法"]}'::jsonb),
  ('demo-horntail-weekend', '龍王拓荒團 - 週末', '闇黑龍王 Horntail｜HARD', current_date + 3, '21:00', 'Tyok', 120, 18, 'open', '拓荒團，請確認命中、藥水與復活規則。未達門檻可先排候補。', crypt('demo123', gen_salt('bf')), crypt('raid2026', gen_salt('bf')), '{"1":["打手","打手","火","煙霧機","輔助","大法"],"2":["打手","打手","火","煙霧機","輔助","大法"],"3":["打手","打手","火","煙霧機","輔助","大法"]}'::jsonb),
  ('demo-papulatus-casual', '鐘王休閒團 - 缺 3', '鐘王 Papulatus｜NORMAL', current_date + 1, '23:00', 'Momo', 100, 12, 'open', '輕鬆打，報名後請留職業與等級。', crypt('demo123', gen_salt('bf')), crypt('raid2026', gen_salt('bf')), '{"1":["打手","打手","火","煙霧機","輔助","大法"],"2":["打手","打手","火","煙霧機","輔助","大法"],"3":["打手","打手","火","煙霧機","輔助","大法"]}'::jsonb)
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
  leader_code_hash = excluded.leader_code_hash,
  signup_code_hash = excluded.signup_code_hash,
  role_requirements = excluded.role_requirements;

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



-- UI-5.9 SQLFIX1：允許新增角色定位並修正預設需求。
-- 修正錯誤：不支援的角色定位需求：大法
alter table public.raid_groups
  alter column role_requirements set default '{"1":["打手","打手","火","煙霧機","輔助","大法"],"2":["打手","打手","火","煙霧機","輔助","大法"],"3":["打手","打手","火","煙霧機","輔助","大法"]}'::jsonb;

-- UI-2.0 羅茱工具：Supabase 多人即時同步房間
-- Demo/production note: room password is validated by RPC; routes are shared in realtime.

create or replace function public.rojhu_empty_routes()
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    '101', jsonb_build_array(null, null, null, null, null, null, null, null, null, null),
    '102', jsonb_build_array(null, null, null, null, null, null, null, null, null, null),
    '103', jsonb_build_array(null, null, null, null, null, null, null, null, null, null),
    '104', jsonb_build_array(null, null, null, null, null, null, null, null, null, null)
  );
$$;

create table if not exists public.rojhu_rooms (
  code text primary key check (code ~ '^[0-9]{6}$'),
  password_hash text not null,
  routes jsonb not null default public.rojhu_empty_routes(),
  last_routes jsonb not null default public.rojhu_empty_routes(),
  selected_players jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rojhu_rooms
  add column if not exists last_routes jsonb not null default public.rojhu_empty_routes(),
  add column if not exists selected_players jsonb not null default '{}'::jsonb;

update public.rojhu_rooms
set
  last_routes = coalesce(last_routes, public.rojhu_empty_routes()),
  selected_players = coalesce(selected_players, '{}'::jsonb);

alter table public.rojhu_rooms enable row level security;

drop trigger if exists set_rojhu_rooms_updated_at on public.rojhu_rooms;
create trigger set_rojhu_rooms_updated_at
before update on public.rojhu_rooms
for each row execute function public.set_updated_at();

alter table public.rojhu_rooms replica identity full;

drop policy if exists "Read rojhu rooms for realtime" on public.rojhu_rooms;
create policy "Read rojhu rooms for realtime"
on public.rojhu_rooms
for select
to anon, authenticated
using (true);

-- No direct insert/update/delete policy. Public writes must go through RPC functions below.

create or replace function public.rojhu_validate_password(p_password text)
returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_password text := coalesce(nullif(btrim(p_password), ''), lpad(floor(random() * 10000)::int::text, 4, '0'));
begin
  if v_password !~ '^[0-9]{4,8}$' then
    raise exception '房間密碼需為 4-8 位數字';
  end if;

  return v_password;
end;
$$;

create or replace function public.rojhu_room_payload(p_room public.rojhu_rooms, p_password text)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'code', p_room.code,
    'password', p_password,
    'routes', p_room.routes,
    'last_routes', p_room.last_routes,
    'selected_players', p_room.selected_players,
    'created_at', p_room.created_at,
    'updated_at', p_room.updated_at
  );
$$;

create or replace function public.create_rojhu_room(p_password text default null, p_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_password text := public.rojhu_validate_password(p_password);
  v_requested_code text := btrim(coalesce(p_code, ''));
  v_code text;
  v_room public.rojhu_rooms;
  v_attempts integer := 0;
begin
  if v_requested_code <> '' then
    if v_requested_code !~ '^[0-9]{6}$' then
      raise exception '房間代碼需為 6 位數字';
    end if;

    insert into public.rojhu_rooms (code, password_hash, routes)
    values (v_requested_code, crypt(v_password, gen_salt('bf')), public.rojhu_empty_routes())
    returning * into v_room;

    return public.rojhu_room_payload(v_room, v_password);
  end if;

  loop
    v_code := lpad(floor(random() * 1000000)::int::text, 6, '0');
    v_attempts := v_attempts + 1;

    begin
      insert into public.rojhu_rooms (code, password_hash, routes)
      values (v_code, crypt(v_password, gen_salt('bf')), public.rojhu_empty_routes())
      returning * into v_room;

      return public.rojhu_room_payload(v_room, v_password);
    exception when unique_violation then
      if v_attempts > 30 then
        raise exception '房間代碼產生失敗，請再試一次';
      end if;
    end;
  end loop;
exception when unique_violation then
  raise exception '此房間代碼已存在，請換一組';
end;
$$;

create or replace function public.join_rojhu_room(p_code text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text := btrim(coalesce(p_code, ''));
  v_password text := btrim(coalesce(p_password, ''));
  v_room public.rojhu_rooms;
begin
  if v_code !~ '^[0-9]{6}$' then
    raise exception '房間代碼需為 6 位數字';
  end if;

  if v_password !~ '^[0-9]{4,8}$' then
    raise exception '房間密碼需為 4-8 位數字';
  end if;

  select * into v_room
  from public.rojhu_rooms
  where code = v_code;

  if not found then
    raise exception '找不到此房間';
  end if;

  if crypt(v_password, v_room.password_hash) <> v_room.password_hash then
    raise exception '房間密碼錯誤';
  end if;

  return public.rojhu_room_payload(v_room, v_password);
end;
$$;

create or replace function public.claim_rojhu_player(
  p_code text,
  p_password text,
  p_player text,
  p_client_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rojhu_rooms;
  v_password text := btrim(coalesce(p_password, ''));
  v_client_id text := btrim(coalesce(p_client_id, ''));
  v_selected jsonb;
  v_key text;
begin
  if p_player not in ('101', '102', '103', '104') then
    raise exception '角色代號錯誤';
  end if;

  if v_client_id !~ '^[a-zA-Z0-9_-]{12,80}$' then
    raise exception '用戶代碼錯誤';
  end if;

  select * into v_room
  from public.rojhu_rooms
  where code = btrim(coalesce(p_code, ''))
  for update;

  if not found then
    raise exception '找不到此房間';
  end if;

  if crypt(v_password, v_room.password_hash) <> v_room.password_hash then
    raise exception '房間密碼錯誤';
  end if;

  v_selected := coalesce(v_room.selected_players, '{}'::jsonb);

  if (v_selected ? p_player) and (v_selected ->> p_player) <> v_client_id then
    raise exception '此角色已被其他玩家選擇';
  end if;

  for v_key in select jsonb_object_keys(v_selected)
  loop
    if v_selected ->> v_key = v_client_id then
      v_selected := v_selected - v_key;
    end if;
  end loop;

  v_selected := jsonb_set(v_selected, array[p_player], to_jsonb(v_client_id), true);

  update public.rojhu_rooms
  set selected_players = v_selected
  where code = v_room.code
  returning * into v_room;

  return public.rojhu_room_payload(v_room, v_password);
end;
$$;

create or replace function public.release_rojhu_player(
  p_code text,
  p_password text,
  p_client_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rojhu_rooms;
  v_password text := btrim(coalesce(p_password, ''));
  v_client_id text := btrim(coalesce(p_client_id, ''));
  v_selected jsonb;
  v_key text;
begin
  if v_client_id !~ '^[a-zA-Z0-9_-]{12,80}$' then
    raise exception '用戶代碼錯誤';
  end if;

  select * into v_room
  from public.rojhu_rooms
  where code = btrim(coalesce(p_code, ''))
  for update;

  if not found then
    raise exception '找不到此房間';
  end if;

  if crypt(v_password, v_room.password_hash) <> v_room.password_hash then
    raise exception '房間密碼錯誤';
  end if;

  v_selected := coalesce(v_room.selected_players, '{}'::jsonb);

  for v_key in select jsonb_object_keys(v_selected)
  loop
    if v_selected ->> v_key = v_client_id then
      v_selected := v_selected - v_key;
    end if;
  end loop;

  update public.rojhu_rooms
  set selected_players = v_selected
  where code = v_room.code
  returning * into v_room;

  return public.rojhu_room_payload(v_room, v_password);
end;
$$;

drop function if exists public.update_rojhu_route_cell(text, text, text, integer, integer);

create or replace function public.update_rojhu_route_cell(
  p_code text,
  p_password text,
  p_player text,
  p_row_index integer,
  p_col_index integer,
  p_client_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rojhu_rooms;
  v_password text := btrim(coalesce(p_password, ''));
  v_client_id text := btrim(coalesce(p_client_id, ''));
begin
  if p_player not in ('101', '102', '103', '104') then
    raise exception '角色代號錯誤';
  end if;

  if p_row_index < 0 or p_row_index > 9 then
    raise exception '樓層索引錯誤';
  end if;

  if p_col_index is not null and (p_col_index < 0 or p_col_index > 3) then
    raise exception '平台索引錯誤';
  end if;

  select * into v_room
  from public.rojhu_rooms
  where code = btrim(coalesce(p_code, ''));

  if not found then
    raise exception '找不到此房間';
  end if;

  if crypt(v_password, v_room.password_hash) <> v_room.password_hash then
    raise exception '房間密碼錯誤';
  end if;

  if v_client_id <> '' and coalesce(v_room.selected_players ->> p_player, '') <> v_client_id then
    raise exception '請先選擇並鎖定角色';
  end if;

  update public.rojhu_rooms
  set routes = jsonb_set(routes, array[p_player, p_row_index::text], coalesce(to_jsonb(p_col_index), 'null'::jsonb), true)
  where code = v_room.code
  returning * into v_room;

  return public.rojhu_room_payload(v_room, v_password);
end;
$$;

create or replace function public.reset_rojhu_room_routes(p_code text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rojhu_rooms;
  v_password text := btrim(coalesce(p_password, ''));
begin
  select * into v_room
  from public.rojhu_rooms
  where code = btrim(coalesce(p_code, ''));

  if not found then
    raise exception '找不到此房間';
  end if;

  if crypt(v_password, v_room.password_hash) <> v_room.password_hash then
    raise exception '房間密碼錯誤';
  end if;

  update public.rojhu_rooms
  set routes = public.rojhu_empty_routes()
  where code = v_room.code
  returning * into v_room;

  return public.rojhu_room_payload(v_room, v_password);
end;
$$;

create or replace function public.save_rojhu_last_routes(p_code text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rojhu_rooms;
  v_password text := btrim(coalesce(p_password, ''));
begin
  select * into v_room
  from public.rojhu_rooms
  where code = btrim(coalesce(p_code, ''));

  if not found then
    raise exception '找不到此房間';
  end if;

  if crypt(v_password, v_room.password_hash) <> v_room.password_hash then
    raise exception '房間密碼錯誤';
  end if;

  update public.rojhu_rooms
  set last_routes = routes
  where code = v_room.code
  returning * into v_room;

  return public.rojhu_room_payload(v_room, v_password);
end;
$$;

create or replace function public.clear_rojhu_last_routes(p_code text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rojhu_rooms;
  v_password text := btrim(coalesce(p_password, ''));
begin
  select * into v_room
  from public.rojhu_rooms
  where code = btrim(coalesce(p_code, ''));

  if not found then
    raise exception '找不到此房間';
  end if;

  if crypt(v_password, v_room.password_hash) <> v_room.password_hash then
    raise exception '房間密碼錯誤';
  end if;

  update public.rojhu_rooms
  set last_routes = public.rojhu_empty_routes()
  where code = v_room.code
  returning * into v_room;

  return public.rojhu_room_payload(v_room, v_password);
end;
$$;

create or replace function public.expire_rojhu_room_if_idle(p_code text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.rojhu_rooms;
  v_password text := btrim(coalesce(p_password, ''));
begin
  select * into v_room
  from public.rojhu_rooms
  where code = btrim(coalesce(p_code, ''));

  if not found then
    raise exception '找不到此房間';
  end if;

  if crypt(v_password, v_room.password_hash) <> v_room.password_hash then
    raise exception '房間密碼錯誤';
  end if;

  if v_room.updated_at > now() - interval '1 hour' then
    return public.rojhu_room_payload(v_room, v_password);
  end if;

  update public.rojhu_rooms
  set routes = public.rojhu_empty_routes(), last_routes = public.rojhu_empty_routes(), selected_players = '{}'::jsonb
  where code = v_room.code
  returning * into v_room;

  return public.rojhu_room_payload(v_room, v_password);
end;
$$;

grant execute on function public.rojhu_validate_password(text) to anon, authenticated;
grant execute on function public.create_rojhu_room(text, text) to anon, authenticated;
grant execute on function public.join_rojhu_room(text, text) to anon, authenticated;
grant execute on function public.claim_rojhu_player(text, text, text, text) to anon, authenticated;
grant execute on function public.release_rojhu_player(text, text, text) to anon, authenticated;
grant execute on function public.update_rojhu_route_cell(text, text, text, integer, integer, text) to anon, authenticated;
grant execute on function public.reset_rojhu_room_routes(text, text) to anon, authenticated;
grant execute on function public.save_rojhu_last_routes(text, text) to anon, authenticated;
grant execute on function public.clear_rojhu_last_routes(text, text) to anon, authenticated;
grant execute on function public.expire_rojhu_room_if_idle(text, text) to anon, authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'rojhu_rooms'
  ) then
    alter publication supabase_realtime add table public.rojhu_rooms;
  end if;
end $$;
