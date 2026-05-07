import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteRaidGroup, deleteRaidMember, fetchRaidGroups, insertRaidGroup, insertRaidMember, updateRaidGroupStatus, updateRaidMemberStatus, updateRaidRoleRequirements, verifyLeaderCode } from './api/raids';
import { CreateRaidModal } from './components/CreateRaidModal';
import { RaidDetail } from './components/RaidDetail';
import { RaidList } from './components/RaidList';
import { SignupPanel } from './components/SignupPanel';
import { NotificationCenter, buildDerivedNotifications, type RaidNotification } from './components/NotificationCenter';
import { Button, Field, Input, Pill, Select, classNames } from './components/ui';
import { getBossDifficultyMeta, getBossDisplayName, getBossVisualMeta, getRaidStatusMeta } from './data/bossArt';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import type { MemberStatus, NewRaidGroup, NewRaidMember, RaidGroup, RaidStatus, RoleRequirementMap } from './types';

function getInitialGroupId() {
  return new URLSearchParams(window.location.search).get('group') || 'demo-zakum-soon';
}


const LEADER_CODE_STORAGE_KEY = 'maple_raid_board_leader_codes_v12';
const SIGNUP_CODE_STORAGE_KEY = 'maple_raid_board_signup_codes_v15';
const NOTIFICATION_EVENTS_STORAGE_KEY = 'maple_raid_board_notifications_v14';
const NOTIFICATION_READ_STORAGE_KEY = 'maple_raid_board_notification_reads_v14';
const NOTIFICATION_SNAPSHOT_STORAGE_KEY = 'maple_raid_board_notification_snapshot_v14';

function loadLeaderCodes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(LEADER_CODE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveLeaderCodes(codes: Record<string, string>) {
  localStorage.setItem(LEADER_CODE_STORAGE_KEY, JSON.stringify(codes));
}

function loadSignupCodes(): Record<string, string> {
  try {
    const raw = localStorage.getItem(SIGNUP_CODE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveSignupCodes(codes: Record<string, string>) {
  localStorage.setItem(SIGNUP_CODE_STORAGE_KEY, JSON.stringify(codes));
}

function getInviteCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('invite') || params.get('signupCode') || params.get('raidCode') || '').trim();
}

function buildGroupShareUrl(groupId: string, signupCode?: string) {
  const url = new URL(window.location.href);
  url.searchParams.set('group', groupId);
  if (signupCode?.trim()) {
    url.searchParams.set('invite', signupCode.trim());
  } else {
    url.searchParams.delete('invite');
    url.searchParams.delete('signupCode');
    url.searchParams.delete('raidCode');
  }
  return url.toString();
}

function loadJsonObject<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function loadLocalNotificationEvents(): RaidNotification[] {
  const parsed = loadJsonObject<RaidNotification[]>(NOTIFICATION_EVENTS_STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveLocalNotificationEvents(items: RaidNotification[]) {
  localStorage.setItem(NOTIFICATION_EVENTS_STORAGE_KEY, JSON.stringify(items.slice(0, 80)));
}

function loadNotificationReadIds(): string[] {
  const parsed = loadJsonObject<string[]>(NOTIFICATION_READ_STORAGE_KEY, []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveNotificationReadIds(ids: string[]) {
  localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids)).slice(0, 240)));
}

type NotificationSnapshot = {
  groups: Record<string, { title: string; boss: string; status: RaidStatus; updatedAt: string }>;
  members: Record<string, { groupId: string; groupTitle: string; name: string; status: MemberStatus; updatedAt: string }>;
};

function buildNotificationSnapshot(groups: RaidGroup[]): NotificationSnapshot {
  const snapshot: NotificationSnapshot = { groups: {}, members: {} };
  for (const group of groups) {
    snapshot.groups[group.id] = {
      title: group.title,
      boss: group.boss,
      status: group.status,
      updatedAt: group.updatedAt,
    };
    for (const member of group.members) {
      snapshot.members[member.id] = {
        groupId: group.id,
        groupTitle: group.title,
        name: member.name,
        status: member.status,
        updatedAt: member.updatedAt,
      };
    }
  }
  return snapshot;
}

function loadNotificationSnapshot(): NotificationSnapshot | null {
  return loadJsonObject<NotificationSnapshot | null>(NOTIFICATION_SNAPSHOT_STORAGE_KEY, null);
}

function saveNotificationSnapshot(snapshot: NotificationSnapshot) {
  localStorage.setItem(NOTIFICATION_SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshot));
}




type RojhuPlayerId = '101' | '102' | '103' | '104';
type RojhuRoutes = Record<RojhuPlayerId, Array<number | null>>;
type RojhuSelectedPlayers = Partial<Record<RojhuPlayerId, string>>;
type RojhuRoom = {
  code: string;
  password: string;
  createdAt: string;
  updatedAt: string;
  routes: RojhuRoutes;
  lastRoutes: RojhuRoutes;
  selectedPlayers: RojhuSelectedPlayers;
};

const ROJHU_PLAYERS: RojhuPlayerId[] = ['101', '102', '103', '104'];
const ROJHU_CLIENT_ID_STORAGE_KEY = 'maple_raid_board_rojhu_client_id_v25';
const ROJHU_SELECTED_PLAYER_STORAGE_KEY = 'maple_raid_board_rojhu_selected_player_v21';

function createEmptyRoutes(): RojhuRoutes {
  return {
    '101': Array(10).fill(null),
    '102': Array(10).fill(null),
    '103': Array(10).fill(null),
    '104': Array(10).fill(null),
  };
}

function loadRojhuSelectedPlayers(): Record<string, RojhuPlayerId> {
  const parsed = loadJsonObject<Record<string, RojhuPlayerId>>(ROJHU_SELECTED_PLAYER_STORAGE_KEY, {});
  return parsed && typeof parsed === 'object' ? parsed : {};
}

function saveRojhuSelectedPlayers(value: Record<string, RojhuPlayerId>) {
  localStorage.setItem(ROJHU_SELECTED_PLAYER_STORAGE_KEY, JSON.stringify(value));
}

function getRojhuClientId() {
  try {
    const saved = localStorage.getItem(ROJHU_CLIENT_ID_STORAGE_KEY);
    if (saved && /^[a-zA-Z0-9_-]{12,80}$/.test(saved)) return saved;
  } catch {
    // ignore storage errors
  }
  const randomPart = Math.random().toString(36).slice(2, 14);
  const timePart = Date.now().toString(36);
  const next = `client_${timePart}_${randomPart}`;
  try {
    localStorage.setItem(ROJHU_CLIENT_ID_STORAGE_KEY, next);
  } catch {
    // ignore storage errors
  }
  return next;
}

function normalizeRojhuSelectedPlayers(value: unknown): RojhuSelectedPlayers {
  if (!value || typeof value !== 'object') return {};
  const source = value as Record<string, unknown>;
  const next: RojhuSelectedPlayers = {};
  for (const player of ROJHU_PLAYERS) {
    const clientId = source[player];
    if (typeof clientId === 'string' && clientId.trim()) next[player] = clientId;
  }
  return next;
}

function normalizeRojhuRoutes(value: unknown): RojhuRoutes {
  const fallback = createEmptyRoutes();
  if (!value || typeof value !== 'object') return fallback;
  const source = value as Record<string, unknown>;
  const next = createEmptyRoutes();

  for (const player of ROJHU_PLAYERS) {
    const raw = Array.isArray(source[player]) ? source[player] as unknown[] : [];
    next[player] = Array.from({ length: 10 }, (_, index) => {
      const item = raw[index];
      return typeof item === 'number' && Number.isInteger(item) && item >= 0 && item <= 3 ? item : null;
    });
  }

  return next;
}

function normalizeRojhuRoom(row: any, password: string): RojhuRoom {
  return {
    code: String(row?.code || ''),
    password,
    createdAt: String(row?.created_at || row?.createdAt || new Date().toISOString()),
    updatedAt: String(row?.updated_at || row?.updatedAt || new Date().toISOString()),
    routes: normalizeRojhuRoutes(row?.routes),
    lastRoutes: normalizeRojhuRoutes(row?.last_routes || row?.lastRoutes),
    selectedPlayers: normalizeRojhuSelectedPlayers(row?.selected_players || row?.selectedPlayers),
  };
}

async function createRemoteRojhuRoom(password: string, code?: string): Promise<RojhuRoom> {
  const { data, error } = await (supabase as any).rpc('create_rojhu_room', {
    p_password: password.trim() || null,
    p_code: code?.trim() || null,
  });

  if (error) throw new Error(error.message);
  return normalizeRojhuRoom(data, String(data?.password || password));
}

async function joinRemoteRojhuRoom(code: string, password: string): Promise<RojhuRoom> {
  const { data, error } = await (supabase as any).rpc('join_rojhu_room', {
    p_code: code.trim(),
    p_password: password.trim(),
  });

  if (error) throw new Error(error.message);
  return normalizeRojhuRoom(data, password.trim());
}

async function updateRemoteRojhuRoute(code: string, password: string, player: RojhuPlayerId, row: number, col: number, clientId: string): Promise<RojhuRoom> {
  const { data, error } = await (supabase as any).rpc('update_rojhu_route_cell', {
    p_code: code,
    p_password: password,
    p_player: player,
    p_row_index: row,
    p_col_index: col,
    p_client_id: clientId,
  });

  if (error) throw new Error(error.message);
  return normalizeRojhuRoom(data, password);
}

async function claimRemoteRojhuPlayer(code: string, password: string, player: RojhuPlayerId, clientId: string): Promise<RojhuRoom> {
  const { data, error } = await (supabase as any).rpc('claim_rojhu_player', {
    p_code: code,
    p_password: password,
    p_player: player,
    p_client_id: clientId,
  });

  if (error) throw new Error(error.message);
  return normalizeRojhuRoom(data, password);
}

async function releaseRemoteRojhuPlayer(code: string, password: string, clientId: string): Promise<RojhuRoom> {
  const { data, error } = await (supabase as any).rpc('release_rojhu_player', {
    p_code: code,
    p_password: password,
    p_client_id: clientId,
  });

  if (error) throw new Error(error.message);
  return normalizeRojhuRoom(data, password);
}

async function resetRemoteRojhuRoom(code: string, password: string): Promise<RojhuRoom> {
  const { data, error } = await (supabase as any).rpc('reset_rojhu_room_routes', {
    p_code: code,
    p_password: password,
  });

  if (error) throw new Error(error.message);
  return normalizeRojhuRoom(data, password);
}

async function saveRemoteRojhuLastRoutes(code: string, password: string): Promise<RojhuRoom> {
  const { data, error } = await (supabase as any).rpc('save_rojhu_last_routes', {
    p_code: code,
    p_password: password,
  });

  if (error) throw new Error(error.message);
  return normalizeRojhuRoom(data, password);
}

async function clearRemoteRojhuLastRoutes(code: string, password: string): Promise<RojhuRoom> {
  const { data, error } = await (supabase as any).rpc('clear_rojhu_last_routes', {
    p_code: code,
    p_password: password,
  });

  if (error) throw new Error(error.message);
  return normalizeRojhuRoom(data, password);
}

async function expireRemoteRojhuRoomIfIdle(code: string, password: string): Promise<RojhuRoom> {
  const { data, error } = await (supabase as any).rpc('expire_rojhu_room_if_idle', {
    p_code: code,
    p_password: password,
  });

  if (error) throw new Error(error.message);
  return normalizeRojhuRoom(data, password);
}

function getRojhuRoomCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('rojhuRoom') || params.get('room') || '').trim();
}

function getRojhuRoomPasswordFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return (params.get('rojhuPass') || params.get('pass') || '').trim();
}

