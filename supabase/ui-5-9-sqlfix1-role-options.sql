-- UI-5.9 SQLFIX1
-- 修正「不支援的角色定位需求：大法」
-- 執行位置：Supabase SQL Editor

set search_path = public, extensions;

alter table public.raid_groups
  alter column role_requirements set default '{"1":["打手","打手","火","煙霧機","輔助","大法"],"2":["打手","打手","火","煙霧機","輔助","大法"],"3":["打手","打手","火","煙霧機","輔助","大法"]}'::jsonb;

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
