-- UI-6.7 SQLFIX：羅茱工具格子支援再次點擊取消選取。
-- 執行位置：Supabase SQL Editor
-- 功能：允許 update_rojhu_route_cell 的 p_col_index 傳入 null，將該角色該層格子清空。

set search_path = public, extensions;

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