function buildRojhuShareUrl(room: RojhuRoom) {
  const url = new URL(window.location.href);
  url.searchParams.set('tool', 'rojhu');
  url.searchParams.set('rojhuRoom', room.code);
  url.searchParams.set('rojhuPass', room.password);
  return url.toString();
}

function formatRojhuRoute(route?: Array<number | null>) {
  const safeRoute = Array.isArray(route) ? route : Array(10).fill(null);
  return safeRoute.map((value) => (value == null ? '?' : String(value + 1))).join(' → ');
}

function hasAnyRojhuRoute(routes?: RojhuRoutes) {
  if (!routes) return false;
  return ROJHU_PLAYERS.some((player) => routes[player]?.some((value) => value != null));
}

function isRojhuRoomIdleExpired(room: RojhuRoom) {
  const updatedAt = new Date(room.updatedAt).getTime();
  if (!Number.isFinite(updatedAt)) return false;
  return Date.now() - updatedAt >= 60 * 60 * 1000;
}

function MapleLeafLogo() {
  return (
    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 via-red-500 to-amber-500 text-white shadow-lg shadow-orange-500/20 ring-1 ring-orange-200/60">
      <svg viewBox="0 0 64 64" className="h-8 w-8 drop-shadow" aria-label="maple leaf logo" role="img">
        <path
          fill="currentColor"
          d="M32 5l4.5 13.2 8.8-8.4-1.7 13.1 12.9-2.7-8.1 10.4 10.9 5.2-12.8 3 5.2 10.8-11.7-5.5-2.7 14.9-5.3-12.9-5.3 12.9-2.7-14.9-11.7 5.5 5.2-10.8-12.8-3 10.9-5.2-8.1-10.4 12.9 2.7-1.7-13.1 8.8 8.4L32 5z"
        />
        <path fill="rgba(255,255,255,0.45)" d="M32 12l2.4 9.5L32 39.8l-2.4-18.3L32 12z" />
      </svg>
    </div>
  );
}

function statusLabel(status: RaidStatus | MemberStatus) {
  const map: Record<string, string> = {
    open: '招募中',
    closed: '招募截止',
    finished: '已結束',
    待確認: '待確認',
    已確認: '已確認',
    候補: '候補',
    請假: '請假',
  };
  return map[status] || status;
}

type ActivePanel = 'home' | 'raid' | 'signup' | 'favorite' | 'notice' | 'rojhuTools' | 'trainingEfficiency' | 'settings';

function NavigationRail({ activePanel, onChange, noticeCount }: { activePanel: ActivePanel; onChange: (panel: ActivePanel) => void; noticeCount: number }) {
  const items: Array<{ icon: string; label: string; panel: ActivePanel; badge?: string; helper?: string }> = [
    { icon: '⌂', label: '首頁', panel: 'home', helper: '突襲場次清單' },
    { icon: '🍁', label: '楓突襲', panel: 'raid', helper: '突襲詳細內容' },
    { icon: '✎', label: '我要報名', panel: 'signup', helper: '報名表單' },
    { icon: '☆', label: '團連結收藏', panel: 'favorite', helper: '團連結 / 帶邀請碼連結快速收藏' },
    { icon: '●', label: '通知', panel: 'notice', badge: noticeCount > 0 ? String(Math.min(99, noticeCount)) : undefined, helper: '開團提醒 / 狀態變更 / 候補轉正' },
    { icon: '🧰', label: '羅茱工具', panel: 'rojhuTools', helper: '常用連結與快速操作' },
    { icon: '⚡', label: '練功效率', panel: 'trainingEfficiency', helper: 'EXP / 分與升級時間估算' },
    { icon: '⚙', label: '設定', panel: 'settings', helper: '本機保存的團管理碼 / 邀請碼 / 邀請連結' },
  ];

  return (
    <nav className="flex overflow-x-auto rounded-[2rem] border border-orange-100/80 bg-white/80 p-2 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.8)] backdrop-blur-xl lg:h-[calc(100vh-112px)] lg:flex-col lg:items-center lg:gap-2 lg:sticky lg:top-24">
      {items.map((item) => {
        const active = activePanel === item.panel;
        return (
          <button
            key={item.label}
            type="button"
            onClick={() => onChange(item.panel)}
            className={classNames(
              'relative grid min-w-[78px] place-items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-bold transition lg:w-full lg:min-w-0',
              active ? 'bg-orange-100 text-orange-700 shadow-inner' : 'text-slate-500 hover:bg-orange-50 hover:text-orange-700',
            )}
            title={item.helper}
          >
            <span className="text-xl leading-none">{item.icon}</span>
            <span className="whitespace-nowrap">{item.label}</span>
            {item.badge ? <span className="absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] text-white">{item.badge}</span> : null}
          </button>
        );
      })}
    </nav>
  );
}

function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return (
    <aside className="rounded-[2rem] border border-orange-100/80 bg-white/75 p-5 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl lg:sticky lg:top-24 lg:h-[calc(100vh-112px)]">
      <div className="grid h-full place-items-center rounded-3xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center">
        <div>
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-3xl bg-white text-2xl shadow-sm">楓</div>
          <h2 className="mt-4 text-lg font-black text-slate-950">{title}</h2>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">{description}</p>
        </div>
      </div>
    </aside>
  );
}

function LinkFavoritesPanel({ selectedGroup, selectedSignupCode, onGoSettings }: { selectedGroup?: RaidGroup; selectedSignupCode: string; onGoSettings: () => void }) {
  const [copied, setCopied] = useState<string | null>(null);

  async function copyText(label: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1600);
  }

  const cleanLink = selectedGroup ? buildGroupShareUrl(selectedGroup.id) : '';
  const inviteLink = selectedGroup ? buildGroupShareUrl(selectedGroup.id, selectedSignupCode) : '';

  return (
    <section className="rounded-[2rem] border border-orange-100/80 bg-white/80 p-6 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">Raid Link Favorites</div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">團連結收藏</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-slate-500">集中保存與複製目前選取團的一般團連結、帶邀請碼連結。這裡不會修改資料庫，只使用目前瀏覽器已保存的團資料。</p>
        </div>
        <Button variant="secondary" onClick={onGoSettings}>查看設定 / 邀請碼</Button>
      </div>

      {selectedGroup ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-orange-100 bg-orange-50/70 p-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">目前選取團</div>
            <div className="mt-2 text-lg font-black text-slate-950">{selectedGroup.title}</div>
            <div className="mt-1 text-sm font-semibold text-slate-500">{getBossDisplayName(selectedGroup.boss)} · {selectedGroup.raidDate} {selectedGroup.raidTime}</div>
          </div>
          <div className="rounded-3xl border border-orange-100 bg-white/80 p-4">
            <div className="text-sm font-black text-slate-950">快速複製</div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => copyText('團連結', cleanLink)}>{copied === '團連結' ? '已複製' : '複製團連結'}</Button>
              <Button variant="secondary" disabled={!selectedSignupCode} onClick={() => copyText('邀請連結', inviteLink)}>{copied === '邀請連結' ? '已複製' : '複製帶邀請碼連結'}</Button>
            </div>
            {!selectedSignupCode ? <p className="mt-3 text-xs font-semibold text-amber-700">此瀏覽器尚未保存這團的報名邀請碼。請到「設定」或「楓突襲」頁補上。</p> : null}
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-3xl border border-dashed border-orange-200 bg-orange-50 p-8 text-center text-sm font-semibold text-slate-500">尚未選取任何突襲場次。</div>
      )}
    </section>
  );
}


