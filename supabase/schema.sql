-- Maple Raid Board Supabase schema
-- Open demo mode: anon users can read/write. Tighten these policies before production.

create extension if not exists pgcrypto;

create table if not exists public.raid_groups (
  id text primary key,
  title text not null,
  boss text not null,
  raid_date date not null,
  raid_time time not null,
  leader text not null,
  min_level integer not null default 1 check (min_level >= 1),
  capacity integer not null default 30 check (capacity between 1 and 60),
  status text not null default 'open' check (status in ('open', 'closed', 'finished')),
  notice text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.raid_members (
  id uuid primary key default gen_random_uuid(),
  group_id text not null references public.raid_groups(id) on delete cascade,
  name text not null,
  job text not null,
  level integer not null check (level >= 1),
  role text not null,
  party integer not null default 1 check (party between 1 and 6),
  status text not null default '待確認' check (status in ('待確認', '已確認', '候補', '請假')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

alter table public.raid_groups enable row level security;
alter table public.raid_members enable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.raid_groups to anon, authenticated;
grant select, insert, update, delete on public.raid_members to anon, authenticated;

-- Public demo policies. Anyone with the anon key can change data.
drop policy if exists "Public read raid groups" on public.raid_groups;
create policy "Public read raid groups"
on public.raid_groups
for select
to anon, authenticated
using (true);

drop policy if exists "Public create raid groups" on public.raid_groups;
create policy "Public create raid groups"
on public.raid_groups
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public update raid groups" on public.raid_groups;
create policy "Public update raid groups"
on public.raid_groups
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Public delete raid groups" on public.raid_groups;
create policy "Public delete raid groups"
on public.raid_groups
for delete
to anon, authenticated
using (true);

drop policy if exists "Public read raid members" on public.raid_members;
create policy "Public read raid members"
on public.raid_members
for select
to anon, authenticated
using (true);

drop policy if exists "Public create raid members" on public.raid_members;
create policy "Public create raid members"
on public.raid_members
for insert
to anon, authenticated
with check (true);

drop policy if exists "Public update raid members" on public.raid_members;
create policy "Public update raid members"
on public.raid_members
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "Public delete raid members" on public.raid_members;
create policy "Public delete raid members"
on public.raid_members
for delete
to anon, authenticated
using (true);

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
insert into public.raid_groups (id, title, boss, raid_date, raid_time, leader, min_level, capacity, status, notice)
values
  ('demo-zakum-soon', '炎魔固定團 - 今晚 22:30', '殘暴炎魔 Zakum', current_date, '22:30', 'Cocoa', 90, 30, 'open', '請提前 10 分鐘到門口集合。缺萬能、聖水、眼藥水請先補。'),
  ('demo-horntail-weekend', '龍王拓荒團 - 週末', '闇黑龍王 Horntail', current_date + 3, '21:00', 'Tyok', 120, 30, 'open', '拓荒團，請確認命中、藥水與復活規則。未達門檻可先排候補。'),
  ('demo-papulatus-casual', '鐘王休閒團 - 缺 3', '鐘王 Papulatus', current_date + 1, '23:00', 'Momo', 100, 12, 'open', '輕鬆打，報名後請留職業與等級。')
on conflict (id) do update set
  title = excluded.title,
  boss = excluded.boss,
  raid_date = excluded.raid_date,
  raid_time = excluded.raid_time,
  leader = excluded.leader,
  min_level = excluded.min_level,
  capacity = excluded.capacity,
  status = excluded.status,
  notice = excluded.notice;

delete from public.raid_members where group_id in ('demo-zakum-soon', 'demo-horntail-weekend', 'demo-papulatus-casual');

insert into public.raid_members (group_id, name, job, level, role, party, status, note)
values
  ('demo-zakum-soon', '可可', '主教', 128, '補師', 1, '已確認', '可開語音'),
  ('demo-zakum-soon', '阿楓', '英雄', 132, '主輸出', 1, '已確認', ''),
  ('demo-zakum-soon', '小夜', '夜使者', 121, '主輸出', 1, '待確認', '可能晚 5 分鐘'),
  ('demo-zakum-soon', '冰茶', '冰雷魔導士', 116, '副輸出', 2, '已確認', ''),
  ('demo-zakum-soon', '黑糖', '黑騎士', 119, '輔助', 2, '已確認', '聖火'),
  ('demo-zakum-soon', '弩弓手90', '神射手', 94, '副輸出', 2, '候補', '第一次打'),
  ('demo-horntail-weekend', 'Tyok', '黑騎士', 145, '隊長', 1, '已確認', '指揮'),
  ('demo-horntail-weekend', '梅子', '主教', 137, '補師', 1, '已確認', ''),
  ('demo-horntail-weekend', '貓拳', '拳霸', 129, '副輸出', 2, '待確認', ''),
  ('demo-papulatus-casual', 'Momo', '暗影神偷', 125, '隊長', 1, '已確認', ''),
  ('demo-papulatus-casual', '橘子', '箭神', 111, '主輸出', 1, '已確認', '');