function RojhuToolsPanel() {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomPasswordInput, setRoomPasswordInput] = useState('');
  const [joinCode, setJoinCode] = useState(() => getRojhuRoomCodeFromUrl());
  const [joinPassword, setJoinPassword] = useState(() => getRojhuRoomPasswordFromUrl());
  const [currentRoom, setCurrentRoom] = useState<RojhuRoom | null>(null);
  const [activePlayer, setActivePlayer] = useState<RojhuPlayerId>('101');
  const [selectedPlayersByRoom, setSelectedPlayersByRoom] = useState<Record<string, RojhuPlayerId>>(() => loadRojhuSelectedPlayers());
  const [rojhuClientId] = useState(() => getRojhuClientId());
  const [rojhuMessage, setRojhuMessage] = useState<string>('');
  const [rojhuBusy, setRojhuBusy] = useState(false);
  const selectedPlayer = currentRoom ? ROJHU_PLAYERS.find((player) => currentRoom.selectedPlayers[player] === rojhuClientId) : undefined;

  function flashMessage(message: string) {
    setRojhuMessage(message);
    window.setTimeout(() => setRojhuMessage(''), 1800);
  }

  async function updateSelectedPlayerForRoom(roomCode: string, player: RojhuPlayerId) {
    if (!currentRoom) return;
    await runRojhuAction(async () => {
      const room = await claimRemoteRojhuPlayer(roomCode, currentRoom.password, player, rojhuClientId);
      setSelectedPlayersByRoom((prev) => {
        const next = { ...prev, [roomCode]: player };
        saveRojhuSelectedPlayers(next);
        return next;
      });
      setActivePlayer(player);
      return room;
    }, `已鎖定角色 ${player}`);
  }

  async function runRojhuAction(action: () => Promise<RojhuRoom | void>, successMessage?: string) {
    setRojhuBusy(true);
    try {
      const result = await action();
      if (result) {
        setCurrentRoom(result);
        setJoinCode(result.code);
        setJoinPassword(result.password);
        const remotePlayer = ROJHU_PLAYERS.find((player) => result.selectedPlayers[player] === rojhuClientId);
        const savedPlayer = selectedPlayersByRoom[result.code];
        if (remotePlayer || savedPlayer) setActivePlayer(remotePlayer || savedPlayer);
      }
      if (successMessage) flashMessage(successMessage);
    } catch (err) {
      flashMessage(err instanceof Error ? err.message : '羅茱工具操作失敗');
    } finally {
      setRojhuBusy(false);
    }
  }

  async function createRoom() {
    await runRojhuAction(async () => {
      const room = await createRemoteRojhuRoom(roomPasswordInput, roomCodeInput);
      const url = new URL(window.location.href);
      url.searchParams.set('tool', 'rojhu');
      url.searchParams.set('rojhuRoom', room.code);
      url.searchParams.set('rojhuPass', room.password);
      window.history.replaceState({}, '', url.toString());
      return room;
    }, '已建立房間並啟用即時同步');
  }

  async function joinRoom() {
    await runRojhuAction(async () => {
      const room = await joinRemoteRojhuRoom(joinCode, joinPassword);
      const url = new URL(window.location.href);
      url.searchParams.set('tool', 'rojhu');
      url.searchParams.set('rojhuRoom', room.code);
      url.searchParams.set('rojhuPass', room.password);
      window.history.replaceState({}, '', url.toString());
      return room;
    }, '已加入房間並啟用即時同步');
  }

  async function exitRoom() {
    const roomToExit = currentRoom;
    if (roomToExit) {
      try {
        await releaseRemoteRojhuPlayer(roomToExit.code, roomToExit.password, rojhuClientId);
      } catch {
        // ignore release failure; local exit should still work
      }
      setSelectedPlayersByRoom((prev) => {
        const next = { ...prev };
        delete next[roomToExit.code];
        saveRojhuSelectedPlayers(next);
        return next;
      });
    }
    setCurrentRoom(null);
    setActivePlayer('101');
    const url = new URL(window.location.href);
    url.searchParams.delete('tool');
    url.searchParams.delete('rojhuRoom');
    url.searchParams.delete('rojhuPass');
    url.searchParams.delete('room');
    url.searchParams.delete('pass');
    window.history.replaceState({}, '', url.toString());
    flashMessage('已退出目前房間');
  }

  async function expireAndExitRoom() {
    const roomToExpire = currentRoom;
    if (!roomToExpire) return;
    try {
      await expireRemoteRojhuRoomIfIdle(roomToExpire.code, roomToExpire.password);
    } catch {
      // ignore expiration failure; local exit should still work
    }
    setSelectedPlayersByRoom((prev) => {
      const next = { ...prev };
      delete next[roomToExpire.code];
      saveRojhuSelectedPlayers(next);
      return next;
    });
    setCurrentRoom(null);
    setActivePlayer('101');
    const url = new URL(window.location.href);
    url.searchParams.delete('tool');
    url.searchParams.delete('rojhuRoom');
    url.searchParams.delete('rojhuPass');
    url.searchParams.delete('room');
    url.searchParams.delete('pass');
    window.history.replaceState({}, '', url.toString());
    flashMessage('房間閒置超過 1 小時，已強制退出並清空紀錄');
  }

  useEffect(() => {
    const code = getRojhuRoomCodeFromUrl();
    const password = getRojhuRoomPasswordFromUrl();
    if (!code || !password || currentRoom) return;
    void runRojhuAction(() => joinRemoteRojhuRoom(code, password), '已由分享連結加入房間');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentRoom || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`rojhu-room-${currentRoom.code}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rojhu_rooms', filter: `code=eq.${currentRoom.code}` }, () => {
        void joinRemoteRojhuRoom(currentRoom.code, currentRoom.password)
          .then(setCurrentRoom)
          .catch(() => undefined);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentRoom?.code, currentRoom?.password]);


  useEffect(() => {
    if (!currentRoom) return;

    if (isRojhuRoomIdleExpired(currentRoom)) {
      void expireAndExitRoom();
      return;
    }

    const timer = window.setInterval(() => {
      if (currentRoom && isRojhuRoomIdleExpired(currentRoom)) {
        void expireAndExitRoom();
      }
    }, 30 * 1000);

    return () => window.clearInterval(timer);
  }, [currentRoom?.code, currentRoom?.password, currentRoom?.updatedAt]);

  async function applyRoute(rowIndex: number, columnIndex: number) {
    if (!currentRoom) return;
    if (!selectedPlayer) {
      flashMessage('請先選擇你的角色。每人只能選一個角色。');
      return;
    }
    await runRojhuAction(async () => {
      await updateRemoteRojhuRoute(currentRoom.code, currentRoom.password, selectedPlayer, rowIndex, columnIndex, rojhuClientId);
      return saveRemoteRojhuLastRoutes(currentRoom.code, currentRoom.password);
    });
  }

  function getKeyboardTargetRow(): number | null {
    if (!currentRoom || !selectedPlayer) return null;
    const route = currentRoom.routes[selectedPlayer];
    const nextEmpty = route.findIndex((value) => value == null);
    return nextEmpty >= 0 ? nextEmpty : null;
  }

  useEffect(() => {
    if (!currentRoom || !selectedPlayer) return;

    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable) return;
      if (!['1', '2', '3', '4'].includes(event.key)) return;

      event.preventDefault();
      const columnIndex = Number(event.key) - 1;
      const rowIndex = getKeyboardTargetRow();
      if (rowIndex == null) {
        flashMessage('10 層都已填，快捷鍵停止填入。請重置全清除或手動修改。');
        return;
      }
      void applyRoute(rowIndex, columnIndex);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentRoom, selectedPlayer, rojhuBusy]);

  async function resetAllRoutes() {
    if (!currentRoom) return;
    const ok = window.confirm('確定重置全隊路徑？101～104 的紀錄都會清空。');
    if (!ok) return;
    await runRojhuAction(() => resetRemoteRojhuRoom(currentRoom.code, currentRoom.password), '已重置全隊路徑');
  }

  async function copyRoomInfo() {
    if (!currentRoom) return;
    await navigator.clipboard.writeText(`房間 ${currentRoom.code} 密碼 ${currentRoom.password}`);
    flashMessage('已複製房間資訊');
  }

  async function copyShareLink() {
    if (!currentRoom) return;
    await navigator.clipboard.writeText(buildRojhuShareUrl(currentRoom));
    flashMessage('已複製房間分享連結');
  }

  const currentPathLabel = useMemo(() => {
    if (!currentRoom) return '尚未加入房間';
    const routeOwner = selectedPlayer || activePlayer;
    return formatRojhuRoute(currentRoom.routes[routeOwner]);
  }, [currentRoom, activePlayer, selectedPlayer]);

  const lastPathLabels = useMemo(() => {
    return ROJHU_PLAYERS.map((player) => {
      const route = currentRoom?.lastRoutes[player] || Array(10).fill(null);
      return {
        player,
        route,
        label: formatRojhuRoute(route),
      };
    });
  }, [currentRoom]);

  async function saveLastRoutes() {
    if (!currentRoom) return;
    await runRojhuAction(() => saveRemoteRojhuLastRoutes(currentRoom.code, currentRoom.password), '已將當下路徑保存到上次路徑');
  }

  async function clearLastRoutes() {
    if (!currentRoom) return;
    await runRojhuAction(() => clearRemoteRojhuLastRoutes(currentRoom.code, currentRoom.password), '已清除上次路徑紀錄');
  }

  const playerButtonClasses: Record<RojhuPlayerId, string> = {
    '101': 'bg-rose-400 text-white',
    '102': 'bg-emerald-400 text-white',
    '103': 'bg-sky-400 text-white',
    '104': 'bg-violet-400 text-white',
  };

  const playerCellClasses: Record<RojhuPlayerId, string> = {
    '101': 'bg-rose-400 text-white border-rose-300',
    '102': 'bg-emerald-400 text-white border-emerald-300',
    '103': 'bg-sky-400 text-white border-sky-300',
    '104': 'bg-violet-400 text-white border-violet-300',
  };

  function multiPlayerCellStyle(players: RojhuPlayerId[]) {
    if (players.length <= 1) return undefined;
    const colorMap: Record<RojhuPlayerId, string> = {
      '101': '#fb7185',
      '102': '#4ade80',
      '103': '#38bdf8',
      '104': '#c084fc',
    };
    const step = 100 / players.length;
    const segments = players.map((player, index) => {
      const start = Math.round(index * step);
      const end = Math.round((index + 1) * step);
      return `${colorMap[player]} ${start}% ${end}%`;
    }).join(', ');
    return { background: `linear-gradient(135deg, ${segments})` };
  }

  function renderLastRoutesMiniGrid() {
    const routes = currentRoom?.lastRoutes;

    return (
      <div className="rounded-2xl border border-orange-100 bg-white/85 p-2 shadow-inner">
        <div className="mb-1 text-center text-[10px] font-black text-slate-400">上次路徑迷你圖</div>
        <div className="grid gap-[2px]">
          {Array.from({ length: 10 }, (_, rowIndex) => {
            const floor = 10 - rowIndex;
            const routeIndex = floor - 1;
            return (
              <div key={`last-mini-${floor}`} className="grid grid-cols-4 gap-[2px]">
                {Array.from({ length: 4 }, (_, columnIndex) => {
                  const selectedPlayers = routes ? ROJHU_PLAYERS.filter((player) => routes[player]?.[routeIndex] === columnIndex) : [];
                  const singlePlayer = selectedPlayers.length === 1 ? selectedPlayers[0] : null;

                  return (
                    <span
                      key={`last-mini-${floor}-${columnIndex}`}
                      style={selectedPlayers.length > 1 ? multiPlayerCellStyle(selectedPlayers) : undefined}
                      className={classNames(
                        'grid h-3 w-3 place-items-center rounded-[3px] border border-orange-100 bg-orange-50 text-[7px] font-black leading-none text-slate-300',
                        singlePlayer && playerCellClasses[singlePlayer],
                      )}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <section className="w-full min-w-0 overflow-x-auto pb-2">
      <div className="grid min-w-[1080px] grid-cols-[420px_minmax(620px,1fr)] gap-4">
        <div className="rounded-[2rem] border border-orange-100/80 bg-white/85 p-5 text-slate-900 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
        <div className="rounded-[1.6rem] border border-orange-100 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-5 shadow-inner">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-gradient-to-br from-orange-100 via-white to-red-100 text-5xl shadow-[0_18px_40px_-24px_rgba(234,88,12,0.75)]">🍄</div>
          <h2 className="mt-5 bg-gradient-to-r from-orange-600 to-red-500 bg-clip-text text-center text-3xl font-black text-transparent">羅茱跳台協作工具</h2>

          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            <Input
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="自訂房號（6位，留空自動）"
              className="bg-white"
            />
            <Input
              value={roomPasswordInput}
              onChange={(e) => setRoomPasswordInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="自訂密碼（4-8位，留空自動）"
              className="bg-white"
            />
          </div>
          <Button className="mt-3 w-full rounded-2xl py-4 text-lg shadow-[0_18px_35px_-16px_rgba(234,88,12,0.8)]" onClick={createRoom} disabled={rojhuBusy || !isSupabaseConfigured}>✨ 建立房間</Button>

          <div className="my-8 flex items-center gap-4 text-sm font-bold text-slate-400">
            <div className="h-px flex-1 bg-orange-100" />
            <span>或加入已有房間</span>
            <div className="h-px flex-1 bg-orange-100" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="輸入6位房間代碼"
              className="bg-white"
            />
            <Input
              value={joinPassword}
              onChange={(e) => setJoinPassword(e.target.value.replace(/\D/g, '').slice(0, 8))}
              placeholder="房間密碼"
              className="bg-white"
            />
          </div>

          <Button variant="secondary" className="mt-3 w-full rounded-2xl py-4 text-lg" onClick={joinRoom} disabled={rojhuBusy || !isSupabaseConfigured}>🚪 加入房間</Button>

          {currentRoom ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <Button variant="secondary" className="text-xs" onClick={copyRoomInfo}>📋 複製房碼</Button>
              <Button variant="secondary" className="text-xs" onClick={copyShareLink}>🔗 分享連結</Button>
              <Button variant="ghost" className="text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={exitRoom}>退出房間</Button>
            </div>
          ) : null}

          {rojhuMessage ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">{rojhuMessage}</div> : null}

          <div className="mt-8 rounded-[1.4rem] border border-orange-100 bg-white/80 p-5">
            <div className="text-lg font-black text-slate-950">使用方法</div>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm font-medium leading-7 text-slate-600">
              <li>一人建立房間，將分享連結或房碼密碼給隊友</li>
              <li>隊友從分享連結或輸入房碼密碼加入</li>
              <li>每人只能選擇一個角色（101-104）</li>
              <li>找到正確平台後點擊對應方塊標記</li>
              <li>路徑會透過 Supabase 自動即時同步</li>
              <li>不同角色顏色會保留顯示，除非按重置全清除</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden rounded-[2rem] border border-orange-100/80 bg-white/85 text-slate-900 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-orange-100 px-4 py-4">
          <div className="flex flex-wrap items-center gap-3 text-sm font-black text-slate-700">
            <button type="button" onClick={exitRoom} className="text-xl text-slate-400 hover:text-orange-600">←</button>
            <span>房間 <span className="text-2xl tracking-widest text-orange-700">{currentRoom?.code || '------'}</span></span>
            <span className="text-slate-400">密碼</span>
            <span className="text-2xl tracking-widest text-orange-700">{currentRoom?.password || '----'}</span>
            <button type="button" onClick={copyRoomInfo} disabled={!currentRoom} className="grid h-8 w-8 place-items-center rounded-lg bg-orange-50 text-lg disabled:opacity-40">📋</button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-black text-slate-500">
            <span>自動同步中</span>
            <span className="inline-block h-3 w-3 rounded-full bg-emerald-500 shadow-[0_0_0_6px_rgba(16,185,129,0.16)]" />
          </div>
        </div>

        <div className="border-b border-orange-100 px-4 py-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div className="text-lg font-black text-slate-950">我的路徑 <span className="ml-2 text-slate-500">{currentPathLabel}</span></div>
            <div className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700 ring-1 ring-orange-100">快捷鍵：按 1 / 2 / 3 / 4 標記下一層；10 層填滿後停止</div>
          </div>
          <div className="mt-4 rounded-2xl border border-orange-100 bg-white/80 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-sm font-black text-slate-950">上次路徑</div>
                <div className="mt-1 text-xs font-semibold text-slate-400">此欄會自動保存目前 101～104 的路徑選擇狀況；清除按鈕只清除上次路徑，不影響目前路徑。</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" className="px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={clearLastRoutes} disabled={!currentRoom || rojhuBusy || !hasAnyRojhuRoute(currentRoom?.lastRoutes)}>清除此欄紀錄</Button>
              </div>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div className="grid gap-2 text-xs font-bold text-slate-500 xl:grid-cols-2">
                {lastPathLabels.map(({ player, label }) => (
                  <div key={player} className="flex min-w-0 items-center gap-2 rounded-xl bg-orange-50/70 px-3 py-2">
                    <span className={classNames('h-3 w-3 shrink-0 rounded-full', playerButtonClasses[player])} />
                    <span className="font-black text-slate-700">{player}</span>
                    <span className="min-w-0 truncate font-mono text-slate-500">{label}</span>
                  </div>
                ))}
              </div>
              <div className="shrink-0 justify-self-start lg:justify-self-end">
                {renderLastRoutesMiniGrid()}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="flex flex-wrap items-center gap-3">
            {ROJHU_PLAYERS.map((player) => {
              const claimedClientId = currentRoom?.selectedPlayers[player];
              const claimedByCurrentClient = claimedClientId === rojhuClientId;
              const lockedByAnother = Boolean(currentRoom && claimedClientId && !claimedByCurrentClient);
              const lockedByCurrentOther = Boolean(currentRoom && selectedPlayer && selectedPlayer !== player);
              return (
                <button
                  key={player}
                  type="button"
                  onClick={() => {
                    if (!currentRoom) {
                      setActivePlayer(player);
                      return;
                    }
                    if (!selectedPlayer && !lockedByAnother) void updateSelectedPlayerForRoom(currentRoom.code, player);
                  }}
                  disabled={lockedByAnother || lockedByCurrentOther || rojhuBusy}
                  className={classNames(
                    'rounded-2xl px-5 py-3 text-xl font-black shadow-lg ring-1 transition disabled:cursor-not-allowed disabled:opacity-35',
                    playerButtonClasses[player],
                    claimedByCurrentClient || (!currentRoom && activePlayer === player) ? 'scale-105 ring-slate-900/20' : 'opacity-75 ring-slate-200 hover:opacity-100',
                    lockedByAnother && 'grayscale',
                  )}
                  title={lockedByAnother ? '此角色已被同房間其他玩家選擇' : lockedByCurrentOther ? '每人只能選擇一個角色。退出房間後可重選。' : '選擇我的角色'}
                >
                  {player}
                </button>
              );
            })}
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="secondary" className="rounded-2xl px-4 py-3" onClick={resetAllRoutes} disabled={!currentRoom || rojhuBusy}>🧹 重置全清除</Button>
              <Button variant="ghost" className="rounded-2xl px-4 py-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700" onClick={exitRoom} disabled={!currentRoom}>退出房間</Button>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3 text-xs font-bold text-slate-500">
            {ROJHU_PLAYERS.map((player) => <span key={player} className="inline-flex items-center gap-2"><span className={classNames('h-3 w-3 rounded-full', playerButtonClasses[player])} />{player}</span>)}
          </div>

          <div className="mt-6 grid min-w-0 gap-2">
            {Array.from({ length: 10 }, (_, rowIndex) => {
              const floor = 10 - rowIndex;
              const routeIndex = floor - 1;
              return (
                <div key={floor} className="grid grid-cols-[24px_repeat(4,60px)] items-center justify-start gap-2">
                  <div className="text-center text-lg font-semibold text-slate-600">{floor}</div>
                  {Array.from({ length: 4 }, (_, columnIndex) => {
                    const selectedPlayers = currentRoom ? ROJHU_PLAYERS.filter((player) => currentRoom.routes[player][routeIndex] === columnIndex) : [];
                    const activeSelected = selectedPlayer ? selectedPlayers.includes(selectedPlayer) : false;
                    const singlePlayer = selectedPlayers.length === 1 ? selectedPlayers[0] : null;
                    return (
                      <button
                        key={`${floor}-${columnIndex}`}
                        type="button"
                        onClick={() => applyRoute(routeIndex, columnIndex)}
                        disabled={!currentRoom || rojhuBusy}
                        style={selectedPlayers.length > 1 ? multiPlayerCellStyle(selectedPlayers) : undefined}
                        className={classNames(
                          'relative grid h-[50px] w-[60px] place-items-center rounded-xl border border-orange-100 bg-orange-50/65 p-0 text-2xl font-black text-slate-300 shadow-inner transition',
                          !currentRoom && 'cursor-not-allowed opacity-50',
                          singlePlayer && playerCellClasses[singlePlayer],
                          activeSelected && 'ring-2 ring-orange-300 shadow-[0_16px_30px_-16px_rgba(249,115,22,0.45)]',
                          currentRoom && selectedPlayers.length === 0 && 'hover:bg-orange-100 hover:text-orange-700'
                        )}
                      >
                        <span className={classNames('pointer-events-none absolute inset-0 flex select-none items-center justify-center text-2xl font-black leading-none', selectedPlayers.length > 0 ? 'text-white' : 'text-slate-300')}>
                          {columnIndex + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}


type TrainingSample = {
  id: string;
  timestamp: number;
  exp: number;
};

function formatTrainingNumber(value: number) {
  if (!Number.isFinite(value)) return '0';
  return Math.round(value).toLocaleString('en-US');
}

function formatTrainingDuration(minutes: number) {
  if (!Number.isFinite(minutes) || minutes <= 0) return '--';
  const total = Math.ceil(minutes);
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  if (hours <= 0) return `${mins} 分鐘`;
  return `${hours}小時 ${mins}分鐘`;
}

function getTrainingElapsedMinutes(samples: TrainingSample[], now: number) {
  if (samples.length === 0) return 0;
  const start = samples[0].timestamp;
  const end = samples.length > 1 ? Math.max(now, samples[samples.length - 1].timestamp) : now;
  return Math.max(0, (end - start) / 60000);
}

function getWindowExpDelta(samples: TrainingSample[], minutes: number, now: number) {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const cutoff = now - minutes * 60000;
  const baseline = [...samples].reverse().find((sample) => sample.timestamp <= cutoff) || samples[0];
  return Math.max(0, last.exp - baseline.exp);
}

function buildExpPerMinutePoints(samples: TrainingSample[]) {
  if (samples.length < 2) return [] as Array<{ minute: number; value: number }>;
  const start = samples[0].timestamp;
  const points: Array<{ minute: number; value: number }> = [];
  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const current = samples[i];
    const elapsed = Math.max(1, current.timestamp - prev.timestamp) / 60000;
    const value = Math.max(0, (current.exp - prev.exp) / elapsed);
    points.push({ minute: (current.timestamp - start) / 60000, value });
  }
  return points;
}

function TrainingStatCard({ title, value, sub, icon }: { title: string; value: string; sub?: string; icon?: string }) {
  return (
    <div className="relative overflow-hidden rounded-[1.6rem] border border-orange-100/80 bg-white/85 p-4 shadow-[0_18px_55px_-44px_rgba(124,45,18,0.75)]">
      <div className="absolute right-4 top-3 text-lg text-orange-400">{icon || '👁'}</div>
      <div className="text-center text-xs font-black text-slate-400">{title}</div>
      <div className="mt-2 text-center text-2xl font-black tracking-tight text-slate-950">{value}</div>
      {sub ? <div className="mx-auto mt-2 w-fit rounded-full bg-orange-100 px-3 py-1 text-xs font-black text-orange-700">{sub}</div> : null}
    </div>
  );
}

function TrainingChart({ samples }: { samples: TrainingSample[] }) {
  const points = buildExpPerMinutePoints(samples);
  const width = 980;
  const height = 300;
  const paddingX = 34;
  const paddingY = 24;
  const maxMinute = Math.max(1, ...points.map((point) => point.minute));
  const maxValue = Math.max(1000, ...points.map((point) => point.value));
  const path = points.map((point, index) => {
    const x = paddingX + (point.minute / maxMinute) * (width - paddingX * 2);
    const y = height - paddingY - (point.value / maxValue) * (height - paddingY * 2);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');
  const fillPath = path ? `${path} L ${width - paddingX} ${height - paddingY} L ${paddingX} ${height - paddingY} Z` : '';

  return (
    <div className="rounded-[1.8rem] border border-orange-100 bg-slate-950 p-4 shadow-[0_24px_70px_-46px_rgba(15,23,42,0.95)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-black text-orange-100/80">
        <span>EXP / 分趨勢</span>
        <span>{formatTrainingNumber(maxValue)} EXP / 分</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px] rounded-2xl bg-slate-950">
          {[0.2, 0.4, 0.6, 0.8, 1].map((ratio) => (
            <line key={ratio} x1={paddingX} x2={width - paddingX} y1={height - paddingY - ratio * (height - paddingY * 2)} y2={height - paddingY - ratio * (height - paddingY * 2)} stroke="rgba(251,146,60,0.18)" strokeDasharray="6 6" />
          ))}
          {fillPath ? <path d={fillPath} fill="rgba(249,115,22,0.22)" /> : null}
          {path ? <path d={path} fill="none" stroke="rgb(251,146,60)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {points.length === 0 ? <text x={width / 2} y={height / 2} textAnchor="middle" fill="rgba(255,237,213,0.72)" fontSize="16" fontWeight="800">加入至少 2 筆 EXP 紀錄後顯示趨勢圖</text> : null}
          <text x={paddingX} y={height - 6} fill="rgba(255,237,213,0.65)" fontSize="12">0.0 分</text>
          <text x={width - paddingX} y={height - 6} textAnchor="end" fill="rgba(255,237,213,0.65)" fontSize="12">{maxMinute.toFixed(1)} 分</text>
        </svg>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs font-bold text-orange-100/70"><span className="h-1 w-10 rounded-full bg-orange-400" />EXP / 分</div>
    </div>
  );
}

function TrainingEfficiencyPanel() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ocrTimerRef = useRef<number | null>(null);
  const ocrBusyRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [running, setRunning] = useState(false);
  const [captureActive, setCaptureActive] = useState(false);
  const [ocrActive, setOcrActive] = useState(false);
  const [samples, setSamples] = useState<TrainingSample[]>([]);
  const [expInput, setExpInput] = useState('');
  const [targetExpInput, setTargetExpInput] = useState('');
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  const [ocrMessage, setOcrMessage] = useState('按「開始分析」後會自動啟動畫面擷取、抓取左下 EXP 區域並啟動 OCR。');
  const [ocrText, setOcrText] = useState('');
  const [ocrSuccessCount, setOcrSuccessCount] = useState(0);
  const [ocrFailCount, setOcrFailCount] = useState(0);
  const [ocrIntervalSec, setOcrIntervalSec] = useState(3);
  const [ocrCrop, setOcrCrop] = useState({ x: 0.1, y: 85.2, w: 13.2, h: 5.6 });
  const [autoCropEnabled, setAutoCropEnabled] = useState(true);
  const [debugEnabled, setDebugEnabled] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (ocrTimerRef.current) window.clearInterval(ocrTimerRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const firstSample = samples[0];
  const lastSample = samples[samples.length - 1];
  const elapsedMinutes = getTrainingElapsedMinutes(samples, now);
  const totalExp = firstSample && lastSample ? Math.max(0, lastSample.exp - firstSample.exp) : 0;
  const expPerMinute = elapsedMinutes > 0 ? totalExp / elapsedMinutes : 0;
  const targetExp = Math.max(0, Number(targetExpInput.replace(/,/g, '')) || 0);
  const currentExp = lastSample?.exp || Math.max(0, Number(expInput.replace(/,/g, '')) || 0);
  const currentPercent = targetExp > 0 ? Math.min(999.99, (currentExp / targetExp) * 100) : 0;
  const percentPerMinute = targetExp > 0 ? (expPerMinute / targetExp) * 100 : 0;
  const etaMinutes = targetExp > currentExp && expPerMinute > 0 ? (targetExp - currentExp) / expPerMinute : 0;
  const accumulated10 = getWindowExpDelta(samples, 10, now);
  const accumulated60 = getWindowExpDelta(samples, 60, now);
  const predicted10 = expPerMinute * 10;
  const predicted60 = expPerMinute * 60;

  function pushSample(exp: number, source: 'manual' | 'ocr') {
    if (!Number.isFinite(exp) || exp < 0) {
      setMessage(source === 'ocr' ? 'OCR 辨識到的 EXP 格式不正確。' : '請輸入正確的目前 EXP。');
      return false;
    }

    const last = samples[samples.length - 1];
    if (source === 'ocr' && last) {
      if (exp < last.exp) {
        setOcrFailCount((prev) => prev + 1);
        setOcrMessage(`OCR 忽略：辨識值 ${formatTrainingNumber(exp)} 小於上一筆 ${formatTrainingNumber(last.exp)}。`);
        return false;
      }

      const elapsed = Math.max(1, (Date.now() - last.timestamp) / 60000);
      const delta = exp - last.exp;
      const estimatedPerMinute = delta / elapsed;
      if (samples.length >= 3 && expPerMinute > 0 && estimatedPerMinute > expPerMinute * 20 && delta > 100000) {
        setOcrFailCount((prev) => prev + 1);
        setOcrMessage(`OCR 忽略：辨識值跳動過大（${formatTrainingNumber(exp)}）。`);
        return false;
      }

      if (exp === last.exp) {
        setOcrMessage(`OCR 成功，但 EXP 未變化：${formatTrainingNumber(exp)}。`);
        return true;
      }
    }

    setSamples((prev) => [...prev, { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, timestamp: Date.now(), exp }].sort((a, b) => a.timestamp - b.timestamp));
    setExpInput(String(exp));
    setRunning(true);
    setMessage(source === 'ocr' ? `OCR 已加入 EXP：${formatTrainingNumber(exp)}` : '已加入 EXP 紀錄。');
    return true;
  }

  function addSample() {
    pushSample(Number(expInput.replace(/,/g, '')), 'manual');
  }

  function resetAll() {
    setRunning(false);
    setOcrActive(false);
    if (ocrTimerRef.current) window.clearInterval(ocrTimerRef.current);
    ocrTimerRef.current = null;
    setSamples([]);
    setExpInput('');
    setOcrText('');
    setOcrSuccessCount(0);
    setOcrFailCount(0);
    setMessage('已重置練功效率紀錄。');
    setOcrMessage('OCR 已停止並清空紀錄。');
  }

  async function startCapture() {
    if (captureActive) return true;
    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setMessage('此瀏覽器不支援螢幕擷取。');
        return false;
      }
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCaptureActive(true);
      setMessage('已開始螢幕擷取。');
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '無法開始螢幕擷取');
      return false;
    }
  }

  function stopCapture() {
    if (ocrTimerRef.current) window.clearInterval(ocrTimerRef.current);
    ocrTimerRef.current = null;
    setOcrActive(false);
    setRunning(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCaptureActive(false);
    setOcrMessage('已停止螢幕擷取與 OCR。');
  }

  function waitForVideoReady() {
    return new Promise<boolean>((resolve) => {
      const started = Date.now();
      const check = () => {
        const video = videoRef.current;
        if (video?.videoWidth && video.videoHeight) {
          resolve(true);
          return;
        }
        if (Date.now() - started > 5000) {
          resolve(false);
          return;
        }
        window.setTimeout(check, 120);
      };
      check();
    });
  }

  function findExpBarBoundingBox(source: HTMLCanvasElement) {
    const ctx = source.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const width = source.width;
    const height = source.height;

    // EXP HUD is in the bottom-left corner.  Search only that area to avoid
    // accidentally catching damage numbers, NPC text, or other bright UI.
    const searchXStart = 0;
    const searchXEnd = Math.floor(width * 0.25);
    const searchYStart = Math.floor(height * 0.78);
    const searchYEnd = height;

    const regionWidth = searchXEnd - searchXStart;
    const regionHeight = searchYEnd - searchYStart;
    const image = ctx.getImageData(searchXStart, searchYStart, regionWidth, regionHeight);
    const data = image.data;

    const rowHits: Array<{ y: number; count: number; minX: number; maxX: number; span: number }> = [];

    for (let y = 0; y < regionHeight; y += 1) {
      let count = 0;
      let minX = regionWidth;
      let maxX = 0;

      for (let x = 0; x < regionWidth; x += 1) {
        const index = (y * regionWidth + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        // Screenshot target is a lime/yellow EXP bar.
        // Require a green-dominant horizontal band, not merely white text.
        const limeBar =
          g >= 135 &&
          r >= 90 &&
          r <= 235 &&
          b <= 125 &&
          g >= b * 1.45 &&
          g >= r * 0.72;

        if (limeBar) {
          count += 1;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }

      const span = maxX - minX + 1;
      if (count >= Math.max(24, regionWidth * 0.025) && span >= Math.max(50, regionWidth * 0.08)) {
        rowHits.push({ y, count, minX, maxX, span });
      }
    }

    if (rowHits.length < 2) return null;

    // Pick the longest continuous horizontal lime band.  This is the EXP bar.
    let bestStart = 0;
    let bestEnd = 0;
    let currentStart = 0;

    for (let index = 1; index <= rowHits.length; index += 1) {
      const separated = index === rowHits.length || rowHits[index].y - rowHits[index - 1].y > 2;
      if (separated) {
        const currentEnd = index - 1;
        const currentCluster = rowHits.slice(currentStart, currentEnd + 1);
        const bestCluster = rowHits.slice(bestStart, bestEnd + 1);
        const currentScore = currentCluster.reduce((sum, row) => sum + row.span + row.count, 0);
        const bestScore = bestCluster.reduce((sum, row) => sum + row.span + row.count, 0);

        if (currentScore > bestScore) {
          bestStart = currentStart;
          bestEnd = currentEnd;
        }
        currentStart = index;
      }
    }

    const cluster = rowHits.slice(bestStart, bestEnd + 1);
    if (cluster.length < 2) return null;

    const minX = Math.min(...cluster.map((row) => row.minX)) + searchXStart;
    const maxX = Math.max(...cluster.map((row) => row.maxX)) + searchXStart;
    const minY = Math.min(...cluster.map((row) => row.y)) + searchYStart;
    const maxY = Math.max(...cluster.map((row) => row.y)) + searchYStart;
    const count = cluster.reduce((sum, row) => sum + row.count, 0);

    if (count < 60 || maxX - minX < width * 0.035 || maxY <= minY) return null;
    return { minX, minY, maxX, maxY, count };
  }

  function autoDetectOcrCrop() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setOcrMessage('尚未取得畫面，無法自動抓取 OCR 裁切區域。');
      return false;
    }

    const frame = document.createElement('canvas');
    frame.width = video.videoWidth;
    frame.height = video.videoHeight;
    const frameCtx = frame.getContext('2d', { willReadFrequently: true });
    if (!frameCtx) return false;
    frameCtx.drawImage(video, 0, 0, frame.width, frame.height);

    const box = findExpBarBoundingBox(frame);

    if (!box) {
      const fallback = { x: 0.1, y: 85.2, w: 13.2, h: 5.6 };
      setOcrCrop(fallback);
      setOcrMessage('自動抓取失敗，已改用左下 EXP 預設裁切區。');
      drawOcrCropPreview(fallback);
      return false;
    }

    const barWidth = box.maxX - box.minX + 1;
    const barHeight = box.maxY - box.minY + 1;

    // Include: EXP label + current EXP + [percent] above the green bar.
    // Do not include too much right/bottom area, otherwise OCR picks unrelated UI.
    const cropX = Math.max(0, box.minX - Math.max(3, Math.round(barWidth * 0.02)));
    const cropY = Math.max(0, box.minY - Math.max(22, Math.round(barHeight * 2.65)));
    const cropRight = Math.min(frame.width, box.maxX + Math.max(4, Math.round(barWidth * 0.018)));
    const cropBottom = Math.min(frame.height, box.maxY + Math.max(2, Math.round(barHeight * 0.15)));

    const next = {
      x: Math.round((cropX / frame.width) * 1000) / 10,
      y: Math.round((cropY / frame.height) * 1000) / 10,
      w: Math.max(6, Math.round(((cropRight - cropX) / frame.width) * 1000) / 10),
      h: Math.max(4, Math.round(((cropBottom - cropY) / frame.height) * 1000) / 10),
    };

    setOcrCrop(next);
    setOcrMessage(`已自動抓取左下 EXP 區域：X ${next.x} / Y ${next.y} / 寬 ${next.w} / 高 ${next.h}`);
    drawOcrCropPreview(next);
    return true;
  }

  function preprocessCrop(sourceCanvas: HTMLCanvasElement) {
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return sourceCanvas;

    const imageData = ctx.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
      const boosted = gray > 118 ? 255 : Math.max(0, gray - 35);
      data[index] = boosted;
      data[index + 1] = boosted;
      data[index + 2] = boosted;
    }
    ctx.putImageData(imageData, 0, 0);

    const scaled = document.createElement('canvas');
    scaled.width = sourceCanvas.width * 3;
    scaled.height = sourceCanvas.height * 3;
    const scaledCtx = scaled.getContext('2d');
    if (!scaledCtx) return sourceCanvas;
    scaledCtx.imageSmoothingEnabled = false;
    scaledCtx.drawImage(sourceCanvas, 0, 0, scaled.width, scaled.height);
    return scaled;
  }

  function drawOcrCropPreview(nextCrop = ocrCrop) {
    const video = videoRef.current;
    const preview = previewCanvasRef.current;
    if (!video || !preview || !video.videoWidth || !video.videoHeight) return null;

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const sx = Math.max(0, Math.floor((nextCrop.x / 100) * sourceWidth));
    const sy = Math.max(0, Math.floor((nextCrop.y / 100) * sourceHeight));
    const sw = Math.max(10, Math.floor((nextCrop.w / 100) * sourceWidth));
    const sh = Math.max(10, Math.floor((nextCrop.h / 100) * sourceHeight));

    preview.width = sw;
    preview.height = sh;
    const pctx = preview.getContext('2d');
    if (!pctx) return null;
    pctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

    return { sx, sy, sw, sh };
  }

  async function runOcrOnce() {
    if (ocrBusyRef.current) return;
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setOcrMessage('尚未取得可辨識的螢幕畫面。');
      return;
    }

    if (autoCropEnabled) autoDetectOcrCrop();

    const crop = drawOcrCropPreview();
    if (!crop) {
      setOcrMessage('無法裁切 OCR 區域。');
      return;
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;
    canvas.width = crop.sw;
    canvas.height = crop.sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) {
      setOcrMessage('瀏覽器無法建立 Canvas。');
      return;
    }

    ctx.drawImage(video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
    ocrBusyRef.current = true;
    setOcrMessage('OCR 辨識中…');

    try {
      const processed = preprocessCrop(canvas);
      const tesseract = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.esm.min.js') as any;
      const result = await tesseract.recognize(processed, 'eng', {
        tessedit_char_whitelist: 'EXP0123456789,.%[] ',
      });
      const rawText = String(result?.data?.text || '').trim();
      setOcrText(rawText || '(無文字)');

      const candidates = rawText
        .replace(/[Oo]/g, '0')
        .match(/[0-9][0-9,]{2,}/g)
        ?.map((value) => Number(value.replace(/,/g, '')))
        .filter((value) => Number.isFinite(value) && value >= 0) || [];
      const exp = candidates.length > 0 ? Math.max(...candidates) : NaN;

      if (!Number.isFinite(exp)) {
        setOcrFailCount((prev) => prev + 1);
        setOcrMessage(`OCR 未找到 EXP 數字：${rawText || '空白'}`);
        return;
      }

      const accepted = pushSample(exp, 'ocr');
      if (accepted) {
        setOcrSuccessCount((prev) => prev + 1);
        setOcrMessage(`OCR 辨識成功：${formatTrainingNumber(exp)}`);
      }
    } catch (err) {
      setOcrFailCount((prev) => prev + 1);
      setOcrMessage(err instanceof Error ? `OCR 失敗：${err.message}` : 'OCR 失敗');
    } finally {
      ocrBusyRef.current = false;
    }
  }

  async function startAnalysis() {
    const ok = await startCapture();
    if (!ok) return;

    setRunning(true);
    setOcrActive(true);
    setOcrMessage('正在準備畫面並自動抓取左下 EXP 區域…');

    const ready = await waitForVideoReady();
    if (!ready) {
      setOcrActive(false);
      setOcrMessage('等待螢幕畫面逾時，請重新開始分析。');
      return;
    }

    if (autoCropEnabled) autoDetectOcrCrop();

    if (ocrTimerRef.current) window.clearInterval(ocrTimerRef.current);
    void runOcrOnce();
    ocrTimerRef.current = window.setInterval(() => {
      void runOcrOnce();
    }, Math.max(1, ocrIntervalSec) * 1000);
  }

  function stopAnalysis() {
    if (ocrTimerRef.current) window.clearInterval(ocrTimerRef.current);
    ocrTimerRef.current = null;
    setOcrActive(false);
    setRunning(false);
    setOcrMessage('分析已暫停。');
  }

  return (
    <section className="grid gap-4">
      <section className="rounded-[2rem] border border-orange-100 bg-white/85 p-5 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-slate-950">練功效率偵測</h2>
              <Pill tone={ocrActive ? 'green' : running ? 'orange' : 'slate'}>{ocrActive ? 'OCR 自動辨識中' : running ? '統計中' : '未啟動'}</Pill>
            </div>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-500">按「開始分析」後會自動啟動畫面擷取、抓取左下 EXP 區域並啟動 OCR。畫面中的 EXP 區域會像附圖那樣包含上方數值與下方綠色經驗條。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={startAnalysis} disabled={ocrActive}>{ocrActive ? '分析中' : '開始分析'}</Button>
            <Button variant="secondary" onClick={stopAnalysis} disabled={!ocrActive}>暫停分析</Button>
            <Button variant="ghost" onClick={resetAll}>重置</Button>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3">
          <input id="training-debug-toggle" type="checkbox" checked={debugEnabled} onChange={(event) => setDebugEnabled(event.target.checked)} className="h-4 w-4 rounded border-orange-300 text-orange-500 focus:ring-orange-400" />
          <label htmlFor="training-debug-toggle" className="text-sm font-black text-orange-700">Debug</label>
          <span className="text-xs font-semibold text-orange-600">勾選後才顯示 OCR 間隔秒數、OCR 成功 / 失敗 / 最近辨識資訊與裁切調整資訊。</span>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_220px_160px] xl:items-end">
            <Field label="升級所需總 EXP（選填）">
              <Input inputMode="numeric" value={targetExpInput} placeholder="例如 16500000" onChange={(event) => setTargetExpInput(event.target.value.replace(/[^0-9]/g, ''))} />
            </Field>
            <Field label="手動修正目前 EXP">
              <Input inputMode="numeric" value={expInput} placeholder="OCR 誤判時手動輸入" onChange={(event) => setExpInput(event.target.value.replace(/[^0-9]/g, ''))} />
            </Field>
            <div className="rounded-2xl border border-orange-100 bg-orange-50/70 p-2">
              <div className="mb-1 flex items-center justify-between text-[11px] font-black text-orange-700">
                <span>螢幕擷取對照</span>
                {captureActive ? <button className="text-rose-600" onClick={stopCapture}>停止</button> : null}
              </div>
              <video ref={videoRef} autoPlay muted playsInline className="h-24 w-full rounded-xl bg-slate-950 object-contain" />
            </div>
            <div className="rounded-2xl border border-orange-100 bg-white/85 p-2">
              <div className="mb-1 text-[11px] font-black text-orange-700">OCR 裁切預覽</div>
              <canvas ref={previewCanvasRef} className="h-24 w-full rounded-xl bg-slate-950 object-contain" />
            </div>
          </div>

          {debugEnabled ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="OCR 間隔秒數">
                  <Select value={ocrIntervalSec} onChange={(event) => setOcrIntervalSec(Number(event.target.value))}>
                    {[1, 2, 3, 5, 10].map((sec) => <option key={sec} value={sec}>{sec} 秒</option>)}
                  </Select>
                </Field>
                <div className="sm:col-span-2 rounded-3xl border border-orange-100 bg-orange-50/70 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-sm font-black text-orange-700">OCR 裁切區域</div>
                      <div className="mt-1 text-xs font-semibold leading-6 text-orange-700">預設會自動抓取左下 EXP 區域。關閉自動抓取後，可手動調整數值。</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="secondary" disabled={!captureActive} onClick={autoDetectOcrCrop}>重新自動抓取</Button>
                      <Button variant="ghost" onClick={() => setAutoCropEnabled((prev) => !prev)}>{autoCropEnabled ? '自動抓取：開' : '自動抓取：關'}</Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-4">
                    <Field label="X">
                      <Input type="number" min="0" max="100" value={ocrCrop.x} disabled={autoCropEnabled} onChange={(event) => setOcrCrop((prev) => ({ ...prev, x: Math.max(0, Math.min(100, Number(event.target.value))) }))} />
                    </Field>
                    <Field label="Y">
                      <Input type="number" min="0" max="100" value={ocrCrop.y} disabled={autoCropEnabled} onChange={(event) => setOcrCrop((prev) => ({ ...prev, y: Math.max(0, Math.min(100, Number(event.target.value))) }))} />
                    </Field>
                    <Field label="寬">
                      <Input type="number" min="1" max="100" value={ocrCrop.w} disabled={autoCropEnabled} onChange={(event) => setOcrCrop((prev) => ({ ...prev, w: Math.max(1, Math.min(100, Number(event.target.value))) }))} />
                    </Field>
                    <Field label="高">
                      <Input type="number" min="1" max="100" value={ocrCrop.h} disabled={autoCropEnabled} onChange={(event) => setOcrCrop((prev) => ({ ...prev, h: Math.max(1, Math.min(100, Number(event.target.value))) }))} />
                    </Field>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">OCR 成功：{ocrSuccessCount}</div>
                <div className="rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">OCR 失敗 / 忽略：{ocrFailCount}</div>
                <div className="rounded-3xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">最近辨識：{ocrText || '--'}</div>
              </div>
            </>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <Button onClick={addSample}>手動加入紀錄</Button>
            <Button variant="secondary" onClick={() => setExpInput(String(currentExp + Math.max(0, Math.round(expPerMinute))))}>+1分鐘估算</Button>
          </div>
        </div>

        {message ? <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">{message}</div> : null}
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">{ocrMessage}</div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <TrainingStatCard title="EXP" value={`${formatTrainingNumber(currentExp)}${targetExp > 0 ? ` [${currentPercent.toFixed(2)}%]` : ''}`} sub={totalExp > 0 ? `+${formatTrainingNumber(totalExp)}` : undefined} icon="👁" />
        <TrainingStatCard title="EXP / 分" value={`⚡ ${formatTrainingNumber(expPerMinute)}`} icon="👁" />
        <TrainingStatCard title="統計時間" value={formatTrainingDuration(elapsedMinutes)} sub={running ? '100.0%' : undefined} icon="👁" />
        <TrainingStatCard title="EXP累積 (10分)" value={`${formatTrainingNumber(accumulated10)} (${elapsedMinutes < 10 ? '<10m' : '10m'})`} icon="👁" />
        <TrainingStatCard title="預估 10 分" value={`🟢 ${formatTrainingNumber(predicted10)}`} icon="👁" />
        <TrainingStatCard title="預估百分比 (1 | 10 | 60分)" value={targetExp > 0 ? `${percentPerMinute.toFixed(2)}% | ${(percentPerMinute * 10).toFixed(2)}% | ${(percentPerMinute * 60).toFixed(2)}%` : '-- | -- | --'} icon="👁" />
        <TrainingStatCard title="EXP累積 (60分)" value={`${formatTrainingNumber(accumulated60)} (${elapsedMinutes < 60 ? '<1h' : '60m'})`} icon="👁" />
        <TrainingStatCard title="預估 60 分" value={formatTrainingNumber(predicted60)} icon="👁" />
        <TrainingStatCard title="預估升級時間" value={formatTrainingDuration(etaMinutes)} icon="👁" />
      </div>

      <TrainingChart samples={samples} />

      <section className="rounded-[2rem] border border-orange-100 bg-white/85 p-5 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-slate-950">最近 OCR / 手動紀錄</h3>
          <span className="text-xs font-black text-slate-400">資料筆數：{samples.length}</span>
        </div>
        <div className="mt-3 max-h-72 overflow-auto rounded-2xl border border-orange-100 bg-orange-50/50 p-3">
          {samples.length > 0 ? samples.slice().reverse().map((sample) => (
            <div key={sample.id} className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-orange-100 py-2 text-sm last:border-b-0">
              <span className="font-bold text-slate-400">{new Date(sample.timestamp).toLocaleTimeString('zh-TW')}</span>
              <span className="font-black text-slate-700">EXP {formatTrainingNumber(sample.exp)}</span>
            </div>
          )) : <div className="py-6 text-center text-sm font-bold text-slate-400">尚無紀錄。按「開始分析」後會自動啟動 OCR，或手動輸入 EXP 後加入紀錄。</div>}
        </div>
      </section>
    </section>
  );
}

function SettingsPanel({ groups, leaderCodes, signupCodes, onForgetLeaderCode, onForgetSignupCode }: { groups: RaidGroup[]; leaderCodes: Record<string, string>; signupCodes: Record<string, string>; onForgetLeaderCode: (groupId: string) => void; onForgetSignupCode: (groupId: string) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const savedGroupIds = Array.from(new Set([...Object.keys(leaderCodes), ...Object.keys(signupCodes)]));
  const rows = savedGroupIds.map((groupId) => ({ groupId, group: groups.find((item) => item.id === groupId), leaderCode: leaderCodes[groupId] || '', signupCode: signupCodes[groupId] || '' }));

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1600);
  }

  return (
    <section className="rounded-[2rem] border border-orange-100/80 bg-white/80 p-6 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">Local Settings</div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">設定</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-500">這裡顯示「目前這台瀏覽器」保存的團長管理碼、團邀請碼與帶邀請碼的團連結。這些明碼不會從 Supabase 反查；換裝置或清除瀏覽器資料後需要重新輸入。</p>
        </div>
        <Pill tone="orange">本機保存 {rows.length} 團</Pill>
      </div>

      {rows.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-orange-200 bg-orange-50/70 p-8 text-center">
          <div className="text-lg font-black text-slate-950">尚無本機保存的團管理資料</div>
          <p className="mt-2 text-sm font-semibold text-slate-500">建立新團、輸入團長管理碼或儲存報名邀請碼後，會出現在這裡。</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4">
          {rows.map(({ groupId, group, leaderCode, signupCode }) => {
            const inviteLink = buildGroupShareUrl(groupId, signupCode);
            const cleanLink = buildGroupShareUrl(groupId);
            return (
              <div key={groupId} className="rounded-3xl border border-orange-100 bg-white/85 p-4 shadow-sm">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-lg font-black text-slate-950">{group?.title || '未知團 / 已刪除團'}</h3>
                      {group ? <Pill tone="slate">{getBossDisplayName(group.boss)}</Pill> : <Pill tone="red">資料庫找不到</Pill>}
                    </div>
                    <div className="mt-1 break-all text-xs font-semibold text-slate-400">Group ID：{groupId}</div>
                    {group ? <div className="mt-1 text-sm font-semibold text-slate-500">{group.raidDate} {group.raidTime} · 團長：{group.leader}</div> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => copy(`clean-${groupId}`, cleanLink)}>{copied === `clean-${groupId}` ? '已複製' : '複製一般團連結'}</Button>
                    <Button variant="secondary" disabled={!signupCode} onClick={() => copy(`invite-${groupId}`, inviteLink)}>{copied === `invite-${groupId}` ? '已複製' : '複製帶邀請碼連結'}</Button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  <div className="rounded-2xl border border-orange-100 bg-orange-50/60 p-3">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-orange-500">團長管理碼</div>
                    <div className="mt-2 break-all rounded-xl bg-white px-3 py-2 text-sm font-mono font-bold text-slate-800">{leaderCode || '未保存'}</div>
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" className="px-3 py-2 text-xs" disabled={!leaderCode} onClick={() => copy(`leader-${groupId}`, leaderCode)}>{copied === `leader-${groupId}` ? '已複製' : '複製'}</Button>
                      <Button variant="ghost" className="px-3 py-2 text-xs" disabled={!leaderCode} onClick={() => onForgetLeaderCode(groupId)}>刪除本機保存</Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-amber-50/60 p-3">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-600">團邀請碼</div>
                    <div className="mt-2 break-all rounded-xl bg-white px-3 py-2 text-sm font-mono font-bold text-slate-800">{signupCode || '未保存'}</div>
                    <div className="mt-2 flex gap-2">
                      <Button variant="secondary" className="px-3 py-2 text-xs" disabled={!signupCode} onClick={() => copy(`signup-${groupId}`, signupCode)}>{copied === `signup-${groupId}` ? '已複製' : '複製'}</Button>
                      <Button variant="ghost" className="px-3 py-2 text-xs" disabled={!signupCode} onClick={() => onForgetSignupCode(groupId)}>刪除本機保存</Button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-100 bg-white p-3">
                    <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">帶邀請碼團連結</div>
                    <div className="mt-2 max-h-20 overflow-auto break-all rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">{signupCode ? inviteLink : '尚未保存團邀請碼，無法產生帶邀請碼連結'}</div>
                    <Button variant="secondary" className="mt-2 px-3 py-2 text-xs" disabled={!signupCode} onClick={() => copy(`invite-link-${groupId}`, inviteLink)}>{copied === `invite-link-${groupId}` ? '已複製' : '複製邀請連結'}</Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [groups, setGroups] = useState<RaidGroup[]>([]);
  const [selectedId, setSelectedId] = useState(getInitialGroupId);
  const [query, setQuery] = useState('');
  const [activePanel, setActivePanel] = useState<ActivePanel>(() => new URLSearchParams(window.location.search).get('tool') === 'rojhu' ? 'rojhuTools' : 'home');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const [leaderCodes, setLeaderCodes] = useState<Record<string, string>>(() => loadLeaderCodes());
  const [signupCodes, setSignupCodes] = useState<Record<string, string>>(() => loadSignupCodes());
  const [initialInvite] = useState(() => ({ groupId: getInitialGroupId(), code: getInviteCodeFromUrl() }));
  const [localNotificationEvents, setLocalNotificationEvents] = useState<RaidNotification[]>(() => loadLocalNotificationEvents());
  const [notificationReadIds, setNotificationReadIds] = useState<string[]>(() => loadNotificationReadIds());

  const selectedGroup = useMemo(() => groups.find((g) => g.id === selectedId) || groups[0], [groups, selectedId]);
  const selectedDifficulty = useMemo(() => selectedGroup ? getBossDifficultyMeta(`${selectedGroup.title} ${selectedGroup.boss}`) : null, [selectedGroup]);
  const selectedVisual = useMemo(() => selectedGroup ? getBossVisualMeta(`${selectedGroup.title} ${selectedGroup.boss}`) : null, [selectedGroup]);
  const selectedRaidStatus = useMemo(() => selectedGroup ? getRaidStatusMeta(selectedGroup) : null, [selectedGroup]);
  const selectedSignupCode = selectedGroup ? signupCodes[selectedGroup.id] || (selectedGroup.id === initialInvite.groupId ? initialInvite.code : '') : '';
  const derivedNotifications = useMemo(() => buildDerivedNotifications(groups), [groups]);
  const notifications = useMemo(() => {
    const byId = new Map<string, RaidNotification>();
    for (const item of [...derivedNotifications, ...localNotificationEvents]) {
      byId.set(item.id, item);
    }
    return Array.from(byId.values());
  }, [derivedNotifications, localNotificationEvents]);
  const unreadNotificationCount = notifications.filter((item) => !notificationReadIds.includes(item.id)).length;

  const loadGroups = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setError('尚未設定 Supabase。請建立 .env.local 並填入 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。');
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const next = await fetchRaidGroups();
      setGroups(next);
      if (next.length > 0 && !next.some((g) => g.id === selectedId)) {
        setSelectedId(next[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入資料失敗');
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const channel = supabase
      .channel('raid-board-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raid_groups' }, () => void loadGroups())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'raid_members' }, () => void loadGroups())
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadGroups]);

  useEffect(() => {
    if (loading || groups.length === 0) return;

    const previous = loadNotificationSnapshot();
    const current = buildNotificationSnapshot(groups);

    if (!previous) {
      saveNotificationSnapshot(current);
      return;
    }

    const generated: RaidNotification[] = [];
    const nowIso = new Date().toISOString();

    for (const group of groups) {
      const oldGroup = previous.groups[group.id];
      if (oldGroup && oldGroup.status !== group.status) {
        generated.push({
          id: `event-group-status-${group.id}-${oldGroup.status}-${group.status}-${group.updatedAt || nowIso}`,
          type: 'status_change',
          priority: group.status === 'finished' || group.status === 'closed' ? 'medium' : 'low',
          groupId: group.id,
          title: '突襲狀態已變更',
          description: `${group.title} 從「${statusLabel(oldGroup.status)}」變更為「${statusLabel(group.status)}」。`,
          createdAt: group.updatedAt || nowIso,
        });
      }

      for (const member of group.members) {
        const oldMember = previous.members[member.id];
        if (!oldMember || oldMember.status === member.status) continue;

        if (oldMember.status === '候補' && member.status === '已確認') {
          generated.push({
            id: `event-standby-promoted-${member.id}-${member.updatedAt || nowIso}`,
            type: 'standby_promoted',
            priority: 'high',
            groupId: group.id,
            memberId: member.id,
            title: '候補已轉正',
            description: `${member.name} 在「${group.title}」已從候補轉為已確認。`,
            createdAt: member.updatedAt || nowIso,
          });
        } else {
          generated.push({
            id: `event-member-status-${member.id}-${oldMember.status}-${member.status}-${member.updatedAt || nowIso}`,
            type: 'status_change',
            priority: 'low',
            groupId: group.id,
            memberId: member.id,
            title: '成員狀態已變更',
            description: `${member.name} 在「${group.title}」從「${statusLabel(oldMember.status)}」變更為「${statusLabel(member.status)}」。`,
            createdAt: member.updatedAt || nowIso,
          });
        }
      }
    }

    if (generated.length > 0) {
      setLocalNotificationEvents((prev) => {
        const byId = new Map<string, RaidNotification>();
        for (const item of [...generated, ...prev]) byId.set(item.id, item);
        const next = Array.from(byId.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 80);
        saveLocalNotificationEvents(next);
        return next;
      });
    }

    saveNotificationSnapshot(current);
  }, [groups, loading]);

  useEffect(() => {
    if (!selectedGroup) return;
    const url = new URL(window.location.href);
    url.searchParams.set('group', selectedGroup.id);
    const codeForSelectedGroup = signupCodes[selectedGroup.id] || (selectedGroup.id === initialInvite.groupId ? initialInvite.code : '');
    if (codeForSelectedGroup.trim()) {
      url.searchParams.set('invite', codeForSelectedGroup.trim());
    } else {
      url.searchParams.delete('invite');
      url.searchParams.delete('signupCode');
      url.searchParams.delete('raidCode');
    }
    window.history.replaceState({}, '', url.toString());
  }, [selectedGroup, signupCodes, initialInvite]);

  useEffect(() => {
    if (!selectedGroup || selectedGroup.id !== initialInvite.groupId || !initialInvite.code) return;
    setSignupCodes((prev) => {
      if (prev[selectedGroup.id] === initialInvite.code) return prev;
      const next = { ...prev, [selectedGroup.id]: initialInvite.code };
      saveSignupCodes(next);
      return next;
    });
  }, [selectedGroup, initialInvite]);

  async function refreshGroupsAndCheckNew() {
    if (!isSupabaseConfigured) {
      setError('尚未設定 Supabase。請建立 .env.local 並填入 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY。');
      return;
    }

    setBusy(true);
    try {
      setError(null);
      setRefreshNotice(null);

      const existingIds = new Set(groups.map((group) => group.id));
      const next = await fetchRaidGroups();
      const newGroups = next.filter((group) => !existingIds.has(group.id));

      setGroups(next);

      if (next.length > 0 && (!selectedId || !next.some((group) => group.id === selectedId))) {
        setSelectedId(next[0].id);
      }

      if (newGroups.length > 0) {
        setSelectedId(newGroups[0].id);
        setActivePanel('home');
        setRefreshNotice(`發現 ${newGroups.length} 個新突襲場次：${newGroups.slice(0, 3).map((group) => group.title).join('、')}${newGroups.length > 3 ? '…' : ''}`);
      } else {
        setRefreshNotice('已重新整理，目前沒有新突襲場次。');
      }

      window.setTimeout(() => setRefreshNotice(null), 4200);
    } catch (err) {
      setError(err instanceof Error ? err.message : '重新整理失敗');
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: () => Promise<void>) {
    setBusy(true);
    try {
      setError(null);
      await action();
      await loadGroups();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失敗');
    } finally {
      setBusy(false);
    }
  }


  function rememberLeaderCode(groupId: string, code: string) {
    setLeaderCodes((prev) => {
      const next = { ...prev, [groupId]: code };
      saveLeaderCodes(next);
      return next;
    });
  }

  function forgetLeaderCode(groupId: string) {
    setLeaderCodes((prev) => {
      const next = { ...prev };
      delete next[groupId];
      saveLeaderCodes(next);
      return next;
    });
  }

  function rememberSignupCode(groupId: string, code: string) {
    const clean = code.trim();
    if (!clean) return;
    setSignupCodes((prev) => {
      const next = { ...prev, [groupId]: clean };
      saveSignupCodes(next);
      return next;
    });
  }

  function forgetSignupCode(groupId: string) {
    setSignupCodes((prev) => {
      const next = { ...prev };
      delete next[groupId];
      saveSignupCodes(next);
      return next;
    });
  }

  async function unlockLeader(groupId: string, code: string) {
    const ok = await verifyLeaderCode(groupId, code);
    if (!ok) throw new Error('團長管理碼錯誤');
    rememberLeaderCode(groupId, code);
  }

  function requireLeaderCode(groupId: string) {
    const code = leaderCodes[groupId];
    if (!code) throw new Error('請先在楓突襲頁輸入團長管理碼');
    return code;
  }

  function markNotificationRead(id: string) {
    setNotificationReadIds((prev) => {
      const next = Array.from(new Set([...prev, id]));
      saveNotificationReadIds(next);
      return next;
    });
  }

  function markAllNotificationsRead() {
    const next = notifications.map((item) => item.id);
    setNotificationReadIds(next);
    saveNotificationReadIds(next);
  }

  function clearLocalNotificationEvents() {
    setLocalNotificationEvents([]);
    saveLocalNotificationEvents([]);
    const snapshot = buildNotificationSnapshot(groups);
    saveNotificationSnapshot(snapshot);
  }

  async function createGroup(group: NewRaidGroup) {
    await runAction(async () => {
      await insertRaidGroup(group);
      rememberLeaderCode(group.id, group.leaderCode);
      rememberSignupCode(group.id, group.signupCode);
      setSelectedId(group.id);
      setShowCreate(false);
    });
  }

  async function addSignup(member: NewRaidMember) {
    await runAction(() => insertRaidMember(member));
  }

  async function changeStatus(memberId: string, status: MemberStatus) {
    if (!selectedGroup) return;
    const code = requireLeaderCode(selectedGroup.id);
    await runAction(() => updateRaidMemberStatus(memberId, status, code));
  }

  async function changeGroupStatus(groupId: string, status: RaidStatus) {
    const code = requireLeaderCode(groupId);
    await runAction(() => updateRaidGroupStatus(groupId, status, code));
  }

  async function changeRoleRequirements(groupId: string, roleRequirements: RoleRequirementMap) {
    const code = requireLeaderCode(groupId);
    await runAction(() => updateRaidRoleRequirements(groupId, roleRequirements, code));
  }

  async function removeMember(memberId: string) {
    if (!selectedGroup) return;
    const code = requireLeaderCode(selectedGroup.id);
    await runAction(() => deleteRaidMember(memberId, code));
  }

  async function removeGroup(groupId: string) {
    const ok = window.confirm('確定刪除此團？成員會一起刪除。');
    if (!ok) return;
    const code = requireLeaderCode(groupId);
    await runAction(() => deleteRaidGroup(groupId, code));
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[linear-gradient(135deg,#fff7ed_0%,#fffbeb_38%,#f8fafc_100%)] text-slate-900">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 top-36 h-72 w-72 rounded-full bg-orange-200/35 blur-3xl" />
        <div className="absolute right-0 top-24 h-96 w-96 rounded-full bg-amber-100/70 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-rose-100/60 blur-3xl" />
      </div>

      <header className="sticky top-0 z-30 border-b border-orange-100/80 bg-white/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1560px] flex-col gap-4 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <MapleLeafLogo />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-950">Maple Raid Board</h1>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-black text-orange-700 ring-1 ring-orange-200">TSN UI-V44</span>
                <span className="text-orange-500">✦</span>
              </div>
            </div>
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-3 lg:max-w-2xl">
            <div className="relative w-full">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full rounded-2xl border border-orange-100 bg-white/80 py-3 pl-10 pr-20 text-sm shadow-inner outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100/80"
                placeholder="搜尋突襲、首領或隊長"
              />
              <span className="absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-400 sm:block">Ctrl K</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={() => void refreshGroupsAndCheckNew()} disabled={busy || loading}>{busy ? '讀取中…' : '重新整理 / 檢查新場次'}</Button>
            {selectedGroup ? (
              <Button
                variant="secondary"
                onClick={() => {
                  void navigator.clipboard.writeText(buildGroupShareUrl(selectedGroup.id, selectedSignupCode));
                }}
              >
                🔗 複製團連結
              </Button>
            ) : null}
            <Button className="shadow-lg shadow-orange-500/20" onClick={() => setShowCreate(true)} disabled={busy || !isSupabaseConfigured}>＋ 新增突襲</Button>
            <div className="grid h-11 w-11 place-items-center rounded-full border border-orange-100 bg-orange-50 text-xl shadow-sm">🍄</div>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mx-auto mt-5 max-w-[1560px] px-4">
          <div className="rounded-3xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-800 shadow-sm">{error}</div>
        </div>
      ) : null}

      {refreshNotice ? (
        <div className="mx-auto mt-5 max-w-[1560px] px-4">
          <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-800 shadow-sm">{refreshNotice}</div>
        </div>
      ) : null}

      {loading ? (
        <div className="mx-auto max-w-[1560px] px-4 py-10 text-slate-500">載入中...</div>
      ) : (
        <div className="mx-auto grid max-w-[1560px] gap-4 px-4 py-4 lg:grid-cols-[86px_minmax(0,1fr)]">
          <NavigationRail activePanel={activePanel} onChange={setActivePanel} noticeCount={unreadNotificationCount} />

          {activePanel === 'home' ? (
            <section className="w-full min-w-0 overflow-x-auto pb-2">
              <div className="grid min-w-[1080px] grid-cols-[420px_minmax(620px,1fr)] gap-4">
                <RaidList groups={groups} selectedId={selectedGroup?.id} onSelect={setSelectedId} query={query} setQuery={setQuery} />
              <section className="rounded-[2rem] border border-orange-100/80 bg-white/80 p-6 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
                <div className="grid min-h-[calc(100vh-154px)] place-items-center rounded-[1.5rem] border border-dashed border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-8 text-center">
                  <div className="max-w-xl">
                    <div className="mx-auto grid h-20 w-20 place-items-center rounded-[1.7rem] bg-white text-4xl shadow-sm">🍁</div>
                    <h2 className="mt-5 text-2xl font-black text-slate-950">首頁：突襲場次清單</h2>
                    <p className="mt-3 text-sm font-semibold leading-7 text-slate-600">
                      這裡只放場次列表與搜尋。選好左側場次後，點左邊導覽的「楓突襲」查看該團詳細資訊；點「我要報名」進入報名表單。
                    </p>
                    {selectedGroup ? (
                      <div className="mt-6 rounded-3xl border border-orange-100 bg-white/90 p-4 text-left shadow-sm">
                        <div className="text-xs font-black uppercase tracking-[0.2em] text-orange-500">目前選取</div>
                        <div className="mt-2 flex items-center gap-2"><div className="text-lg font-black text-slate-950">{selectedGroup.title}</div>{selectedVisual && selectedDifficulty ? <span className={classNames('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1', selectedVisual.difficultyPillClass)}>{selectedDifficulty.label}</span> : null}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-500">{selectedVisual ? <span className={classNames('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1', selectedVisual.bossPillClass)}>{getBossDisplayName(selectedGroup.boss)}</span> : null}<span>{selectedGroup.raidDate} {selectedGroup.raidTime}</span>{selectedRaidStatus ? <Pill tone={selectedRaidStatus.tone}>{selectedRaidStatus.label}</Pill> : null}</div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Button onClick={() => setActivePanel('raid')}>查看楓突襲詳細</Button>
                          <Button variant="secondary" onClick={() => setActivePanel('signup')}>我要報名</Button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </section>
              </div>
            </section>
          ) : activePanel === 'raid' ? (
            selectedGroup ? (
              <RaidDetail
                group={selectedGroup}
                onStatusChange={changeStatus}
                onGroupStatusChange={changeGroupStatus}
                onRoleRequirementsChange={changeRoleRequirements}
                onRemove={removeMember}
                onDelete={removeGroup}
                isLeaderUnlocked={Boolean(leaderCodes[selectedGroup.id])}
                onLeaderUnlock={(code) => unlockLeader(selectedGroup.id, code)}
                onLeaderLock={() => forgetLeaderCode(selectedGroup.id)}
                signupCode={signupCodes[selectedGroup.id] || ''}
                onSignupCodeSave={(code) => rememberSignupCode(selectedGroup.id, code)}
                onSignupCodeForget={() => forgetSignupCode(selectedGroup.id)}
              />
            ) : (
              <div className="rounded-[2rem] border border-orange-100 bg-white/85 p-10 text-center text-slate-500 shadow-sm">沒有可顯示的場次。請先執行 Supabase SQL seed。</div>
            )
          ) : activePanel === 'signup' ? (
            selectedGroup ? (
              <div className="mx-auto grid w-full max-w-5xl gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                <section className="rounded-[2rem] border border-orange-100/80 bg-white/80 p-6 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
                  <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-orange-950 to-amber-800 p-6 text-white shadow-inner">
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-200">正在報名</div>
                    <div className="mt-3 flex flex-wrap items-center gap-3"><h2 className="text-3xl font-black">{selectedGroup.title}</h2>{selectedVisual && selectedDifficulty ? <span className={classNames('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-black ring-1', selectedVisual.difficultyPillClass)}>{selectedDifficulty.label}</span> : null}{selectedRaidStatus ? <Pill tone={selectedRaidStatus.tone}>{selectedRaidStatus.label}</Pill> : null}</div>
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-sm font-semibold text-orange-100">{selectedVisual ? <span className={classNames('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1', selectedVisual.bossPillClass)}>{getBossDisplayName(selectedGroup.boss)}</span> : null}<span>{selectedGroup.raidDate} {selectedGroup.raidTime} · 團長：{selectedGroup.leader}</span></p>
                    <p className="mt-5 text-sm leading-7 text-orange-50/90">此頁只放報名相關資訊。要看分隊、公告與狀態管理，請點左側「楓突襲」。</p>
                    <div className="mt-5 flex flex-wrap gap-2">
                      <Button variant="secondary" onClick={() => setActivePanel('raid')}>查看楓突襲詳細</Button>
                      <Button variant="secondary" onClick={() => setActivePanel('home')}>返回場次清單</Button>
                    </div>
                  </div>
                </section>
                <SignupPanel group={selectedGroup} onSignup={addSignup} initialSignupCode={selectedSignupCode} />
              </div>
            ) : (
              <div className="rounded-[2rem] border border-orange-100 bg-white/85 p-10 text-center text-slate-500 shadow-sm">沒有可報名的場次。</div>
            )
          ) : activePanel === 'favorite' ? (
            <LinkFavoritesPanel selectedGroup={selectedGroup} selectedSignupCode={selectedSignupCode} onGoSettings={() => setActivePanel('settings')} />
          ) : activePanel === 'notice' ? (
            <NotificationCenter
              groups={groups}
              selectedId={selectedGroup?.id}
              notifications={notifications}
              readIds={notificationReadIds}
              onSelectGroup={setSelectedId}
              onGoRaid={() => setActivePanel('raid')}
              onMarkRead={markNotificationRead}
              onMarkAllRead={markAllNotificationsRead}
              onClearLocalEvents={clearLocalNotificationEvents}
            />
          ) : activePanel === 'rojhuTools' ? (
            <RojhuToolsPanel />
          ) : activePanel === 'trainingEfficiency' ? (
            <TrainingEfficiencyPanel />
          ) : (
            <SettingsPanel
              groups={groups}
              leaderCodes={leaderCodes}
              signupCodes={signupCodes}
              onForgetLeaderCode={forgetLeaderCode}
              onForgetSignupCode={forgetSignupCode}
            />
          )}
        </div>
      )}

      {showCreate ? <CreateRaidModal onClose={() => setShowCreate(false)} onCreate={createGroup} /> : null}
    </div>
  );
}
