import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { deleteRaidGroup, deleteRaidMember, fetchRaidGroups, insertRaidGroup, insertRaidMember, updateRaidGroupStatus, updateRaidMemberStatus, updateRaidRoleRequirements, verifyLeaderCode } from './api/raids';
import { CreateRaidModal } from './components/CreateRaidModal';
import { RaidDetail } from './components/RaidDetail';
import { RaidList } from './components/RaidList';
import { SignupPanel } from './components/SignupPanel';
import { NotificationCenter, buildDerivedNotifications, type RaidNotification } from './components/NotificationCenter';
import { Button, Field, Input, Pill, Select, classNames } from './components/ui';
import { getBossDifficultyMeta, getBossDisplayName, getBossVisualMeta, getRaidStatusMeta } from './data/bossArt';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import type { ImportedRaidMemberDraft, MemberStatus, NewRaidGroup, NewRaidMember, RaidGroup, RaidStatus, RoleRequirementMap, TeamFavorite } from './types';

function getInitialGroupId() {
  return new URLSearchParams(window.location.search).get('group') || 'demo-zakum-soon';
}


const LEADER_CODE_STORAGE_KEY = 'maple_raid_board_leader_codes_v12';
const SIGNUP_CODE_STORAGE_KEY = 'maple_raid_board_signup_codes_v15';
const NOTIFICATION_EVENTS_STORAGE_KEY = 'maple_raid_board_notifications_v14';
const NOTIFICATION_READ_STORAGE_KEY = 'maple_raid_board_notification_reads_v14';
const NOTIFICATION_SNAPSHOT_STORAGE_KEY = 'maple_raid_board_notification_snapshot_v14';
const TEAM_FAVORITES_STORAGE_KEY = 'maple_raid_board_team_favorites_v55';
const GAME_ACCOUNT_RECORDS_STORAGE_KEY = 'maple_raid_board_game_account_records_v59';
const SITE_PRESENCE_CLIENT_ID_STORAGE_KEY = 'maple_raid_board_site_presence_client_id_v69';
const ARTALE_PRICE_WATCHLIST_STORAGE_KEY = 'maple_raid_board_artale_price_watchlist_v81';

function getSitePresenceClientId() {
  try {
    const saved = localStorage.getItem(SITE_PRESENCE_CLIENT_ID_STORAGE_KEY);
    if (saved && /^[a-zA-Z0-9_-]{12,80}$/.test(saved)) return saved;
  } catch {
    // ignore storage errors
  }

  const randomPart = Math.random().toString(36).slice(2, 14);
  const timePart = Date.now().toString(36);
  const next = `site_${timePart}_${randomPart}`;

  try {
    localStorage.setItem(SITE_PRESENCE_CLIENT_ID_STORAGE_KEY, next);
  } catch {
    // ignore storage errors
  }

  return next;
}

type GameAccountRecord = {
  id: string;
  gameId: string;
  featureCode: string;
  createdAt: string;
};

function formatGameAccountRecord(record: GameAccountRecord) {
  return `${record.gameId}#${record.featureCode}`;
}

function loadGameAccountRecords(): GameAccountRecord[] {
  try {
    const raw = localStorage.getItem(GAME_ACCOUNT_RECORDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed
          .filter((item) => item && typeof item === 'object' && typeof item.gameId === 'string' && typeof item.featureCode === 'string')
          .map((item) => ({
            id: String(item.id || `${item.gameId}-${item.featureCode}`),
            gameId: String(item.gameId).trim().slice(0, 9),
            featureCode: String(item.featureCode).trim().slice(0, 6),
            createdAt: String(item.createdAt || new Date().toISOString()),
          }))
          .filter((item) => item.gameId && /^[A-Za-z0-9]{1,6}$/.test(item.featureCode))
          .slice(0, 10)
      : [];
  } catch {
    return [];
  }
}

function saveGameAccountRecords(items: GameAccountRecord[]) {
  localStorage.setItem(GAME_ACCOUNT_RECORDS_STORAGE_KEY, JSON.stringify(items.slice(0, 10)));
}

function loadTeamFavorites(): TeamFavorite[] {
  try {
    const raw = localStorage.getItem(TEAM_FAVORITES_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item === 'object') as TeamFavorite[] : [];
  } catch {
    return [];
  }
}

function saveTeamFavorites(items: TeamFavorite[]) {
  localStorage.setItem(TEAM_FAVORITES_STORAGE_KEY, JSON.stringify(items));
}

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

function loadArtalePriceWatchList(): string[] {
  const parsed = loadJsonObject<string[]>(ARTALE_PRICE_WATCHLIST_STORAGE_KEY, []);
  return Array.isArray(parsed)
    ? parsed.filter((item) => typeof item === 'string' && item.trim()).slice(0, 8)
    : [];
}

function saveArtalePriceWatchList(ids: string[]) {
  localStorage.setItem(ARTALE_PRICE_WATCHLIST_STORAGE_KEY, JSON.stringify(Array.from(new Set(ids)).slice(0, 8)));
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

async function updateRemoteRojhuRoute(code: string, password: string, player: RojhuPlayerId, row: number, col: number | null, clientId: string): Promise<RojhuRoom> {
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

function GameAccountModal({ records, onClose, onSaveRecords }: { records: GameAccountRecord[]; onClose: () => void; onSaveRecords: (records: GameAccountRecord[]) => void }) {
  const [gameId, setGameId] = useState('');
  const [featureCode, setFeatureCode] = useState('');
  const [message, setMessage] = useState('');

  const formattedRecords = records.map(formatGameAccountRecord);

  function addRecord() {
    const safeGameId = gameId.trim().replace(/#/g, '').slice(0, 9);
    const safeCode = featureCode.trim();

    if (!safeGameId) {
      setMessage('請輸入遊戲id。');
      return;
    }

    if (!/^[A-Za-z0-9]{1,6}$/.test(safeCode)) {
      setMessage('特徵碼必須為 1～6 位英數字元。');
      return;
    }

    const nextRecord: GameAccountRecord = {
      id: `${safeGameId}-${safeCode}-${Date.now()}`,
      gameId: safeGameId,
      featureCode: safeCode,
      createdAt: new Date().toISOString(),
    };

    const next = [
      nextRecord,
      ...records.filter((record) => formatGameAccountRecord(record).toLowerCase() !== `${safeGameId}#${safeCode}`.toLowerCase()),
    ].slice(0, 10);

    onSaveRecords(next);
    setGameId('');
    setFeatureCode('');
    setMessage(`已記錄 ${safeGameId}#${safeCode}。`);
  }

  function removeRecord(id: string) {
    onSaveRecords(records.filter((record) => record.id !== id));
  }

  function normalizeImportedGameAccountRecords(input: unknown) {
    const source = Array.isArray(input)
      ? input
      : input && typeof input === 'object' && Array.isArray((input as { records?: unknown[] }).records)
        ? (input as { records: unknown[] }).records
        : [];

    const normalized: GameAccountRecord[] = [];

    for (const item of source) {
      let nextGameId = '';
      let nextFeatureCode = '';

      if (typeof item === 'string') {
        const [idPart, codePart] = item.split('#');
        nextGameId = String(idPart || '').trim().replace(/#/g, '').slice(0, 9);
        nextFeatureCode = String(codePart || '').trim().replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
      } else if (item && typeof item === 'object') {
        const data = item as { gameId?: unknown; game_id?: unknown; id?: unknown; featureCode?: unknown; feature_code?: unknown; code?: unknown };
        nextGameId = String(data.gameId ?? data.game_id ?? '').trim().replace(/#/g, '').slice(0, 9);
        nextFeatureCode = String(data.featureCode ?? data.feature_code ?? data.code ?? '').trim().replace(/[^A-Za-z0-9]/g, '').slice(0, 6);
      }

      if (nextGameId && /^[A-Za-z0-9]{1,6}$/.test(nextFeatureCode)) {
        normalized.push({
          id: `${nextGameId}-${nextFeatureCode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          gameId: nextGameId,
          featureCode: nextFeatureCode,
          createdAt: new Date().toISOString(),
        });
      }
    }

    const unique = new Map<string, GameAccountRecord>();
    for (const record of [...normalized, ...records]) {
      unique.set(formatGameAccountRecord(record).toLowerCase(), record);
    }
    return Array.from(unique.values()).slice(0, 10);
  }

  function exportGameAccountRecords() {
    const payload = {
      version: 'UI-6.2-game-account-records',
      exportedAt: new Date().toISOString(),
      records: records.map((record) => ({
        gameId: record.gameId,
        featureCode: record.featureCode,
        label: formatGameAccountRecord(record),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `game-account-records-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage('已匯出遊戲id / 特徵碼紀錄。');
  }

  async function importGameAccountRecords(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const next = normalizeImportedGameAccountRecords(parsed);
      onSaveRecords(next);
      setMessage(`已匯入紀錄，目前共有 ${next.length} 筆。`);
    } catch {
      setMessage('匯入失敗，請確認檔案是匯出的 JSON 格式。');
    }
  }

  return (
    <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/40 p-4">
      <div className="w-full max-w-lg rounded-[2rem] border border-orange-100 bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">Game ID</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">遊戲id / 特徵碼紀錄</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">紀錄格式為「遊戲id#特徵碼」，最多 10 個。特徵碼限制為最多 6 位英數字元。</p>
          </div>
          <Button variant="ghost" onClick={onClose}>關閉</Button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
          <Field label="遊戲id">
            <Input value={gameId} maxLength={9} placeholder="例如 AAA" onChange={(event) => setGameId(event.target.value.replace(/#/g, '').slice(0, 9))} />
          </Field>
          <Field label="特徵碼">
            <Input value={featureCode} maxLength={6} placeholder="最多 6 位，例 Z5j69F" onChange={(event) => setFeatureCode(event.target.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 6))} />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={addRecord}>新增紀錄</Button>
          <Button variant="secondary" onClick={exportGameAccountRecords} disabled={records.length === 0}>匯出紀錄</Button>
          <label className="inline-flex cursor-pointer items-center rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-black text-orange-700 shadow-sm transition hover:bg-orange-50">
            匯入紀錄
            <input type="file" accept="application/json,.json" className="hidden" onChange={importGameAccountRecords} />
          </label>
          <span className="text-xs font-bold text-slate-400">遊戲id 最多 9 字，避免報名角色名稱超過 16 字限制。</span>
        </div>

        {message ? <div className="mt-3 rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-sm font-bold text-orange-700">{message}</div> : null}

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-black text-slate-950">目前紀錄</div>
            <div className="text-xs font-black text-slate-400">{records.length}/10</div>
          </div>
          <div className="grid gap-2">
            {records.length > 0 ? records.map((record) => (
              <div key={record.id} className="flex items-center justify-between gap-2 rounded-2xl border border-orange-100 bg-orange-50/70 px-3 py-2">
                <span className="font-mono text-sm font-black text-slate-800">{formatGameAccountRecord(record)}</span>
                <button className="rounded-lg px-2 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50" onClick={() => removeRecord(record.id)}>移除</button>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-orange-100 bg-orange-50/60 p-5 text-center text-sm font-semibold text-slate-500">尚無遊戲id#特徵碼紀錄。</div>
            )}
          </div>
        </div>

        {formattedRecords.length > 0 ? (
          <div className="mt-4 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold leading-6 text-slate-500">
            我要報名頁若有紀錄，角色名稱欄會自動改為下拉式選單，選項即為目前紀錄。
          </div>
        ) : null}
      </div>
    </div>
  );
}


type ArtaleMarketItem = {
  id: string;
  name: string;
  category: string;
  latest: number;
  avg7d: number;
  avg30d: number;
  change: number;
  trend: number[];
  historyDates?: string[];
};

type ArtaleMarketPayload = {
  items?: ArtaleMarketItem[];
  updatedAt?: string;
  error?: string;
  historySaved?: boolean;
  historyMessage?: string;
  historyRows?: number;
  priceDate?: string;
  historyUpdatedAt?: string;
};

function toSafeNumber(value: unknown, fallback = 0) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[,\s]/g, '');
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeArtaleMarketPayload(payload: unknown): ArtaleMarketPayload {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const rawItems = Array.isArray(source.items)
    ? source.items
    : Array.isArray(source.data)
      ? source.data
      : Array.isArray(source.prices)
        ? source.prices
        : Array.isArray(payload)
          ? payload
          : [];

  const items = rawItems
    .map((raw, index) => {
      const item = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
      const name = String(item.name || item.itemName || item.item_name || item.title || item.item || '').trim();
      if (!name) return null;

      const latest = toSafeNumber(item.latest ?? item.lastPrice ?? item.last_price ?? item.price ?? item.currentPrice ?? item.current_price);
      const avg7d = toSafeNumber(item.avg7d ?? item.avg_7d ?? item.weekAvg ?? item.sevenDayAvg ?? item.avg7days, latest);
      const avg30d = toSafeNumber(item.avg30d ?? item.avg_30d ?? item.monthAvg ?? item.thirtyDayAvg ?? item.avg30days, avg7d);
      const rawTrend = Array.isArray(item.trend)
        ? item.trend
        : Array.isArray(item.history)
          ? item.history
          : Array.isArray(item.prices)
            ? item.prices
            : [];
      const trend = rawTrend
        .map((point) => {
          if (typeof point === 'number' || typeof point === 'string') return toSafeNumber(point);
          if (point && typeof point === 'object') {
            const sourcePoint = point as Record<string, unknown>;
            return toSafeNumber(sourcePoint.price ?? sourcePoint.value ?? sourcePoint.close ?? sourcePoint.avg);
          }
          return 0;
        })
        .filter((value) => Number.isFinite(value) && value > 0);

      const derivedChange = avg7d > 0 ? ((latest - avg7d) / avg7d) * 100 : 0;

      return {
        id: String(item.id || item.key || item.item_id || `${name}-${index}`),
        name,
        category: String(item.category || item.type || item.kind || '其他'),
        latest,
        avg7d,
        avg30d,
        change: toSafeNumber(item.change ?? item.changePercent ?? item.change_percent ?? item.rate, derivedChange),
        trend: trend.length >= 2 ? trend : [avg30d || latest, avg7d || latest, latest].filter((value) => value > 0),
        historyDates: Array.isArray(item.historyDates) ? item.historyDates.map((value) => String(value)) : undefined,
      } satisfies ArtaleMarketItem;
    })
    .filter(Boolean) as ArtaleMarketItem[];

  return {
    items,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : typeof source.updated_at === 'string' ? source.updated_at : undefined,
    error: typeof source.error === 'string' ? source.error : undefined,
    historySaved: Boolean(source.historySaved),
    historyMessage: typeof source.historyMessage === 'string' ? source.historyMessage : undefined,
    historyRows: toSafeNumber(source.historyRows, 0),
    priceDate: typeof source.priceDate === 'string' ? source.priceDate : undefined,
    historyUpdatedAt: typeof source.historyUpdatedAt === 'string' ? source.historyUpdatedAt : undefined,
  };
}

async function fetchArtaleMarketItems(): Promise<ArtaleMarketPayload> {
  const endpoint = import.meta.env.VITE_ARTALE_PRICE_ENDPOINT || '/api/artale-prices';
  const response = await fetch(endpoint, { headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => null);
  const normalized = normalizeArtaleMarketPayload(payload);

  if (!response.ok) {
    throw new Error(normalized.error || `物價資料來源回應錯誤：HTTP ${response.status}`);
  }

  if (!normalized.items?.length) {
    throw new Error(normalized.error || '物價資料來源沒有回傳可用商品資料。');
  }

  return normalized;
}

function formatMesos(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '--';
  if (value >= 100000000) return `${(value / 100000000).toFixed(value >= 1000000000 ? 1 : 2)}億`;
  if (value >= 10000) return `${Math.round(value / 10000).toLocaleString('zh-TW')}萬`;
  return Math.round(value).toLocaleString('zh-TW');
}

function movingAverage(values: number[], windowSize: number) {
  if (windowSize <= 1) return values;
  return values.map((_, index) => {
    const windowValues = values.slice(Math.max(0, index - windowSize + 1), index + 1);
    return windowValues.reduce((sum, value) => sum + value, 0) / Math.max(1, windowValues.length);
  });
}

function MarketTrendLine({ values, positive, showLastValue = false }: { values: number[]; positive: boolean; showLastValue?: boolean }) {
  const safeValues = values.filter((value) => Number.isFinite(value) && value > 0);
  const series = safeValues.length >= 2 ? safeValues : [1, 1];
  const width = showLastValue ? 348 : 220;
  const height = showLastValue ? 156 : 72;
  const pad = 10;
  const labelWidth = showLastValue ? 104 : 0;
  const chartWidth = width - labelWidth;
  const lineColor = positive ? '#dc2626' : '#16a34a';
  const max = Math.max(...series);
  const min = Math.min(...series);
  const range = Math.max(1, max - min);
  const points = series.map((value, index) => {
    const x = pad + (index / Math.max(1, series.length - 1)) * (chartWidth - pad * 2);
    const y = height - pad - ((value - min) / range) * (height - pad * 2);
    return { x, y, value, index };
  });
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`).join(' ');
  const labelStep = Math.max(1, Math.ceil(points.length / 12));
  const labelPoints = showLastValue
    ? points.filter((point) => point.index % labelStep === 0 || point.index === points.length - 1)
    : [];

  return (
    <div className="rounded-2xl border border-orange-100 bg-white/80 px-2 py-2">
      <svg viewBox={`0 0 ${width} ${height}`} className={classNames(showLastValue ? 'h-40' : 'h-16', 'w-full')} role="img" aria-label="價格走勢折線圖">
        <path d={`M ${pad} ${height - pad} H ${chartWidth - pad}`} fill="none" stroke="rgba(251,146,60,0.18)" strokeWidth="1" />
        <path d={path} fill="none" stroke={lineColor} strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
        {points.map((point) => (
          <circle key={point.index} cx={point.x} cy={point.y} r={showLastValue ? '2.4' : '2.8'} fill={lineColor} />
        ))}
        {labelPoints.map((point) => {
          const labelY = Math.max(11, Math.min(height - 5, point.y + 3));
          return (
            <g key={`label-${point.index}`}>
              <path d={`M ${point.x + 4} ${point.y} H ${chartWidth + 4}`} fill="none" stroke={lineColor} strokeDasharray="3 3" strokeWidth="1.2" opacity="0.45" />
              <text x={width - 4} y={labelY} textAnchor="end" className="fill-slate-700 text-[9px] font-black">{formatMesos(point.value)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function ArtalePriceModal({ onClose }: { onClose: () => void }) {
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('全部');
  const [chartMode, setChartMode] = useState('1D');
  const [items, setItems] = useState<ArtaleMarketItem[]>([]);
  const [loadingMarket, setLoadingMarket] = useState(true);
  const [marketError, setMarketError] = useState('');
  const [historyMessage, setHistoryMessage] = useState('');
  const [databaseUpdatedAt, setDatabaseUpdatedAt] = useState('');
  const [activeItemId, setActiveItemId] = useState('');
  const [compareItemId, setCompareItemId] = useState('');
  const [watchList, setWatchList] = useState<string[]>(() => loadArtalePriceWatchList());
  const [calcPrice, setCalcPrice] = useState('');
  const [scrollCount, setScrollCount] = useState('7');
  const [successRate, setSuccessRate] = useState('60');

  const loadMarket = useCallback(async () => {
    setLoadingMarket(true);
    setMarketError('');
    setHistoryMessage('');
    try {
      const payload = await fetchArtaleMarketItems();
      const nextItems = payload.items || [];
      setItems(nextItems);
      setDatabaseUpdatedAt(payload.historyUpdatedAt || payload.updatedAt || payload.priceDate || '');
      setHistoryMessage(payload.historySaved ? '' : payload.historyMessage || '');
      setActiveItemId((current) => current || nextItems[0]?.id || '');
      setCompareItemId((current) => current || nextItems[1]?.id || nextItems[0]?.id || '');
      setWatchList((current) => {
        const validIds = new Set(nextItems.map((item) => item.id));
        const kept = current.filter((id) => validIds.has(id));
        return kept.length > 0 ? kept : nextItems.slice(0, 2).map((item) => item.id);
      });
      setCalcPrice((current) => current || String(nextItems[0]?.latest || ''));
    } catch (error) {
      setMarketError(error instanceof Error ? error.message : '物價資料讀取失敗。');
      setItems([]);
    } finally {
      setLoadingMarket(false);
    }
  }, []);

  useEffect(() => {
    void loadMarket();
  }, [loadMarket]);

  useEffect(() => {
    saveArtalePriceWatchList(watchList);
  }, [watchList]);

  const categories = ['全部', ...Array.from(new Set(items.map((item) => item.category).filter(Boolean)))];
  const filteredItems = items.filter((item) => {
    const matchCategory = category === '全部' || item.category === category;
    const matchKeyword = !keyword.trim() || item.name.toLowerCase().includes(keyword.trim().toLowerCase());
    return matchCategory && matchKeyword;
  });
  const activeItem = items.find((item) => item.id === activeItemId) || items[0] || null;
  const compareItem = items.find((item) => item.id === compareItemId) || items.find((item) => item.id !== activeItem?.id) || activeItem;
  const watchItems = watchList.map((id) => items.find((item) => item.id === id)).filter(Boolean) as ArtaleMarketItem[];
  const successRatio = Math.max(0.01, Math.min(100, Number(successRate || 1)) / 100);
  const expectedCost = Math.max(0, Number(calcPrice || 0)) * Math.max(0, Number(scrollCount || 0)) / successRatio;
  const spread = activeItem && compareItem ? activeItem.latest - compareItem.latest : 0;
  const ratio = activeItem && compareItem?.latest ? activeItem.latest / compareItem.latest : 0;
  const topMovers = [...items].sort((a, b) => Math.abs(b.change) - Math.abs(a.change)).slice(0, 4);
  const chartWindow = chartMode.endsWith('MA') ? Number(chartMode.replace('MA', '')) : 1;
  const chartValues = activeItem ? movingAverage(activeItem.trend, chartWindow) : [];
  const databaseStatusText = databaseUpdatedAt ? new Date(databaseUpdatedAt).toLocaleString('zh-TW', { hour12: false }) : '--';

  function toggleWatch(id: string) {
    setWatchList((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [id, ...prev].slice(0, 8));
  }

  return (
    <div className="fixed inset-0 z-[90] grid place-items-center bg-slate-950/40 p-4">
      <div className="max-h-[92vh] w-full max-w-7xl overflow-auto rounded-[2rem] border border-orange-100 bg-white p-5 shadow-2xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">Artale Market</div>
            <h2 className="mt-1 text-2xl font-black text-slate-950">Artale 物價查詢</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void loadMarket()} disabled={loadingMarket}>重新讀取報價</Button>
            <Button variant="ghost" onClick={onClose}>關閉</Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-[1.6rem] border border-orange-100 bg-orange-50/60 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-400">⌕</span>
            <Input value={keyword} placeholder="搜尋商品、卷軸、裝備..." onChange={(event) => setKeyword(event.target.value)} className="pl-10" />
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button key={item} type="button" onClick={() => setCategory(item)} className={classNames('rounded-full px-3 py-2 text-xs font-black transition', category === item ? 'bg-orange-500 text-white shadow-sm shadow-orange-500/20' : 'bg-white text-slate-500 ring-1 ring-orange-100 hover:bg-orange-50')}>{item}</button>
            ))}
          </div>
        </div>

        {loadingMarket ? (
          <div className="mt-5 rounded-[1.6rem] border border-orange-100 bg-orange-50/50 p-8 text-center text-sm font-black text-orange-700">正在讀取物價資料...</div>
        ) : marketError ? (
          <div className="mt-5 rounded-[1.6rem] border border-rose-100 bg-rose-50 p-5 text-sm font-bold leading-7 text-rose-700">
            <div className="font-black">物價資料讀取失敗</div>
            <div className="mt-1">{marketError}</div>
          </div>
        ) : historyMessage ? (
          <div className="mt-5 rounded-[1.6rem] border border-amber-100 bg-amber-50 p-4 text-xs font-bold leading-6 text-amber-700">{historyMessage}</div>
        ) : null}


        <section className="mt-5 rounded-[1.6rem] border border-orange-100 bg-white/90 p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">自選清單</div>
              <h3 className="mt-1 text-xl font-black text-slate-950">我的自選清單</h3>
            </div>
            <Pill tone="orange">{watchItems.length} 項</Pill>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {watchItems.length > 0 ? watchItems.map((item) => (
              <button key={item.id} type="button" onClick={() => setActiveItemId(item.id)} className="flex items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-orange-50/50 px-3 py-2 text-left transition hover:bg-orange-100/70">
                <span className="min-w-0 truncate text-sm font-black text-slate-800">{item.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className={classNames('rounded-full px-2 py-0.5 text-[11px] font-black', item.change >= 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>{item.change >= 0 ? '+' : ''}{item.change.toFixed(1)}%</span>
                  <span className="text-sm font-black text-orange-700">{formatMesos(item.latest)}</span>
                </span>
              </button>
            )) : <div className="rounded-2xl border border-dashed border-orange-100 bg-orange-50/50 p-4 text-center text-sm font-semibold text-slate-500 sm:col-span-2 xl:col-span-4">尚未加入自選商品。</div>}
          </div>
        </section>

        <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
          <section className="rounded-[1.6rem] border border-orange-100 bg-white/90 p-4 shadow-sm">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">列表模式</div>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <h3 className="text-xl font-black text-slate-950">商品行情</h3>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">狀態：資料庫更新 {databaseStatusText}</span>
              </div>
            </div>

            <div className="mt-4 grid max-h-[61rem] gap-3 overflow-y-auto pr-2">
              {filteredItems.length > 0 ? filteredItems.map((item) => {
                const positive = item.change >= 0;
                const active = activeItem?.id === item.id;
                return (
                  <button key={item.id} type="button" onClick={() => setActiveItemId(item.id)} className={classNames('grid gap-3 rounded-3xl border p-4 text-left transition md:grid-cols-[minmax(0,1fr)_220px] md:items-center', active ? 'border-orange-300 bg-orange-50 ring-2 ring-orange-100' : 'border-orange-100 bg-white hover:bg-orange-50/50')}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-lg font-black text-slate-950">{item.name}</span>
                        <Pill tone="orange">{item.category}</Pill>
                        <span className={classNames('rounded-full px-2 py-0.5 text-[11px] font-black', positive ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>{positive ? '+' : ''}{item.change.toFixed(1)}%</span>
                      </div>
                      <div className="mt-2 grid gap-2 text-sm font-bold text-slate-500 sm:grid-cols-3">
                        <span>最後報價 <b className="text-slate-950">{formatMesos(item.latest)}</b></span>
                        <span>7日均 <b className="text-slate-950">{formatMesos(item.avg7d)}</b></span>
                        <span>30日均 <b className="text-slate-950">{formatMesos(item.avg30d)}</b></span>
                      </div>
                    </div>
                    <MarketTrendLine values={item.trend} positive={positive} />
                  </button>
                );
              }) : (
                <div className="rounded-3xl border border-dashed border-orange-100 bg-orange-50/50 p-8 text-center text-sm font-bold text-slate-500">尚無商品資料。</div>
              )}
            </div>
          </section>

          <aside className="grid gap-4">
            <section className="rounded-[1.6rem] border border-orange-100 bg-white/90 p-4 shadow-sm">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">K線分析</div>
                    <h3 className="mt-1 truncate text-xl font-black text-slate-950">{activeItem?.name || '--'}</h3>
                  </div>
                  {activeItem ? <button type="button" onClick={() => toggleWatch(activeItem.id)} className="shrink-0 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-black text-orange-700 ring-1 ring-orange-100">{watchList.includes(activeItem.id) ? '★ 已自選' : '☆ 加自選'}</button> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {['1D', '3MA', '5MA', '20MA'].map((item) => <button key={item} type="button" onClick={() => setChartMode(item)} className={classNames('rounded-xl px-3 py-1.5 text-xs font-black', chartMode === item ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-700 ring-1 ring-orange-100')}>{item}</button>)}
                </div>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-2xl bg-orange-50 p-3">
                  <div className="text-[11px] font-black text-orange-500">歷史最後報價</div>
                  <div className="mt-1 text-lg font-black text-slate-950">{formatMesos(activeItem?.latest || 0)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] font-black text-slate-400">7日均</div>
                  <div className="mt-1 text-lg font-black text-slate-950">{formatMesos(activeItem?.avg7d || 0)}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] font-black text-slate-400">30日均</div>
                  <div className="mt-1 text-lg font-black text-slate-950">{formatMesos(activeItem?.avg30d || 0)}</div>
                </div>
              </div>
              <div className="mt-4 rounded-3xl border border-orange-100 bg-orange-50/50 p-3">
                <MarketTrendLine values={chartValues} positive={(activeItem?.change || 0) >= 0} showLastValue />
                <div className="mt-2 flex justify-between text-xs font-black text-slate-400"><span>每日最後報價</span><span>{chartMode}</span></div>
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-orange-100 bg-white/90 p-4 shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">價差套利</div>
              <h3 className="mt-1 text-xl font-black text-slate-950">交叉分析圖表</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Select value={activeItem?.id || ''} onChange={(event) => setActiveItemId(event.target.value)}>
                  {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
                <Select value={compareItem?.id || ''} onChange={(event) => setCompareItemId(event.target.value)}>
                  {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </Select>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] font-black text-slate-400">實質價差</div>
                  <div className={classNames('mt-1 text-lg font-black', spread >= 0 ? 'text-emerald-700' : 'text-rose-700')}>{formatMesos(Math.abs(spread))}</div>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <div className="text-[11px] font-black text-slate-400">價差比值</div>
                  <div className="mt-1 text-lg font-black text-slate-950">{ratio ? `${ratio.toFixed(2)}x` : '--'}</div>
                </div>
              </div>
            </section>

            <section className="rounded-[1.6rem] border border-orange-100 bg-white/90 p-4 shadow-sm">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">智能雷達</div>
              <h3 className="mt-1 text-xl font-black text-slate-950">溢價 / 折價監控</h3>
              <div className="mt-3 grid gap-2">
                {topMovers.length > 0 ? topMovers.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-2xl bg-orange-50/70 px-3 py-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-800">{item.name}</div>
                      <div className="text-xs font-semibold text-slate-400">{item.category}</div>
                    </div>
                    <span className={classNames('rounded-full px-2 py-1 text-xs font-black', item.change >= 0 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>{item.change >= 0 ? '+' : ''}{item.change.toFixed(1)}%</span>
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-orange-100 bg-orange-50/50 p-4 text-center text-sm font-semibold text-slate-500">尚無雷達資料。</div>}
              </div>
            </section>
          </aside>
        </div>

        <div className="mt-5 grid gap-4">
          <section className="rounded-[1.6rem] border border-orange-100 bg-white/90 p-4 shadow-sm">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">衝捲計算</div>
            <h3 className="mt-1 text-xl font-black text-slate-950">計算機率與期望造價</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Field label="卷軸單價">
                <Input inputMode="numeric" value={calcPrice} onChange={(event) => setCalcPrice(event.target.value.replace(/[^0-9]/g, ''))} />
              </Field>
              <Field label="可用卷軸數">
                <Input inputMode="numeric" value={scrollCount} onChange={(event) => setScrollCount(event.target.value.replace(/[^0-9]/g, ''))} />
              </Field>
              <Field label="成功率%">
                <Input inputMode="numeric" value={successRate} onChange={(event) => setSuccessRate(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))} />
              </Field>
            </div>
            <div className="mt-4 rounded-3xl bg-gradient-to-br from-orange-100 to-amber-50 p-4">
              <div className="text-xs font-black text-orange-700">期望造價</div>
              <div className="mt-1 text-2xl font-black text-slate-950">{formatMesos(expectedCost)}</div>
              <p className="mt-1 text-xs font-semibold text-slate-500">以目前輸入的卷軸價格、數量與成功率試算，僅供估算。</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}


type ActivePanel = 'home' | 'raid' | 'signup' | 'favorite' | 'teamFavorite' | 'notice' | 'rojhuTools' | 'trainingEfficiency' | 'settings';

function NavigationRail({ activePanel, onChange, noticeCount }: { activePanel: ActivePanel; onChange: (panel: ActivePanel) => void; noticeCount: number }) {
  const items: Array<{ icon: string; label: string; panel: ActivePanel; badge?: string; helper?: string }> = [
    { icon: '⌂', label: '首頁', panel: 'home', helper: '突襲場次清單' },
    { icon: '🍁', label: '楓突襲', panel: 'raid', helper: '突襲詳細內容' },
    { icon: '✎', label: '我要報名', panel: 'signup', helper: '報名表單' },
    { icon: '☆', label: '團連結收藏', panel: 'favorite', helper: '團連結 / 帶邀請碼連結快速收藏' },
    { icon: '☷', label: '隊伍收藏', panel: 'teamFavorite', helper: '已收藏的楓突襲隊伍名單' },
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


function TeamFavoritesPanel({ favorites, onRemove, onGoRaid, onSelectGroup }: { favorites: TeamFavorite[]; onRemove: (id: string) => void; onGoRaid: () => void; onSelectGroup: (groupId: string) => void }) {
  return (
    <section className="rounded-[2rem] border border-orange-100/80 bg-white/80 p-6 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">Team Favorites</div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">隊伍收藏</h2>
          <p className="mt-2 max-w-2xl text-sm font-semibold leading-7 text-slate-500">這裡顯示從「楓突襲」已結束場次的隊伍配置收藏下來的隊伍名單。資料只保存於目前瀏覽器。</p>
        </div>
        <Pill tone="orange">收藏 {favorites.length} 隊</Pill>
      </div>

      {favorites.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-orange-200 bg-orange-50/70 p-8 text-center">
          <div className="text-lg font-black text-slate-950">尚無收藏隊伍</div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">到「楓突襲」已結束的突襲場次，在「隊伍配置」欄按「收藏隊伍 1 / 2 / 3」即可加入。</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-2">
          {favorites.map((favorite) => (
            <article key={favorite.id} className="rounded-3xl border border-orange-100 bg-white/90 p-4 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-lg font-black text-slate-950">{favorite.groupTitle}</h3>
                    <Pill tone="orange">隊伍 {favorite.party}</Pill>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-sm font-semibold text-slate-500">
                    <span>{getBossDisplayName(favorite.boss)}</span>
                    <span>{favorite.raidDate} {favorite.raidTime}</span>
                    <span>團長：{favorite.leader}</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-slate-400">收藏時間：{new Date(favorite.savedAt).toLocaleString('zh-TW')}</div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button variant="secondary" className="px-3 py-2 text-xs" onClick={() => { onSelectGroup(favorite.groupId); onGoRaid(); }}>回到場次</Button>
                  <Button variant="ghost" className="px-3 py-2 text-xs" onClick={() => onRemove(favorite.id)}>移除</Button>
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                {favorite.members.length > 0 ? favorite.members.map((member, index) => (
                  <div key={`${favorite.id}-${member.name}-${index}`} className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-orange-50 bg-orange-50/70 px-3 py-2">
                    <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-slate-800 to-slate-600 text-xs font-black text-white">{index + 1}</div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-800">{member.name}</div>
                      <div className="truncate text-xs font-semibold text-slate-500">Lv.{member.level} · {member.job} · {member.status}</div>
                    </div>
                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-orange-700">{member.role}</span>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-dashed border-orange-100 bg-orange-50/50 p-4 text-center text-sm font-semibold text-slate-500">此收藏沒有成員資料。</div>
                )}
              </div>
            </article>
          ))}
        </div>
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
      const currentValue = currentRoom.routes[selectedPlayer]?.[rowIndex];
      const nextColumnIndex = currentValue === columnIndex ? null : columnIndex;
      await updateRemoteRojhuRoute(currentRoom.code, currentRoom.password, selectedPlayer, rowIndex, nextColumnIndex, rojhuClientId);
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
    if (players.length === 0) return undefined;
    const colorMap: Record<RojhuPlayerId, string> = {
      '101': '#fb7185',
      '102': '#4ade80',
      '103': '#38bdf8',
      '104': '#c084fc',
    };

    if (players.length === 1) {
      return {
        background: colorMap[players[0]],
        borderColor: colorMap[players[0]],
      };
    }

    const step = 100 / players.length;
    const segments = players.map((player, index) => {
      const start = Math.round(index * step);
      const end = Math.round((index + 1) * step);
      return `${colorMap[player]} ${start}% ${end}%`;
    }).join(', ');
    return {
      background: `linear-gradient(135deg, ${segments})`,
      borderColor: 'transparent',
    };
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
                      style={selectedPlayers.length > 0 ? multiPlayerCellStyle(selectedPlayers) : undefined}
                      className={classNames(
                        'grid h-3 w-3 place-items-center rounded-[3px] border border-orange-100 bg-orange-50 text-[7px] font-black leading-none text-slate-300',
                        singlePlayer && playerCellClasses[singlePlayer],
                        selectedPlayers.length > 0 && 'border-transparent text-white',
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
              <li>找到正確平台後點擊對應方塊標記；再次點擊同一格可取消</li>
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
            <div className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-orange-700 ring-1 ring-orange-100">快捷鍵：按 1 / 2 / 3 / 4 標記下一層；點同一格可取消；10 層填滿後停止</div>
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
                        style={selectedPlayers.length > 0 ? multiPlayerCellStyle(selectedPlayers) : undefined}
                        className={classNames(
                          'relative grid h-[50px] w-[60px] place-items-center rounded-xl border border-orange-100 bg-orange-50/65 p-0 text-2xl font-black text-slate-300 shadow-inner transition',
                          !currentRoom && 'cursor-not-allowed opacity-50',
                          singlePlayer && playerCellClasses[singlePlayer],
                          selectedPlayers.length > 0 && 'border-transparent text-white',
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

type TrainingStatsSnapshot = {
  id: string;
  timestamp: number;
  rows: Array<{ title: string; value: string; sub?: string }>;
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

function getMaxWindowExpDelta(samples: TrainingSample[], minutes: number) {
  if (samples.length < 2) return 0;

  const ordered = [...samples].sort((a, b) => a.timestamp - b.timestamp);
  const intervalRates: number[] = [];

  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1];
    const current = ordered[index];
    const elapsedMinutes = Math.max(
      1 / 60,
      (current.timestamp - previous.timestamp) / 60000,
    );
    const delta = current.exp - previous.exp;
    if (delta > 0) intervalRates.push(delta / elapsedMinutes);
  }

  const medianRate = getMedianTrainingValue(intervalRates);
  const rateDeviations = intervalRates.map((rate) =>
    Math.abs(rate - medianRate),
  );
  const rateMad = getMedianTrainingValue(rateDeviations);
  const rateUpperLimit =
    medianRate > 0 && intervalRates.length >= 3
      ? medianRate +
        Math.max(
          medianRate * 5,
          rateMad * 8,
          750000,
        )
      : Number.POSITIVE_INFINITY;

  // Remove a single accepted OCR jump that is far above the surrounding
  // training rate. This prevents a screen-switch number from becoming the
  // permanent "highest" 10/60-minute result.
  const cleaned: TrainingSample[] = [];
  for (const sample of ordered) {
    const previous = cleaned[cleaned.length - 1];
    if (!previous) {
      cleaned.push(sample);
      continue;
    }

    const elapsedMinutes = Math.max(
      1 / 60,
      (sample.timestamp - previous.timestamp) / 60000,
    );
    const delta = sample.exp - previous.exp;
    if (delta < 0) continue;

    const rate = delta / elapsedMinutes;
    if (rate > rateUpperLimit) continue;
    cleaned.push(sample);
  }

  if (cleaned.length < 2) return 0;

  const windowMs = minutes * 60000;
  const candidates: number[] = [];

  for (const current of cleaned) {
    const cutoff = current.timestamp - windowMs;
    const baseline =
      [...cleaned]
        .reverse()
        .find((sample) => sample.timestamp <= cutoff) ||
      cleaned[0];
    const delta = current.exp - baseline.exp;
    if (delta > 0) candidates.push(delta);
  }

  if (candidates.length === 0) return 0;
  if (candidates.length < 4) return Math.max(...candidates);

  const median = getMedianTrainingValue(candidates);
  const deviations = candidates.map((value) =>
    Math.abs(value - median),
  );
  const mad = getMedianTrainingValue(deviations);
  const upperLimit =
    median +
    Math.max(
      median * 4,
      mad * 8,
      1000000,
    );
  const valid = candidates.filter((value) => value <= upperLimit);

  return Math.max(0, ...(valid.length > 0 ? valid : [median]));
}

function getMedianTrainingValue(values: number[]) {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function buildExpPerMinutePoints(samples: TrainingSample[]) {
  if (samples.length < 2) return [] as Array<{ minute: number; value: number }>;
  const start = samples[0].timestamp;
  const rawPoints: Array<{ minute: number; value: number }> = [];

  for (let i = 1; i < samples.length; i += 1) {
    const prev = samples[i - 1];
    const current = samples[i];
    const elapsed = Math.max(1, current.timestamp - prev.timestamp) / 60000;
    const value = Math.max(0, (current.exp - prev.exp) / elapsed);
    rawPoints.push({ minute: (current.timestamp - start) / 60000, value });
  }

  if (rawPoints.length < 4) return rawPoints;
  const positiveValues = rawPoints.map((point) => point.value).filter((value) => value > 0);
  const median = getMedianTrainingValue(positiveValues);
  if (median <= 0) return rawPoints;

  return rawPoints.filter((point) => {
    if (point.value <= 0) return true;
    return point.value <= Math.max(median * 8, median + 250000);
  });
}

function isExtremeTrainingOcrSample(samples: TrainingSample[], exp: number, now: number) {
  if (samples.length < 4) return false;
  const recent = samples.slice(-10);
  const last = recent[recent.length - 1];
  if (!last) return false;

  const rawValues = recent.map((sample) => sample.exp);
  const medianExp = getMedianTrainingValue(rawValues);
  const rawDeviation = Math.abs(exp - medianExp);

  const rates: number[] = [];
  for (let index = 1; index < recent.length; index += 1) {
    const prev = recent[index - 1];
    const current = recent[index];
    const elapsed = Math.max(1, current.timestamp - prev.timestamp) / 60000;
    const delta = current.exp - prev.exp;
    if (delta > 0) rates.push(delta / elapsed);
  }

  const medianRate = getMedianTrainingValue(rates);
  const elapsedFromLast = Math.max(1, now - last.timestamp) / 60000;
  const deltaFromLast = exp - last.exp;
  const candidateRate = Math.max(0, deltaFromLast / elapsedFromLast);

  if (medianRate > 0) {
    const expected = last.exp + medianRate * elapsedFromLast;
    const predictionDeviation = Math.abs(exp - expected);
    const rateTooHigh = candidateRate > Math.max(medianRate * 10, medianRate + 500000) && deltaFromLast > Math.max(250000, medianRate * elapsedFromLast * 5);
    const valueTooFarFromTrend = predictionDeviation > Math.max(1000000, medianRate * elapsedFromLast * 12, medianExp * 0.12);
    if (rateTooHigh || valueTooFarFromTrend) return true;
  }

  if (medianExp > 0 && rawDeviation > Math.max(5000000, medianExp * 0.25) && exp > last.exp) return true;
  return false;
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
  const paddingLeft = 54;
  const paddingRight = 34;
  const paddingTop = 24;
  const paddingBottom = 34;
  const maxMinute = Math.max(1, ...points.map((point) => point.minute));
  const maxValue = Math.max(1000, ...points.map((point) => point.value));
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  function pointToXY(point: { minute: number; value: number }) {
    return {
      x: paddingLeft + (point.minute / maxMinute) * plotWidth,
      y: height - paddingBottom - (point.value / maxValue) * plotHeight,
    };
  }

  const path = points.map((point, index) => {
    const { x, y } = pointToXY(point);
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  const yTicks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="rounded-[1.8rem] border border-orange-100 bg-white/85 p-4 shadow-[0_24px_70px_-46px_rgba(124,45,18,0.25)] backdrop-blur-xl">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs font-black text-slate-500">
        <span>EXP / 分折線圖</span>
        <span>最高刻度 {formatTrainingNumber(maxValue)} EXP / 分</span>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${width} ${height}`} className="min-w-[760px] rounded-2xl">
          <defs>
            <linearGradient id="trainingChartBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff7ed" />
              <stop offset="55%" stopColor="#ffffff" />
              <stop offset="100%" stopColor="#fffaf5" />
            </linearGradient>
            <linearGradient id="trainingChartLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width={width} height={height} rx="18" fill="url(#trainingChartBg)" />
          {yTicks.map((ratio) => {
            const y = height - paddingBottom - ratio * plotHeight;
            return (
              <g key={ratio}>
                <line x1={paddingLeft} x2={width - paddingRight} y1={y} y2={y} stroke="rgba(249,115,22,0.14)" strokeDasharray="6 6" />
                <text x={paddingLeft - 10} y={y + 4} textAnchor="end" fill="rgba(71,85,105,0.72)" fontSize="11">{formatTrainingNumber(maxValue * ratio)}</text>
              </g>
            );
          })}
          <line x1={paddingLeft} x2={paddingLeft} y1={paddingTop} y2={height - paddingBottom} stroke="rgba(148,163,184,0.28)" />
          <line x1={paddingLeft} x2={width - paddingRight} y1={height - paddingBottom} y2={height - paddingBottom} stroke="rgba(148,163,184,0.28)" />
          {path ? <path d={path} fill="none" stroke="url(#trainingChartLine)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
          {points.map((point, index) => {
            const { x, y } = pointToXY(point);
            return <circle key={`${point.minute}-${index}`} cx={x} cy={y} r="4" fill="#ffffff" stroke="#f97316" strokeWidth="2.25" />;
          })}
          {points.length === 0 ? <text x={width / 2} y={height / 2} textAnchor="middle" fill="rgba(71,85,105,0.75)" fontSize="16" fontWeight="800">加入至少 2 筆有效 EXP 紀錄後顯示折線圖</text> : null}
          <text x={paddingLeft} y={height - 8} fill="rgba(71,85,105,0.72)" fontSize="12">0.0 分</text>
          <text x={width - paddingRight} y={height - 8} textAnchor="end" fill="rgba(71,85,105,0.72)" fontSize="12">{maxMinute.toFixed(1)} 分</text>
        </svg>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
        <span className="inline-flex items-center gap-2"><span className="h-1 w-10 rounded-full bg-orange-500" />EXP / 分</span>
        <span>極端 OCR 誤判值會被忽略，不寫入趨勢圖資料。</span>
      </div>
    </div>
  );
}

const ARTALE_EXP_BY_LEVEL: Record<number, number> = {
  1: 15,
  2: 34,
  3: 57,
  4: 92,
  5: 135,
  6: 372,
  7: 560,
  8: 840,
  9: 1242,
  10: 1716,
  11: 2360,
  12: 3216,
  13: 4200,
  14: 5460,
  15: 7050,
  16: 8840,
  17: 11040,
  18: 13716,
  19: 16680,
  20: 20216,
  21: 24402,
  22: 28980,
  23: 34320,
  24: 40512,
  25: 47216,
  26: 54900,
  27: 63666,
  28: 73080,
  29: 83720,
  30: 95700,
  31: 108480,
  32: 122760,
  33: 138666,
  34: 155540,
  35: 174216,
  36: 194832,
  37: 216600,
  38: 240500,
  39: 266682,
  40: 294216,
  41: 324240,
  42: 356916,
  43: 391160,
  44: 428280,
  45: 468450,
  46: 510420,
  47: 555680,
  48: 604416,
  49: 655200,
  50: 709716,
  51: 748608,
  52: 789631,
  53: 832902,
  54: 878545,
  55: 926689,
  56: 977471,
  57: 1031036,
  58: 1087536,
  59: 1147132,
  60: 1209994,
  61: 1276301,
  62: 1346242,
  63: 1420016,
  64: 1497832,
  65: 1579913,
  66: 1666492,
  67: 1757815,
  68: 1854143,
  69: 1955750,
  70: 2062925,
  71: 2175973,
  72: 2295216,
  73: 2420993,
  74: 2553663,
  75: 2693603,
  76: 2841212,
  77: 2996910,
  78: 3161140,
  79: 3334370,
  80: 3517093,
  81: 3709829,
  82: 3913127,
  83: 4127566,
  84: 4353756,
  85: 4592341,
  86: 4844001,
  87: 5109452,
  88: 5389449,
  89: 5684790,
  90: 5996316,
  91: 6324914,
  92: 6671519,
  93: 7037118,
  94: 7422752,
  95: 7829518,
  96: 8258575,
  97: 8711144,
  98: 9188514,
  99: 9692044,
  100: 10223168,
  101: 10783397,
  102: 11374327,
  103: 11997640,
  104: 12655110,
  105: 13348610,
  106: 14080113,
  107: 14851703,
  108: 15665576,
  109: 16524049,
  110: 17429566,
  111: 18384706,
  112: 19392187,
  113: 20454878,
  114: 21575805,
  115: 22758159,
  116: 24005306,
  117: 25320796,
  118: 26708375,
  119: 28171993,
  120: 29715818,
  121: 31344244,
  122: 33061908,
  123: 34873700,
  124: 36784778,
  125: 38800583,
  126: 40926854,
  127: 43169645,
  128: 45535341,
  129: 48030677,
  130: 50662758,
  131: 53439077,
  132: 56367538,
  133: 59456479,
  134: 62714694,
  135: 66151459,
  136: 69776558,
  137: 73600313,
  138: 77633610,
  139: 81887931,
  140: 86375389,
  141: 91108760,
  142: 96101520,
  143: 101367883,
  144: 106922842,
  145: 112782213,
  146: 118962678,
  147: 125481832,
  148: 132358236,
  149: 139611467,
  150: 147262175,
  151: 155332142,
  152: 163844343,
  153: 172823012,
  154: 182293713,
  155: 192283408,
  156: 202820538,
  157: 213935103,
  158: 225658746,
  159: 238024845,
  160: 251068606,
  161: 264827165,
  162: 279339693,
  163: 294647508,
  164: 310794191,
  165: 327825712,
  166: 345790561,
  167: 364739883,
  168: 384727628,
  169: 405810702,
  170: 428049128,
  171: 451506220,
  172: 476248760,
  173: 502347192,
  174: 529875818,
  175: 558913012,
  176: 589541445,
  177: 621848316,
  178: 655925603,
  179: 691870326,
  180: 729784819,
  181: 769777027,
  182: 811960808,
  183: 856456260,
  184: 903390063,
  185: 952895838,
  186: 1005114529,
  187: 1060194805,
  188: 1118293480,
  189: 1179575962,
  190: 1244216724,
  191: 1312399800,
  192: 1384319309,
  193: 1460180007,
  194: 1540197871,
  195: 1624600714,
  196: 1713628833,
  197: 1807535693,
  198: 1906588648,
  199: 2011069705,
  200: 2121276324,
};

type TrainingAdaptiveCrop = { x: number; y: number; w: number; h: number };
type TrainingHudPixelBox = { minX: number; minY: number; maxX: number; maxY: number; score?: number };
type TrainingExpPushResult = {
  accepted: boolean;
  status: 'added' | 'unchanged' | 'pending' | 'rebaseline' | 'rejected';
  message: string;
};

type TrainingOcrHistoryRecord = {
  id: string;
  timestamp: number;
  source: 'ocr' | 'manual';
  status: 'added' | 'unchanged' | 'pending' | 'rebaseline' | 'rejected' | 'failed';
  exp: number | null;
  rawText?: string;
  message: string;
};

type TrainingOcrHistoryFilter = 'all' | TrainingOcrHistoryRecord['status'];

function TrainingEfficiencyPanel() {
  const TRAINING_OCR_CROP_STORAGE_KEY = 'maple_raid_board_training_ocr_crop_v46';
  const TRAINING_LEVEL_CROP_STORAGE_KEY = 'maple_raid_board_training_level_crop_v83';
  const TRAINING_STATS_SNAPSHOTS_STORAGE_KEY = 'maple_raid_board_training_stats_snapshots_v68';
  const DEFAULT_OCR_CROP: TrainingAdaptiveCrop = { x: 50.4, y: 93.6, w: 13, h: 6.4 };

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const videoWrapRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const captureTrackRef = useRef<MediaStreamTrack | null>(null);
  const imageCaptureRef = useRef<any>(null);
  const liveCaptureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ocrTimerRef = useRef<number | null>(null);
  const ocrSchedulerWorkerRef = useRef<Worker | null>(null);
  const ocrBusyRef = useRef(false);
  const ocrWorkerRef = useRef<any>(null);
  const ocrWorkerPromiseRef = useRef<Promise<any> | null>(null);
  const preferredExpVariantRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const levelPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const captureReferenceFrameRef = useRef<HTMLCanvasElement | null>(null);
  const hudPanelCropRef = useRef<TrainingAdaptiveCrop | null>(null);
  const hudDetectionMissRef = useRef(0);
  const initialCropDetectionRef = useRef(false);
  const ocrCropRef = useRef<TrainingAdaptiveCrop>(loadSavedTrainingCrop());
  const levelCropRef = useRef<TrainingAdaptiveCrop | null>(loadSavedTrainingLevelCrop());
  const runOcrOnceRef = useRef<() => Promise<void>>(async () => {});
  const levelCandidateRef = useRef<{ value: number; count: number } | null>(null);
  const expCandidateRef = useRef<{
    value: number;
    count: number;
    reason: 'lower' | 'outlier';
    level: number;
  } | null>(null);
  const initialExpCandidateRef = useRef<{
    value: number;
    count: number;
    lastSeenAt: number;
  } | null>(null);
  const baselineLevelRef = useRef<number | null>(null);
  const [running, setRunning] = useState(false);
  const [captureActive, setCaptureActive] = useState(false);
  const [ocrActive, setOcrActive] = useState(false);
  const [samples, setSamples] = useState<TrainingSample[]>([]);
  const [ocrHistory, setOcrHistory] = useState<TrainingOcrHistoryRecord[]>([]);
  const [ocrHistoryFilter, setOcrHistoryFilter] = useState<TrainingOcrHistoryFilter>('all');
  const [expInput, setExpInput] = useState('');
  const [currentLevelInput, setCurrentLevelInput] = useState('');
  const [levelOcrText, setLevelOcrText] = useState('');
  const [levelOcrMessage, setLevelOcrMessage] = useState('開始分析後會自動尋找 LV. 等級區塊並辨識目前等級。');
  const [levelOcrSuccessCount, setLevelOcrSuccessCount] = useState(0);
  const [cropDetectionSource, setCropDetectionSource] = useState('尚未從螢幕擷取對照辨識');
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [accumulatedActiveMs, setAccumulatedActiveMs] = useState(0);
  const [currentRunStartedAt, setCurrentRunStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [message, setMessage] = useState('');
  const [ocrMessage, setOcrMessage] = useState('按「開始分析」後會自動啟動畫面擷取並自動抓取 OCR 裁切區；Debug 內才會顯示手動框選、儲存預設與清除預設。');
  const [ocrText, setOcrText] = useState('');
  const [ocrSuccessCount, setOcrSuccessCount] = useState(0);
  const [ocrFailCount, setOcrFailCount] = useState(0);
  const [ocrDurationMs, setOcrDurationMs] = useState(0);
  const [ocrWorkerStatus, setOcrWorkerStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [captureFrameSource, setCaptureFrameSource] = useState<'image-capture' | 'video' | 'none'>('none');
  const [lastFrameCapturedAt, setLastFrameCapturedAt] = useState<number | null>(null);
  const [ocrSchedulerMode, setOcrSchedulerMode] = useState<'worker' | 'window' | 'stopped'>('stopped');
  const [ocrIntervalSec, setOcrIntervalSec] = useState(1);
  const [ocrCrop, setOcrCrop] = useState<TrainingAdaptiveCrop>(() => ocrCropRef.current);
  const [levelCrop, setLevelCrop] = useState<TrainingAdaptiveCrop | null>(() => levelCropRef.current);
  const [hudPanelCrop, setHudPanelCrop] = useState<TrainingAdaptiveCrop | null>(null);
  const [debugEnabled, setDebugEnabled] = useState(false);
  const [manualSelectMode, setManualSelectMode] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragBox, setDragBox] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [trainingStatSnapshots, setTrainingStatSnapshots] = useState<TrainingStatsSnapshot[]>(() => loadTrainingStatsSnapshots());
  const [selectedTrainingStatSnapshotId, setSelectedTrainingStatSnapshotId] = useState<string | null>(null);

  function loadSavedTrainingCrop() {
    try {
      const raw = localStorage.getItem(TRAINING_OCR_CROP_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (
        parsed &&
        Number.isFinite(parsed.x) &&
        Number.isFinite(parsed.y) &&
        Number.isFinite(parsed.w) &&
        Number.isFinite(parsed.h) &&
        parsed.w > 0 &&
        parsed.h > 0
      ) {
        return parsed as { x: number; y: number; w: number; h: number };
      }
    } catch {
      // ignore invalid storage
    }
    return DEFAULT_OCR_CROP;
  }

  function loadSavedTrainingLevelCrop(): TrainingAdaptiveCrop | null {
    try {
      const raw = localStorage.getItem(TRAINING_LEVEL_CROP_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (
        parsed &&
        Number.isFinite(parsed.x) &&
        Number.isFinite(parsed.y) &&
        Number.isFinite(parsed.w) &&
        Number.isFinite(parsed.h) &&
        parsed.w > 0 &&
        parsed.h > 0
      ) {
        return parsed as TrainingAdaptiveCrop;
      }
    } catch {
      // ignore invalid storage
    }
    return null;
  }

  function loadTrainingStatsSnapshots(): TrainingStatsSnapshot[] {
    try {
      const raw = localStorage.getItem(TRAINING_STATS_SNAPSHOTS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item) => item && typeof item === 'object')
        .map((item) => {
          const source = item as {
            id?: unknown;
            timestamp?: unknown;
            rows?: Array<{ title?: unknown; value?: unknown; sub?: unknown }>;
          };
          return {
            id: String(source.id || `${source.timestamp || Date.now()}-${Math.random().toString(36).slice(2)}`),
            timestamp: Number(source.timestamp || Date.now()),
            rows: Array.isArray(source.rows)
              ? source.rows
                  .filter((row) => row && typeof row === 'object')
                  .map((row) => ({
                    title: String(row.title || ''),
                    value: String(row.value || ''),
                    sub: row.sub ? String(row.sub) : undefined,
                  }))
                  .filter((row) => row.title && row.value)
              : [],
          };
        })
        .filter((item) => Number.isFinite(item.timestamp) && item.rows.length > 0)
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  function saveTrainingStatsSnapshots(items: TrainingStatsSnapshot[]) {
    try {
      localStorage.setItem(TRAINING_STATS_SNAPSHOTS_STORAGE_KEY, JSON.stringify(items.slice(0, 10)));
    } catch {
      // ignore localStorage quota / privacy-mode errors
    }
  }

  function stopOcrScheduler() {
    if (ocrTimerRef.current) {
      window.clearInterval(ocrTimerRef.current);
      ocrTimerRef.current = null;
    }

    if (ocrSchedulerWorkerRef.current) {
      try {
        ocrSchedulerWorkerRef.current.postMessage({ type: 'stop' });
        ocrSchedulerWorkerRef.current.terminate();
      } catch {
        // ignore scheduler shutdown errors
      }
      ocrSchedulerWorkerRef.current = null;
    }

    setOcrSchedulerMode('stopped');
  }

  function startOcrScheduler(intervalSeconds: number) {
    stopOcrScheduler();
    const intervalMs = Math.max(500, intervalSeconds * 1000);

    try {
      const workerSource = `
        let timer = null;
        self.onmessage = (event) => {
          const data = event.data || {};
          if (data.type === 'stop') {
            if (timer) clearInterval(timer);
            timer = null;
            return;
          }
          if (data.type === 'start') {
            if (timer) clearInterval(timer);
            const intervalMs = Math.max(500, Number(data.intervalMs) || 1000);
            self.postMessage({ type: 'tick', at: Date.now() });
            timer = setInterval(() => {
              self.postMessage({ type: 'tick', at: Date.now() });
            }, intervalMs);
          }
        };
      `;
      const blob = new Blob([workerSource], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);
      const scheduler = new Worker(url);
      URL.revokeObjectURL(url);
      scheduler.onmessage = (event) => {
        if (event.data?.type === 'tick') {
          void runOcrOnceRef.current();
        }
      };
      scheduler.onerror = () => {
        scheduler.terminate();
        if (ocrSchedulerWorkerRef.current === scheduler) {
          ocrSchedulerWorkerRef.current = null;
          ocrTimerRef.current = window.setInterval(() => {
            void runOcrOnceRef.current();
          }, intervalMs);
          setOcrSchedulerMode('window');
        }
      };
      ocrSchedulerWorkerRef.current = scheduler;
      scheduler.postMessage({ type: 'start', intervalMs });
      setOcrSchedulerMode('worker');
      return;
    } catch {
      // fall through to window timer
    }

    void runOcrOnceRef.current();
    ocrTimerRef.current = window.setInterval(() => {
      void runOcrOnceRef.current();
    }, intervalMs);
    setOcrSchedulerMode('window');
  }

  function makeScaledFrame(
    source: HTMLCanvasElement,
    maxWidth = 1280,
  ) {
    if (source.width <= maxWidth) return source;
    const scale = maxWidth / source.width;
    const frame = document.createElement('canvas');
    frame.width = Math.max(1, Math.round(source.width * scale));
    frame.height = Math.max(1, Math.round(source.height * scale));
    const ctx = frame.getContext('2d', { willReadFrequently: true });
    if (!ctx) return source;
    ctx.drawImage(source, 0, 0, frame.width, frame.height);
    return frame;
  }

  async function captureLiveTrackFrame(maxWidth = 2560) {
    const track = captureTrackRef.current;
    const ImageCaptureConstructor = (window as any).ImageCapture;

    if (
      track?.readyState === 'live' &&
      ImageCaptureConstructor
    ) {
      try {
        if (!imageCaptureRef.current) {
          imageCaptureRef.current = new ImageCaptureConstructor(track);
        }
        const bitmap = await imageCaptureRef.current.grabFrame();
        const sourceWidth = bitmap.width;
        const sourceHeight = bitmap.height;
        const scale = Math.min(1, maxWidth / sourceWidth);
        const canvas = liveCaptureCanvasRef.current || document.createElement('canvas');
        liveCaptureCanvasRef.current = canvas;
        canvas.width = Math.max(1, Math.round(sourceWidth * scale));
        canvas.height = Math.max(1, Math.round(sourceHeight * scale));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          bitmap.close?.();
          return null;
        }
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();
        captureReferenceFrameRef.current = canvas;
        setCaptureFrameSource('image-capture');
        setLastFrameCapturedAt(Date.now());
        return canvas;
      } catch {
        imageCaptureRef.current = null;
      }
    }

    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;
    const scale = Math.min(1, maxWidth / video.videoWidth);
    const canvas = liveCaptureCanvasRef.current || document.createElement('canvas');
    liveCaptureCanvasRef.current = canvas;
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    captureReferenceFrameRef.current = canvas;
    setCaptureFrameSource('video');
    setLastFrameCapturedAt(Date.now());
    return canvas;
  }

  function cropFrameByPercent(
    source: HTMLCanvasElement,
    crop: TrainingAdaptiveCrop | null,
    minimumWidth: number,
    minimumHeight: number,
    preview: HTMLCanvasElement | null,
  ) {
    if (!crop) return null;
    const sx = Math.max(0, Math.floor((crop.x / 100) * source.width));
    const sy = Math.max(0, Math.floor((crop.y / 100) * source.height));
    const sw = Math.max(
      minimumWidth,
      Math.min(
        source.width - sx,
        Math.floor((crop.w / 100) * source.width),
      ),
    );
    const sh = Math.max(
      minimumHeight,
      Math.min(
        source.height - sy,
        Math.floor((crop.h / 100) * source.height),
      ),
    );
    if (sw <= 0 || sh <= 0) return null;

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);

    if (preview) {
      preview.width = sw;
      preview.height = sh;
      const previewCtx = preview.getContext('2d');
      previewCtx?.drawImage(canvas, 0, 0);
    }

    return canvas;
  }

  async function ensureTrainingOcrWorker() {
    if (ocrWorkerRef.current) return ocrWorkerRef.current;
    if (ocrWorkerPromiseRef.current) return ocrWorkerPromiseRef.current;

    setOcrWorkerStatus('loading');
    const promise = (async () => {
      const tesseractUrl =
        'https://cdn.jsdelivr.net/npm/tesseract.js@6.0.1/dist/tesseract.esm.min.js';
      const tesseractModule =
        (await import(/* @vite-ignore */ tesseractUrl)) as any;
      const tesseractApi =
        tesseractModule.default ?? tesseractModule;
      const createWorker =
        tesseractApi.createWorker ?? tesseractModule.createWorker;

      if (typeof createWorker !== 'function') {
        throw new Error('tesseract.js createWorker API unavailable');
      }

      const worker = await createWorker('eng');
      ocrWorkerRef.current = worker;
      setOcrWorkerStatus('ready');
      return worker;
    })();

    ocrWorkerPromiseRef.current = promise;

    try {
      return await promise;
    } catch (error) {
      ocrWorkerRef.current = null;
      setOcrWorkerStatus('error');
      throw error;
    } finally {
      ocrWorkerPromiseRef.current = null;
    }
  }

  async function terminateTrainingOcrWorker() {
    const worker = ocrWorkerRef.current;
    ocrWorkerRef.current = null;
    ocrWorkerPromiseRef.current = null;
    setOcrWorkerStatus('idle');

    if (worker && typeof worker.terminate === 'function') {
      try {
        await worker.terminate();
      } catch {
        // ignore worker shutdown errors
      }
    }
  }

  async function recognizeWithTrainingWorker(
    worker: any,
    canvas: HTMLCanvasElement,
    parameters: Record<string, string>,
  ) {
    if (typeof worker.setParameters === 'function') {
      await worker.setParameters(parameters);
    }
    return worker.recognize(canvas);
  }

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      stopOcrScheduler();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      captureTrackRef.current = null;
      imageCaptureRef.current = null;
      void terminateTrainingOcrWorker();
    };
  }, []);

  useEffect(() => {
    ocrCropRef.current = ocrCrop;
    if (captureActive) drawOcrCropPreview(ocrCrop);
  }, [ocrCrop, captureActive]);

  useEffect(() => {
    levelCropRef.current = levelCrop;
    if (captureActive) drawLevelCropPreview(levelCrop);
  }, [levelCrop, captureActive]);

  useEffect(() => {
    if (!debugEnabled) {
      setManualSelectMode(false);
      setDragStart(null);
      setDragBox(null);
    }
  }, [debugEnabled]);

  const firstSample = samples[0];
  const lastSample = samples[samples.length - 1];
  const activeElapsedMs = accumulatedActiveMs + (ocrActive && currentRunStartedAt ? Math.max(0, now - currentRunStartedAt) : 0);
  const elapsedMinutes = activeElapsedMs / 60000;
  const totalExp = firstSample && lastSample ? Math.max(0, lastSample.exp - firstSample.exp) : 0;
  const expPerMinute = elapsedMinutes > 0 ? totalExp / elapsedMinutes : 0;
  const currentLevel = Math.max(0, Math.min(200, Number(currentLevelInput) || 0));
  const targetExp = ARTALE_EXP_BY_LEVEL[currentLevel] || 0;
  const currentExp = lastSample?.exp || Math.max(0, Number(expInput.replace(/,/g, '')) || 0);
  const currentPercent = targetExp > 0 ? Math.min(999.99, (currentExp / targetExp) * 100) : 0;
  const totalExpPercent = targetExp > 0 ? (totalExp / targetExp) * 100 : 0;
  const percentPerMinute = targetExp > 0 ? (expPerMinute / targetExp) * 100 : 0;
  const etaMinutes = targetExp > currentExp && expPerMinute > 0 ? (targetExp - currentExp) / expPerMinute : 0;
  const accumulated10 = getWindowExpDelta(samples, 10, now);
  const accumulated60 = getWindowExpDelta(samples, 60, now);
  const highest10 = getMaxWindowExpDelta(samples, 10);
  const highest60 = getMaxWindowExpDelta(samples, 60);
  const predicted10 = expPerMinute * 10;
  const predicted60 = expPerMinute * 60;
  const ocrHistoryFilterOptions: Array<{
    key: TrainingOcrHistoryFilter;
    label: string;
  }> = [
    { key: 'all', label: '全部' },
    { key: 'added', label: '已加入' },
    { key: 'unchanged', label: '未變化' },
    { key: 'pending', label: '待確認' },
    { key: 'rebaseline', label: '新基準' },
    { key: 'failed', label: '未辨識' },
    { key: 'rejected', label: '已拒絕' },
  ];
  const filteredOcrHistory =
    ocrHistoryFilter === 'all'
      ? ocrHistory
      : ocrHistory.filter(
          (record) => record.status === ocrHistoryFilter,
        );

  function appendTrainingOcrHistory(
    record: Omit<TrainingOcrHistoryRecord, 'id' | 'timestamp'>,
  ) {
    const timestamp = Date.now();
    const nextRecord: TrainingOcrHistoryRecord = {
      ...record,
      id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
      timestamp,
    };

    setOcrHistory((previous) => {
      const next = [...previous, nextRecord];
      return next.length > 2000 ? next.slice(-2000) : next;
    });
  }

  function setConfirmedExpBaseline(
    exp: number,
    confirmedLevel: number,
  ) {
    const timestamp = Date.now();
    const baseline: TrainingSample = {
      id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
      timestamp,
      exp,
    };

    setSamples([baseline]);
    setExpInput(String(exp));
    setAccumulatedActiveMs(0);
    setCurrentRunStartedAt(timestamp);
    setAnalysisStartedAt(timestamp);
    setRunning(true);
    expCandidateRef.current = null;
    initialExpCandidateRef.current = null;
    baselineLevelRef.current = confirmedLevel;

    const message =
      `EXP ${formatTrainingNumber(exp)} 已通過多流程與升級確認；Lv.${confirmedLevel} 已設為新基準並重新起算。`;
    setMessage(message);

    return {
      accepted: true,
      status: 'rebaseline',
      message,
    } satisfies TrainingExpPushResult;
  }

  function rejectExceptionalExp(
    exp: number,
    message: string,
  ): TrainingExpPushResult {
    expCandidateRef.current = null;
    initialExpCandidateRef.current = null;
    setMessage(message);
    return {
      accepted: false,
      status: 'rejected',
      message,
    };
  }

  function confirmLowerExpAfterLevelUp(
    exp: number,
    recognitionAgreement: number,
  ): TrainingExpPushResult {
    const baselineLevel = baselineLevelRef.current;
    const detectedLevel = currentLevel;

    if (!baselineLevel || detectedLevel !== baselineLevel + 1) {
      return rejectExceptionalExp(
        exp,
        `EXP ${formatTrainingNumber(exp)} 小於目前基準，但未確認等級由 Lv.${baselineLevel || '--'} 升至下一級；已拒絕，不會自動設為新基準。`,
      );
    }

    if (recognitionAgreement < 2) {
      return rejectExceptionalExp(
        exp,
        `EXP ${formatTrainingNumber(exp)} 小於目前基準，但只有單一影像流程辨識成功；已拒絕，不會自動設為新基準。`,
      );
    }

    const levelTarget = ARTALE_EXP_BY_LEVEL[detectedLevel] || 0;
    if (levelTarget > 0 && exp > levelTarget * 1.02) {
      return rejectExceptionalExp(
        exp,
        `EXP ${formatTrainingNumber(exp)} 超過 Lv.${detectedLevel} 升級需求的合理範圍；已拒絕。`,
      );
    }

    const previous = expCandidateRef.current;
    const tolerance = Math.max(50000, exp * 0.0005);
    const matchesPrevious =
      previous &&
      previous.reason === 'lower' &&
      previous.level === detectedLevel &&
      exp >= previous.value &&
      Math.abs(previous.value - exp) <= tolerance;
    const count = matchesPrevious ? previous.count + 1 : 1;

    expCandidateRef.current = {
      value: exp,
      count,
      reason: 'lower',
      level: detectedLevel,
    };

    const requiredCount = 3;
    if (count >= requiredCount) {
      return setConfirmedExpBaseline(exp, detectedLevel);
    }

    const message =
      `EXP ${formatTrainingNumber(exp)} 為升級後新基準候選（${count}/${requiredCount}）；需 Lv.${detectedLevel} 與至少兩種影像流程持續一致才會套用。`;
    setMessage(message);

    return {
      accepted: false,
      status: 'pending',
      message,
    };
  }

  function confirmInitialExp(
    exp: number,
    recognitionAgreement: number,
  ): TrainingExpPushResult | null {
    // Two image treatments agreeing in the same frame are enough.
    if (recognitionAgreement >= 2) {
      initialExpCandidateRef.current = null;
      return null;
    }

    const now = Date.now();
    const previous = initialExpCandidateRef.current;
    const maximumIncrease = Math.max(
      1000000,
      exp * 0.005,
    );
    const isConsecutive =
      previous &&
      now - previous.lastSeenAt <= 10000 &&
      exp >= previous.value &&
      exp - previous.value <= maximumIncrease;
    const count = isConsecutive ? previous.count + 1 : 1;

    initialExpCandidateRef.current = {
      value: exp,
      count,
      lastSeenAt: now,
    };

    if (count >= 2) {
      initialExpCandidateRef.current = null;
      return null;
    }

    const message =
      `初始 EXP ${formatTrainingNumber(exp)} 已辨識，等待下一次連續確認（1/2）；單一影像流程不再直接拒絕。`;
    setMessage(message);

    return {
      accepted: false,
      status: 'pending',
      message,
    };
  }

  function pushSample(
    exp: number,
    source: 'manual' | 'ocr',
    recognitionAgreement = source === 'manual' ? 4 : 1,
  ): TrainingExpPushResult {
    if (!Number.isFinite(exp) || exp < 0) {
      const message =
        source === 'ocr'
          ? 'EXP OCR 辨識格式不正確。'
          : '請輸入正確的目前 EXP。';
      setMessage(message);
      return { accepted: false, status: 'rejected', message };
    }

    const effectiveLevel = currentLevel > 0 ? currentLevel : null;
    const levelTarget =
      effectiveLevel !== null
        ? ARTALE_EXP_BY_LEVEL[effectiveLevel] || 0
        : 0;

    if (
      source === 'ocr' &&
      levelTarget > 0 &&
      exp > levelTarget * 1.02
    ) {
      return rejectExceptionalExp(
        exp,
        `EXP ${formatTrainingNumber(exp)} 超過 Lv.${effectiveLevel} 升級需求的合理範圍；已拒絕，不會成為新基準。`,
      );
    }

    if (source === 'manual') {
      expCandidateRef.current = null;
      initialExpCandidateRef.current = null;
      const timestamp = Date.now();
      const last = samples[samples.length - 1];

      if (last && exp < last.exp) {
        const baseline: TrainingSample = {
          id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
          timestamp,
          exp,
        };
        setSamples([baseline]);
        setAccumulatedActiveMs(0);
        setCurrentRunStartedAt(timestamp);
        setAnalysisStartedAt(timestamp);
        baselineLevelRef.current = effectiveLevel;
        setExpInput(String(exp));
        setRunning(true);
        const message =
          `已依手動輸入將 EXP ${formatTrainingNumber(exp)} 設為新基準並重新起算。`;
        setMessage(message);
        return {
          accepted: true,
          status: 'rebaseline',
          message,
        };
      }

      setSamples((prev) =>
        [
          ...prev,
          {
            id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
            timestamp,
            exp,
          },
        ].sort((a, b) => a.timestamp - b.timestamp),
      );
      if (baselineLevelRef.current === null && effectiveLevel !== null) {
        baselineLevelRef.current = effectiveLevel;
      }
      setExpInput(String(exp));
      setRunning(true);
      const message = `已加入 EXP 紀錄：${formatTrainingNumber(exp)}。`;
      setMessage(message);
      return { accepted: true, status: 'added', message };
    }

    const last = samples[samples.length - 1];

    if (!last) {
      const initialDecision = confirmInitialExp(
        exp,
        recognitionAgreement,
      );
      if (initialDecision) return initialDecision;

      baselineLevelRef.current = effectiveLevel;
    }

    if (last) {
      if (
        baselineLevelRef.current === null &&
        effectiveLevel !== null
      ) {
        baselineLevelRef.current = effectiveLevel;
      }

      if (exp < last.exp) {
        return confirmLowerExpAfterLevelUp(
          exp,
          recognitionAgreement,
        );
      }

      const nowForOutlierCheck = Date.now();
      const elapsed = Math.max(
        1,
        (nowForOutlierCheck - last.timestamp) / 60000,
      );
      const delta = exp - last.exp;
      const estimatedPerMinute = delta / elapsed;
      const earlyJumpTooHigh =
        samples.length < 3 &&
        elapsed < 1 &&
        delta >
          Math.max(
            2000000,
            Math.max(1, last.exp) * 0.03,
          );
      const outlier =
        earlyJumpTooHigh ||
        (samples.length >= 3 &&
          expPerMinute > 0 &&
          estimatedPerMinute > expPerMinute * 20 &&
          delta > 100000) ||
        isExtremeTrainingOcrSample(
          samples,
          exp,
          nowForOutlierCheck,
        );

      if (outlier) {
        return rejectExceptionalExp(
          exp,
          `EXP ${formatTrainingNumber(exp)} 與目前趨勢差異過大；已拒絕。異常高值不會再自動成為新基準。`,
        );
      }

      if (exp === last.exp) {
        expCandidateRef.current = null;
        const message =
          `EXP ${formatTrainingNumber(exp)} 辨識成功，數值未變化。`;
        setMessage(message);
        return {
          accepted: true,
          status: 'unchanged',
          message,
        };
      }
    }

    if (recognitionAgreement < 1) {
      return rejectExceptionalExp(
        exp,
        `EXP ${formatTrainingNumber(exp)} 沒有有效辨識流程支持；已拒絕。`,
      );
    }

    expCandidateRef.current = null;
    initialExpCandidateRef.current = null;
    const timestamp = Date.now();
    setSamples((prev) =>
      [
        ...prev,
        {
          id: `${timestamp}-${Math.random().toString(36).slice(2)}`,
          timestamp,
          exp,
        },
      ].sort((a, b) => a.timestamp - b.timestamp),
    );
    if (baselineLevelRef.current === null && effectiveLevel !== null) {
      baselineLevelRef.current = effectiveLevel;
    }
    setExpInput(String(exp));
    setRunning(true);
    const message =
      `EXP ${formatTrainingNumber(exp)} 已加入統計。`;
    setMessage(message);
    return { accepted: true, status: 'added', message };
  }

  function addSample() {
    const exp = Number(expInput.replace(/,/g, ''));
    const decision = pushSample(exp, 'manual');
    appendTrainingOcrHistory({
      source: 'manual',
      status: decision.status,
      exp: Number.isFinite(exp) ? exp : null,
      message: decision.message,
    });
  }

  function resetAll() {
    setRunning(false);
    setOcrActive(false);
    stopOcrScheduler();
    setSamples([]);
    setOcrHistory([]);
    setOcrHistoryFilter('all');
    setExpInput('');
    setAnalysisStartedAt(null);
    setPaused(false);
    setAccumulatedActiveMs(0);
    setCurrentRunStartedAt(null);
    setOcrText('');
    setLevelOcrText('');
    setLevelOcrMessage('開始分析後會自動尋找 LV. 等級區塊並辨識目前等級。');
    setLevelOcrSuccessCount(0);
    setCropDetectionSource('尚未從螢幕擷取對照辨識');
    initialCropDetectionRef.current = false;
    captureReferenceFrameRef.current = null;
    hudPanelCropRef.current = null;
    hudDetectionMissRef.current = 0;
    setHudPanelCrop(null);
    levelCandidateRef.current = null;
    expCandidateRef.current = null;
    initialExpCandidateRef.current = null;
    baselineLevelRef.current = null;
    setOcrSuccessCount(0);
    setOcrFailCount(0);
    preferredExpVariantRef.current = 0;
    setOcrDurationMs(0);
    void terminateTrainingOcrWorker();
    setMessage('已重置練功效率紀錄。');
    setOcrMessage('OCR 已停止並清空紀錄。');
  }

  async function startCapture() {
    if (captureActive && captureTrackRef.current?.readyState === 'live') {
      return true;
    }

    try {
      if (!navigator.mediaDevices?.getDisplayMedia) {
        setMessage('此瀏覽器不支援螢幕擷取。');
        return false;
      }

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 15, max: 30 },
        },
        audio: false,
      });
      const track = stream.getVideoTracks()[0] || null;
      streamRef.current = stream;
      captureTrackRef.current = track;
      imageCaptureRef.current = null;
      liveCaptureCanvasRef.current = null;
      setCaptureFrameSource('none');
      setLastFrameCapturedAt(null);

      if (track) {
        try {
          track.contentHint = 'detail';
        } catch {
          // contentHint is optional
        }
        track.addEventListener(
          'ended',
          () => {
            stopOcrScheduler();
            setCaptureActive(false);
            setOcrActive(false);
            setRunning(false);
            setOcrMessage('螢幕擷取已由瀏覽器停止。');
          },
          { once: true },
        );

        const ImageCaptureConstructor = (window as any).ImageCapture;
        if (ImageCaptureConstructor) {
          try {
            imageCaptureRef.current = new ImageCaptureConstructor(track);
            setCaptureFrameSource('image-capture');
          } catch {
            imageCaptureRef.current = null;
          }
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        await videoRef.current.play().catch(() => undefined);
      }

      setCaptureActive(true);
      setMessage(
        imageCaptureRef.current
          ? '已開始螢幕擷取；OCR 將直接讀取擷取軌道，不依賴分析頁是否在前景。'
          : '已開始螢幕擷取；目前瀏覽器不支援 ImageCapture，將使用影片畫面備援。',
      );
      return true;
    } catch (err) {
      setMessage(err instanceof Error ? err.message : '無法開始螢幕擷取');
      return false;
    }
  }

  function stopCapture() {
    stopOcrScheduler();
    setOcrActive(false);
    setRunning(false);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    captureTrackRef.current = null;
    imageCaptureRef.current = null;
    liveCaptureCanvasRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCaptureActive(false);
    setCaptureFrameSource('none');
    setLastFrameCapturedAt(null);
    setManualSelectMode(false);
    setDragBox(null);
    preferredExpVariantRef.current = 0;
    void terminateTrainingOcrWorker();
    setOcrMessage('已停止螢幕擷取與 OCR。');
  }

  function waitForCapturePaint() {
    return new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => resolve());
      });
    });
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

  type HudColorComponent = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    count: number;
  };

  const TRAINING_HUD_REFERENCE = {
    width: 915,
    height: 48,
    redBarLeft: 347,
    blueBarLeft: 514,
    expBarLeft: 694,
    levelDigitsLeft: 65,
    levelDigitsTop: 20,
    levelDigitsRight: 117,
    levelDigitsBottom: 37,
    expCropLeft: 688,
    expCropTop: 0,
    expCropRight: 870,
    expCropBottom: 23,
  };

  function findColorComponents(
    source: HTMLCanvasElement,
    roi: { x: number; y: number; w: number; h: number },
    matchPixel: (r: number, g: number, b: number) => boolean,
    minimumPixels = 4,
  ) {
    const ctx = source.getContext('2d', { willReadFrequently: true });
    if (!ctx) return [] as HudColorComponent[];

    const safeX = Math.max(0, Math.floor(roi.x));
    const safeY = Math.max(0, Math.floor(roi.y));
    const safeW = Math.max(1, Math.min(source.width - safeX, Math.floor(roi.w)));
    const safeH = Math.max(1, Math.min(source.height - safeY, Math.floor(roi.h)));
    const image = ctx.getImageData(safeX, safeY, safeW, safeH);
    const data = image.data;
    const mask = new Uint8Array(safeW * safeH);

    for (let y = 0; y < safeH; y += 1) {
      for (let x = 0; x < safeW; x += 1) {
        const pixelIndex = y * safeW + x;
        const index = pixelIndex * 4;
        if (matchPixel(data[index], data[index + 1], data[index + 2])) mask[pixelIndex] = 1;
      }
    }

    const components: HudColorComponent[] = [];
    const queueX = new Int32Array(safeW * safeH);
    const queueY = new Int32Array(safeW * safeH);

    for (let startY = 0; startY < safeH; startY += 1) {
      for (let startX = 0; startX < safeW; startX += 1) {
        const startIndex = startY * safeW + startX;
        if (mask[startIndex] !== 1) continue;

        let head = 0;
        let tail = 0;
        queueX[tail] = startX;
        queueY[tail] = startY;
        tail += 1;
        mask[startIndex] = 2;

        let minX = startX;
        let maxX = startX;
        let minY = startY;
        let maxY = startY;
        let count = 0;

        while (head < tail) {
          const x = queueX[head];
          const y = queueY[head];
          head += 1;
          count += 1;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);

          for (let dy = -1; dy <= 1; dy += 1) {
            for (let dx = -1; dx <= 1; dx += 1) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              if (nx < 0 || ny < 0 || nx >= safeW || ny >= safeH) continue;
              const nextIndex = ny * safeW + nx;
              if (mask[nextIndex] !== 1) continue;
              mask[nextIndex] = 2;
              queueX[tail] = nx;
              queueY[tail] = ny;
              tail += 1;
            }
          }
        }

        if (count >= minimumPixels) {
          components.push({
            minX: minX + safeX,
            maxX: maxX + safeX,
            minY: minY + safeY,
            maxY: maxY + safeY,
            count,
          });
        }
      }
    }

    return components;
  }

  function isHorizontalHudBar(component: HudColorComponent, source: HTMLCanvasElement) {
    const width = component.maxX - component.minX + 1;
    const height = component.maxY - component.minY + 1;
    const aspect = width / Math.max(1, height);
    return (
      width >= Math.max(18, source.width * 0.015) &&
      height >= 2 &&
      height <= Math.max(45, source.height * 0.08) &&
      aspect >= 4 &&
      aspect <= 160
    );
  }

  function sampleBoxDarkRatio(source: HTMLCanvasElement, box: TrainingHudPixelBox) {
    const ctx = source.getContext('2d', { willReadFrequently: true });
    if (!ctx) return 0;

    const x = Math.max(0, Math.floor(box.minX));
    const y = Math.max(0, Math.floor(box.minY));
    const width = Math.max(1, Math.min(source.width - x, Math.ceil(box.maxX - box.minX + 1)));
    const height = Math.max(1, Math.min(source.height - y, Math.ceil(box.maxY - box.minY + 1)));
    const image = ctx.getImageData(x, y, width, height);
    const data = image.data;
    let dark = 0;
    let sampled = 0;

    for (let index = 0; index < data.length; index += 16) {
      const brightness = (data[index] + data[index + 1] + data[index + 2]) / 3;
      if (brightness <= 120) dark += 1;
      sampled += 1;
    }

    return sampled > 0 ? dark / sampled : 0;
  }

  function findTrainingHudPanel(source: HTMLCanvasElement) {
    const width = source.width;
    const height = source.height;
    const roi = { x: 0, y: 0, w: width, h: height };

    const redBars = findColorComponents(
      source,
      roi,
      (r, g, b) =>
        r >= 105 &&
        r >= g * 1.28 &&
        r >= b * 1.22 &&
        r - Math.max(g, b) >= 36,
      8,
    ).filter((item) => isHorizontalHudBar(item, source));

    const blueBars = findColorComponents(
      source,
      roi,
      (r, g, b) =>
        b >= 68 &&
        g >= 32 &&
        b >= r * 1.2 &&
        g >= r * 0.9 &&
        Math.max(b, g) - r >= 28,
      8,
    ).filter((item) => isHorizontalHudBar(item, source));

    const greenBars = findColorComponents(
      source,
      roi,
      (r, g, b) =>
        g >= 88 &&
        g >= b * 1.18 &&
        g - b >= 28 &&
        r >= 35 &&
        r <= 245,
      6,
    ).filter((item) => isHorizontalHudBar(item, source));

    type BarKind = 'red' | 'blue' | 'green';
    type BarEntry = { kind: BarKind; bar: HudColorComponent };
    type Candidate = TrainingHudPixelBox & {
      score: number;
      scale: number;
      sourcePair: string;
    };

    const referenceLeft: Record<BarKind, number> = {
      red: TRAINING_HUD_REFERENCE.redBarLeft,
      blue: TRAINING_HUD_REFERENCE.blueBarLeft,
      green: TRAINING_HUD_REFERENCE.expBarLeft,
    };

    const candidates: Candidate[] = [];

    const addPairCandidates = (
      firstKind: BarKind,
      firstBars: HudColorComponent[],
      secondKind: BarKind,
      secondBars: HudColorComponent[],
    ) => {
      const referenceDistance =
        referenceLeft[secondKind] - referenceLeft[firstKind];
      if (referenceDistance <= 0) return;

      for (const first of firstBars) {
        for (const second of secondBars) {
          if (second.minX <= first.minX) continue;

          const firstCenterY = (first.minY + first.maxY) / 2;
          const secondCenterY = (second.minY + second.maxY) / 2;
          const yDifference = Math.abs(firstCenterY - secondCenterY);
          const scale = (second.minX - first.minX) / referenceDistance;

          if (scale < 0.16 || scale > 6.5) continue;
          if (yDifference > Math.max(8, 12 * scale)) continue;

          const rawPanelX =
            first.minX - referenceLeft[firstKind] * scale;
          const rawPanelY =
            (first.minY + second.minY) / 2 - 24 * scale;
          const rawPanelWidth = TRAINING_HUD_REFERENCE.width * scale;
          const rawPanelHeight = TRAINING_HUD_REFERENCE.height * scale;

          const panel: TrainingHudPixelBox = {
            minX: Math.max(0, rawPanelX),
            minY: Math.max(0, rawPanelY),
            maxX: Math.min(width - 1, rawPanelX + rawPanelWidth),
            maxY: Math.min(height - 1, rawPanelY + rawPanelHeight),
          };

          const panelWidth = panel.maxX - panel.minX + 1;
          const panelHeight = panel.maxY - panel.minY + 1;
          if (panelWidth < 120 || panelHeight < 12) continue;

          const inferredAspect = panelWidth / Math.max(1, panelHeight);
          const referenceAspect =
            TRAINING_HUD_REFERENCE.width / TRAINING_HUD_REFERENCE.height;
          const aspectError = Math.abs(inferredAspect - referenceAspect);
          const darkRatio = sampleBoxDarkRatio(source, panel);
          const bottomBias = panel.maxY / Math.max(1, height);

          // Validate the optional third bar. It improves confidence but is no
          // longer mandatory because a partially filled EXP bar or scaled
          // fullscreen rendering may not pass a strict green threshold.
          const thirdKind: BarKind =
            firstKind !== 'red' && secondKind !== 'red'
              ? 'red'
              : firstKind !== 'blue' && secondKind !== 'blue'
                ? 'blue'
                : 'green';
          const thirdBars =
            thirdKind === 'red'
              ? redBars
              : thirdKind === 'blue'
                ? blueBars
                : greenBars;
          const expectedThirdX =
            panel.minX + referenceLeft[thirdKind] * scale;
          const expectedCenterY =
            (firstCenterY + secondCenterY) / 2;

          let thirdError = Number.POSITIVE_INFINITY;
          for (const third of thirdBars) {
            const thirdCenterY = (third.minY + third.maxY) / 2;
            const error =
              Math.abs(third.minX - expectedThirdX) +
              Math.abs(thirdCenterY - expectedCenterY) * 3;
            thirdError = Math.min(thirdError, error);
          }

          const thirdMatched =
            Number.isFinite(thirdError) &&
            thirdError <= Math.max(28, 70 * scale);

          if (darkRatio < 0.12) continue;
          if (aspectError > 7.5) continue;

          const firstHeight = first.maxY - first.minY + 1;
          const secondHeight = second.maxY - second.minY + 1;
          const heightDifference = Math.abs(firstHeight - secondHeight);

          const score =
            620 +
            darkRatio * 230 +
            bottomBias * 45 +
            (thirdMatched ? 230 - thirdError * 1.8 : 0) -
            yDifference * 16 -
            heightDifference * 5 -
            aspectError * 30;

          candidates.push({
            ...panel,
            score,
            scale,
            sourcePair: `${firstKind}+${secondKind}${thirdMatched ? '+third' : ''}`,
          });
        }
      }
    };

    addPairCandidates('red', redBars, 'blue', blueBars);
    addPairCandidates('red', redBars, 'green', greenBars);
    addPairCandidates('blue', blueBars, 'green', greenBars);

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0] || null;
  }

  function makeHudRelativeBox(
    panel: TrainingHudPixelBox,
    left: number,
    top: number,
    right: number,
    bottom: number,
  ): TrainingHudPixelBox {
    const panelWidth = panel.maxX - panel.minX + 1;
    const panelHeight = panel.maxY - panel.minY + 1;
    return {
      minX: panel.minX + (left / TRAINING_HUD_REFERENCE.width) * panelWidth,
      minY: panel.minY + (top / TRAINING_HUD_REFERENCE.height) * panelHeight,
      maxX: panel.minX + (right / TRAINING_HUD_REFERENCE.width) * panelWidth,
      maxY: panel.minY + (bottom / TRAINING_HUD_REFERENCE.height) * panelHeight,
    };
  }

  function findLevelDigitsInsideHud(source: HTMLCanvasElement, panel: TrainingHudPixelBox) {
    const search = makeHudRelativeBox(panel, 35, 8, 145, 46);
    const components = findColorComponents(
      source,
      {
        x: search.minX,
        y: search.minY,
        w: search.maxX - search.minX + 1,
        h: search.maxY - search.minY + 1,
      },
      (r, g, b) =>
        r >= 175 &&
        g >= 38 &&
        g <= 205 &&
        b <= 125 &&
        r >= g * 1.2 &&
        r - b >= 75,
      3,
    );

    const groups = [...components]
      .filter((item) => {
        const width = item.maxX - item.minX + 1;
        const height = item.maxY - item.minY + 1;
        return width >= 2 && height >= 3;
      })
      .sort((a, b) => a.minX - b.minX);

    if (groups.length === 0) {
      return makeHudRelativeBox(
        panel,
        TRAINING_HUD_REFERENCE.levelDigitsLeft,
        TRAINING_HUD_REFERENCE.levelDigitsTop,
        TRAINING_HUD_REFERENCE.levelDigitsRight,
        TRAINING_HUD_REFERENCE.levelDigitsBottom,
      );
    }

    const minX = Math.min(...groups.map((item) => item.minX));
    const minY = Math.min(...groups.map((item) => item.minY));
    const maxX = Math.max(...groups.map((item) => item.maxX));
    const maxY = Math.max(...groups.map((item) => item.maxY));
    const digitHeight = maxY - minY + 1;

    return {
      minX: Math.max(panel.minX, minX - digitHeight * 0.18),
      minY: Math.max(panel.minY, minY - digitHeight * 0.18),
      maxX: Math.min(panel.maxX, maxX + digitHeight * 0.18),
      maxY: Math.min(panel.maxY, maxY + digitHeight * 0.18),
    };
  }

  function findExpAreaInsideHud(panel: TrainingHudPixelBox) {
    return makeHudRelativeBox(
      panel,
      TRAINING_HUD_REFERENCE.expCropLeft,
      TRAINING_HUD_REFERENCE.expCropTop,
      TRAINING_HUD_REFERENCE.expCropRight,
      TRAINING_HUD_REFERENCE.expCropBottom,
    );
  }

  function captureReferenceFrame(maxWidth = 1280) {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return null;

    const scale = Math.min(1, maxWidth / video.videoWidth);
    const frame = document.createElement('canvas');
    frame.width = Math.max(1, Math.round(video.videoWidth * scale));
    frame.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = frame.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // The initial crop is derived from the exact image currently visible in
    // "螢幕擷取對照", rather than from fixed X/Y percentages.
    ctx.drawImage(video, 0, 0, frame.width, frame.height);
    captureReferenceFrameRef.current = frame;
    return frame;
  }

  function makeAnalysisFrame() {
    return captureReferenceFrame(1280);
  }

  function pixelBoxToPercentCrop(
    frame: HTMLCanvasElement,
    box: { minX: number; minY: number; maxX: number; maxY: number },
    padding: { left: number; top: number; right: number; bottom: number },
    minimum: { w: number; h: number },
  ): TrainingAdaptiveCrop {
    const x = Math.max(0, box.minX - padding.left);
    const y = Math.max(0, box.minY - padding.top);
    const right = Math.min(frame.width, box.maxX + padding.right);
    const bottom = Math.min(frame.height, box.maxY + padding.bottom);

    return {
      x: Math.round((x / frame.width) * 1000) / 10,
      y: Math.round((y / frame.height) * 1000) / 10,
      w: Math.max(minimum.w, Math.round(((right - x) / frame.width) * 1000) / 10),
      h: Math.max(minimum.h, Math.round(((bottom - y) / frame.height) * 1000) / 10),
    };
  }

  function smoothAdaptiveCrop(previous: TrainingAdaptiveCrop | null, detected: TrainingAdaptiveCrop) {
    if (!previous) return detected;

    const previousCenterX = previous.x + previous.w / 2;
    const previousCenterY = previous.y + previous.h / 2;
    const detectedCenterX = detected.x + detected.w / 2;
    const detectedCenterY = detected.y + detected.h / 2;
    const centerDistance = Math.hypot(detectedCenterX - previousCenterX, detectedCenterY - previousCenterY);
    const sizeRatio = Math.max(
      detected.w / Math.max(0.1, previous.w),
      previous.w / Math.max(0.1, detected.w),
      detected.h / Math.max(0.1, previous.h),
      previous.h / Math.max(0.1, detected.h),
    );

    // Large movement usually means the game window changed position/scale.
    if (centerDistance > 8 || sizeRatio > 1.8) return detected;

    const weight = 0.45;
    return {
      x: Math.round((previous.x * (1 - weight) + detected.x * weight) * 10) / 10,
      y: Math.round((previous.y * (1 - weight) + detected.y * weight) * 10) / 10,
      w: Math.round((previous.w * (1 - weight) + detected.w * weight) * 10) / 10,
      h: Math.round((previous.h * (1 - weight) + detected.h * weight) * 10) / 10,
    };
  }

  function percentCropToPixelBox(
    frame: HTMLCanvasElement,
    crop: TrainingAdaptiveCrop,
  ): TrainingHudPixelBox {
    return {
      minX: (crop.x / 100) * frame.width,
      minY: (crop.y / 100) * frame.height,
      maxX: ((crop.x + crop.w) / 100) * frame.width,
      maxY: ((crop.y + crop.h) / 100) * frame.height,
    };
  }

  function detectAdaptiveCrops(options: { silent?: boolean; initial?: boolean; frame?: HTMLCanvasElement | null } = {}) {
    const frame = options.frame || makeAnalysisFrame();
    if (!frame) {
      if (!options.silent) setOcrMessage('尚未取得螢幕擷取對照畫面。');
      return {
        hudFound: false,
        hudPanelCrop: hudPanelCropRef.current,
        expCrop: ocrCropRef.current,
        levelCrop: levelCropRef.current,
        expFound: false,
        levelFound: false,
      };
    }

    // Stage 1: recognize the complete LV / HP / MP / EXP status HUD.
    let hudPanel: TrainingHudPixelBox | null = findTrainingHudPanel(frame);
    let usedPreviousHud = false;

    if (!hudPanel) {
      hudDetectionMissRef.current += 1;

      // After one valid detection, tolerate a few transient misses caused by
      // fullscreen animation, taskbar transition or a partially painted frame.
      if (
        !options.initial &&
        hudPanelCropRef.current &&
        hudDetectionMissRef.current <= 3
      ) {
        hudPanel = percentCropToPixelBox(frame, hudPanelCropRef.current);
        usedPreviousHud = true;
      } else {
        if (!options.silent) {
          setOcrMessage(
            '目前畫面尚未確認完整狀態列，正在重新掃描 HP / MP / EXP 色條。',
          );
          setCropDetectionSource('重新掃描完整狀態列');
        }
        return {
          hudFound: false,
          hudPanelCrop: hudPanelCropRef.current,
          expCrop: ocrCropRef.current,
          levelCrop: levelCropRef.current,
          expFound: false,
          levelFound: false,
        };
      }
    } else {
      hudDetectionMissRef.current = 0;
    }

    const detectedHudCrop = pixelBoxToPercentCrop(
      frame,
      hudPanel,
      { left: 0, top: 0, right: 0, bottom: 0 },
      { w: 8, h: 1 },
    );
    const nextHudCrop = options.initial
      ? detectedHudCrop
      : smoothAdaptiveCrop(hudPanelCropRef.current, detectedHudCrop);

    hudPanelCropRef.current = nextHudCrop;
    setHudPanelCrop(nextHudCrop);

    // Stage 2: after the whole HUD is found, derive the two OCR areas inside it.
    const levelBox = findLevelDigitsInsideHud(frame, hudPanel);
    const expBox = findExpAreaInsideHud(hudPanel);

    const detectedLevel = pixelBoxToPercentCrop(
      frame,
      levelBox,
      { left: 1, top: 1, right: 1, bottom: 1 },
      { w: 1, h: 1 },
    );
    const detectedExp = pixelBoxToPercentCrop(
      frame,
      expBox,
      { left: 1, top: 1, right: 1, bottom: 1 },
      { w: 4, h: 2 },
    );

    const nextLevelCrop = options.initial
      ? detectedLevel
      : smoothAdaptiveCrop(levelCropRef.current, detectedLevel);
    const nextExpCrop = options.initial
      ? detectedExp
      : smoothAdaptiveCrop(ocrCropRef.current, detectedExp);

    levelCropRef.current = nextLevelCrop;
    ocrCropRef.current = nextExpCrop;
    setLevelCrop(nextLevelCrop);
    setOcrCrop(nextExpCrop);
    drawLevelCropPreview(nextLevelCrop);
    drawOcrCropPreview(nextExpCrop);

    if (!options.silent) {
      setOcrMessage(
        usedPreviousHud
          ? '狀態列短暫未重新命中，暫用上一個有效狀態列位置並繼續掃描。'
          : `${options.initial ? '初始截圖辨識' : '自適應追蹤'}：已找到完整 LV / HP / MP / EXP 狀態列，再由狀態列內定位等級與 EXP OCR 區域。`,
      );
      setCropDetectionSource(
        usedPreviousHud
          ? '上一個有效狀態列（短暫備援）'
          : options.initial
            ? '螢幕擷取對照快照 → 完整狀態列 → 等級 / EXP'
            : '即時畫面 → 完整狀態列 → 等級 / EXP',
      );
    }

    return {
      hudFound: true,
      hudPanelCrop: nextHudCrop,
      expCrop: nextExpCrop,
      levelCrop: nextLevelCrop,
      expFound: true,
      levelFound: true,
    };
  }

  async function autoDetectOcrCrop() {
    const liveFrame = await captureLiveTrackFrame(2560);
    const frame = liveFrame ? makeScaledFrame(liveFrame, 1280) : captureReferenceFrame(1280);
    const result = detectAdaptiveCrops({ silent: false, initial: true, frame });
    initialCropDetectionRef.current = result.expFound || result.levelFound;
    return initialCropDetectionRef.current;
  }

  function getVideoDisplayGeometry() {
    const video = videoRef.current;
    const wrapper = videoWrapRef.current;
    if (!video || !wrapper || !video.videoWidth || !video.videoHeight) return null;

    const rect = wrapper.getBoundingClientRect();
    const videoRatio = video.videoWidth / video.videoHeight;
    const boxRatio = rect.width / rect.height;

    let displayWidth = rect.width;
    let displayHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (boxRatio > videoRatio) {
      displayHeight = rect.height;
      displayWidth = displayHeight * videoRatio;
      offsetX = (rect.width - displayWidth) / 2;
    } else {
      displayWidth = rect.width;
      displayHeight = displayWidth / videoRatio;
      offsetY = (rect.height - displayHeight) / 2;
    }

    return { rect, displayWidth, displayHeight, offsetX, offsetY };
  }

  function pointerToVideoPercent(clientX: number, clientY: number) {
    const geo = getVideoDisplayGeometry();
    if (!geo) return null;
    const x = ((clientX - geo.rect.left - geo.offsetX) / geo.displayWidth) * 100;
    const y = ((clientY - geo.rect.top - geo.offsetY) / geo.displayHeight) * 100;
    return {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
    };
  }

  function cropToOverlayBox(crop: TrainingAdaptiveCrop | null = ocrCropRef.current) {
    if (!crop) return null;
    const geo = getVideoDisplayGeometry();
    if (!geo) return null;

    return {
      x: geo.offsetX + (crop.x / 100) * geo.displayWidth,
      y: geo.offsetY + (crop.y / 100) * geo.displayHeight,
      w: (crop.w / 100) * geo.displayWidth,
      h: (crop.h / 100) * geo.displayHeight,
    };
  }

  function onVideoPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!manualSelectMode) return;
    const point = pointerToVideoPercent(event.clientX, event.clientY);
    if (!point) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragStart(point);
    setDragBox({ x: point.x, y: point.y, w: 0, h: 0 });
  }

  function onVideoPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!manualSelectMode || !dragStart) return;
    const point = pointerToVideoPercent(event.clientX, event.clientY);
    if (!point) return;

    const x = Math.min(dragStart.x, point.x);
    const y = Math.min(dragStart.y, point.y);
    const w = Math.abs(point.x - dragStart.x);
    const h = Math.abs(point.y - dragStart.y);
    setDragBox({ x, y, w, h });
  }

  function onVideoPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!manualSelectMode || !dragBox) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragStart(null);

    if (dragBox.w < 0.5 || dragBox.h < 0.5) {
      setDragBox(null);
      setOcrMessage('框選區域太小，請重新框選 EXP 數值與綠色經驗條。');
      return;
    }

    const next = {
      x: Math.round(dragBox.x * 10) / 10,
      y: Math.round(dragBox.y * 10) / 10,
      w: Math.round(dragBox.w * 10) / 10,
      h: Math.round(dragBox.h * 10) / 10,
    };

    setOcrCrop(next);
    setDragBox(null);
    setManualSelectMode(false);
    drawOcrCropPreview(next);
    setOcrMessage(`已套用手動框選區域：X ${next.x} / Y ${next.y} / 寬 ${next.w} / 高 ${next.h}。按「儲存為預設裁切區」後會固定保存。`);
  }

  function saveCropAsDefault() {
    localStorage.setItem(TRAINING_OCR_CROP_STORAGE_KEY, JSON.stringify(ocrCropRef.current));
    if (levelCropRef.current) {
      localStorage.setItem(TRAINING_LEVEL_CROP_STORAGE_KEY, JSON.stringify(levelCropRef.current));
    }
    setOcrMessage('已儲存目前 EXP 與等級裁切區。自適應定位仍會依畫面位置與縮放持續微調。');
  }

  function resetSavedCrop() {
    localStorage.removeItem(TRAINING_OCR_CROP_STORAGE_KEY);
    localStorage.removeItem(TRAINING_LEVEL_CROP_STORAGE_KEY);
    ocrCropRef.current = DEFAULT_OCR_CROP;
    levelCropRef.current = null;
    setOcrCrop(DEFAULT_OCR_CROP);
    setLevelCrop(null);
    setOcrMessage('已清除保存的 EXP 與等級裁切區；下次辨識會重新自適應定位。');
  }

  function scaleCanvasNearest(
    sourceCanvas: HTMLCanvasElement,
    scale: number,
    padding = 8,
    background = '#fff',
  ) {
    const scaled = document.createElement('canvas');
    scaled.width = sourceCanvas.width * scale + padding * 2;
    scaled.height = sourceCanvas.height * scale + padding * 2;
    const ctx = scaled.getContext('2d');
    if (!ctx) return sourceCanvas;

    ctx.fillStyle = background;
    ctx.fillRect(0, 0, scaled.width, scaled.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      sourceCanvas,
      padding,
      padding,
      sourceCanvas.width * scale,
      sourceCanvas.height * scale,
    );
    return scaled;
  }

  function buildExpBinaryVariant(
    sourceCanvas: HTMLCanvasElement,
    threshold: number,
  ) {
    const binary = document.createElement('canvas');
    binary.width = sourceCanvas.width;
    binary.height = sourceCanvas.height;
    const ctx = binary.getContext('2d', { willReadFrequently: true });
    if (!ctx) return sourceCanvas;

    ctx.drawImage(sourceCanvas, 0, 0);
    const image = ctx.getImageData(0, 0, binary.width, binary.height);
    const data = image.data;

    for (let index = 0; index < data.length; index += 4) {
      const gray =
        data[index] * 0.299 +
        data[index + 1] * 0.587 +
        data[index + 2] * 0.114;
      const value = gray >= threshold ? 0 : 255;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }

    ctx.putImageData(image, 0, 0);
    return scaleCanvasNearest(binary, 6, 12, '#fff');
  }

  function buildExpWhiteTextVariant(sourceCanvas: HTMLCanvasElement) {
    const binary = document.createElement('canvas');
    binary.width = sourceCanvas.width;
    binary.height = sourceCanvas.height;
    const ctx = binary.getContext('2d', { willReadFrequently: true });
    if (!ctx) return sourceCanvas;

    ctx.drawImage(sourceCanvas, 0, 0);
    const image = ctx.getImageData(0, 0, binary.width, binary.height);
    const data = image.data;

    for (let index = 0; index < data.length; index += 4) {
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const brightness = (r + g + b) / 3;
      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      const textPixel =
        brightness >= 145 &&
        spread <= 105 &&
        r >= 135 &&
        g >= 135 &&
        b >= 130;
      const value = textPixel ? 0 : 255;
      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }

    ctx.putImageData(image, 0, 0);
    return scaleCanvasNearest(binary, 8, 14, '#fff');
  }

  function buildExpOcrVariants(sourceCanvas: HTMLCanvasElement) {
    return [
      { name: '二值化140', canvas: buildExpBinaryVariant(sourceCanvas, 140) },
      { name: '白字抽取', canvas: buildExpWhiteTextVariant(sourceCanvas) },
      { name: '原圖放大', canvas: scaleCanvasNearest(sourceCanvas, 6, 12, '#111827') },
      { name: '二值化165', canvas: buildExpBinaryVariant(sourceCanvas, 165) },
    ];
  }

  function normalizeExpOcrText(rawText: string) {
    return String(rawText || '')
      .replace(/[Oo]/g, '0')
      .replace(/[Il|]/g, '1')
      .replace(/[Ss]/g, '5')
      .replace(/[Bb]/g, '8')
      .replace(/\s+/g, '');
  }

  function parseExpOcrText(rawText: string) {
    const normalized = normalizeExpOcrText(rawText);
    const beforePercent = normalized.split('%')[0] || normalized;
    const beforeBracket =
      beforePercent.split('[')[0]?.split('(')[0] || beforePercent;

    const labelled = beforeBracket.match(
      /(?:EXP|EP|XP|E)?[:：]?([0-9][0-9,]{0,14})/i,
    );
    if (labelled?.[1]) {
      const value = Number(labelled[1].replace(/,/g, ''));
      if (Number.isFinite(value) && value >= 0) return value;
    }

    const sequences =
      beforeBracket
        .match(/[0-9][0-9,]*/g)
        ?.map((value) => value.replace(/,/g, ''))
        .filter((value) => value.length > 0) || [];

    if (sequences.length === 0) return null;

    const best = [...sequences].sort((a, b) => b.length - a.length)[0];
    const value = Number(best);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  async function recognizeExpWithVariants(
    worker: any,
    variants: Array<{ name: string; canvas: HTMLCanvasElement }>,
    lastKnownExp: number | null,
  ) {
    const results: Array<{
      name: string;
      rawText: string;
      value: number | null;
      confidence: number;
    }> = [];

    const recognizeVariant = async (variantIndex: number) => {
      const variant = variants[variantIndex];
      const result = await recognizeWithTrainingWorker(
        worker,
        variant.canvas,
        {
          tessedit_char_whitelist:
            'EXPexp:0123456789,.%[]() ',
          tessedit_pageseg_mode: '7',
          preserve_interword_spaces: '1',
        },
      );
      const rawText = String(result?.data?.text || '').trim();
      const value = parseExpOcrText(rawText);
      const confidence = Number(result?.data?.confidence || 0);
      const parsed = {
        name: variant.name,
        rawText,
        value,
        confidence,
      };
      results.push(parsed);
      return parsed;
    };

    const preferredIndex =
      preferredExpVariantRef.current % variants.length;
    const primary = await recognizeVariant(preferredIndex);

    // Normal path: one OCR pass. Reuse the last successful image treatment.
    if (
      primary.value !== null &&
      lastKnownExp !== null &&
      primary.value >= lastKnownExp
    ) {
      preferredExpVariantRef.current = preferredIndex;
      return {
        value: primary.value,
        rawText: primary.rawText,
        source: primary.name,
        confidence: primary.confidence,
        agreement: 1,
        successfulCount: 1,
        conflicting: false,
        attempts: results,
      };
    }

    // Initial value, lower value, or primary failure needs a second treatment
    // before it can affect a baseline.
    const remainingIndexes = variants
      .map((_, index) => index)
      .filter((index) => index !== preferredIndex);

    for (const index of remainingIndexes) {
      const candidate = await recognizeVariant(index);

      if (
        primary.value !== null &&
        candidate.value !== null
      ) {
        const tolerance = Math.max(
          5000,
          Math.max(primary.value, candidate.value) * 0.0002,
        );
        if (
          Math.abs(primary.value - candidate.value) <= tolerance
        ) {
          preferredExpVariantRef.current =
            primary.confidence >= candidate.confidence
              ? preferredIndex
              : index;
          return {
            value: Math.round(
              (primary.value + candidate.value) / 2,
            ),
            rawText:
              primary.confidence >= candidate.confidence
                ? primary.rawText
                : candidate.rawText,
            source: `快速雙流程一致 2/${results.length}`,
            confidence:
              (primary.confidence + candidate.confidence) / 2,
            agreement: 2,
            successfulCount: results.filter(
              (item) => item.value !== null,
            ).length,
            conflicting: false,
            attempts: results,
          };
        }
      }

      if (primary.value === null && candidate.value !== null) {
        preferredExpVariantRef.current = index;

        // A normal increase can use the successful fallback immediately.
        if (
          lastKnownExp !== null &&
          candidate.value >= lastKnownExp
        ) {
          return {
            value: candidate.value,
            rawText: candidate.rawText,
            source: candidate.name,
            confidence: candidate.confidence,
            agreement: 1,
            successfulCount: 1,
            conflicting: false,
            attempts: results,
          };
        }
      }

      // Two attempts are enough for the frequent path. Only continue when both
      // produced conflicting numeric values and a deciding vote is required.
      const numericResults = results.filter(
        (item): item is typeof item & { value: number } =>
          item.value !== null,
      );
      if (results.length >= 2 && numericResults.length < 2) {
        continue;
      }
      if (numericResults.length >= 2) break;
    }

    const successful = results.filter(
      (item): item is typeof item & { value: number } =>
        item.value !== null,
    );

    if (successful.length === 0) {
      return {
        value: null,
        rawText: results
          .map((item) => `${item.name}:${item.rawText || '空白'}`)
          .join('｜'),
        source: '快速流程失敗',
        confidence: 0,
        agreement: 0,
        successfulCount: 0,
        conflicting: false,
        attempts: results,
      };
    }

    const clusters: Array<{
      values: typeof successful;
      center: number;
    }> = [];

    for (const item of successful) {
      const matched = clusters.find((cluster) => {
        const tolerance = Math.max(
          5000,
          Math.max(cluster.center, item.value) * 0.0002,
        );
        return Math.abs(cluster.center - item.value) <= tolerance;
      });

      if (matched) {
        matched.values.push(item);
        matched.center =
          matched.values.reduce(
            (sum, value) => sum + value.value,
            0,
          ) / matched.values.length;
      } else {
        clusters.push({
          values: [item],
          center: item.value,
        });
      }
    }

    clusters.sort((a, b) => {
      if (b.values.length !== a.values.length) {
        return b.values.length - a.values.length;
      }
      return (
        b.values.reduce(
          (sum, value) => sum + value.confidence,
          0,
        ) -
        a.values.reduce(
          (sum, value) => sum + value.confidence,
          0,
        )
      );
    });

    const best = clusters[0];
    const representative = [...best.values].sort(
      (a, b) => b.confidence - a.confidence,
    )[0];

    return {
      value: Math.round(best.center),
      rawText: representative.rawText,
      source:
        best.values.length >= 2
          ? `快速多數一致 ${best.values.length}/${successful.length}`
          : representative.name,
      confidence:
        best.values.reduce(
          (sum, item) => sum + item.confidence,
          0,
        ) / best.values.length,
      agreement: best.values.length,
      successfulCount: successful.length,
      conflicting: clusters.length > 1,
      attempts: results,
    };
  }

  function drawOcrCropPreview(nextCrop: TrainingAdaptiveCrop = ocrCropRef.current) {
    const video = videoRef.current;
    const preview = previewCanvasRef.current;
    if (!video || !preview || !video.videoWidth || !video.videoHeight) return null;

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const sx = Math.max(0, Math.floor((nextCrop.x / 100) * sourceWidth));
    const sy = Math.max(0, Math.floor((nextCrop.y / 100) * sourceHeight));
    const sw = Math.max(10, Math.min(sourceWidth - sx, Math.floor((nextCrop.w / 100) * sourceWidth)));
    const sh = Math.max(10, Math.min(sourceHeight - sy, Math.floor((nextCrop.h / 100) * sourceHeight)));

    preview.width = sw;
    preview.height = sh;
    const pctx = preview.getContext('2d');
    if (!pctx) return null;
    pctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

    return { sx, sy, sw, sh };
  }

  function drawLevelCropPreview(nextCrop: TrainingAdaptiveCrop | null = levelCropRef.current) {
    const video = videoRef.current;
    const preview = levelPreviewCanvasRef.current;
    if (!preview) return null;

    if (!video || !nextCrop || !video.videoWidth || !video.videoHeight) {
      const clearCtx = preview.getContext('2d');
      if (clearCtx) clearCtx.clearRect(0, 0, preview.width, preview.height);
      return null;
    }

    const sourceWidth = video.videoWidth;
    const sourceHeight = video.videoHeight;
    const sx = Math.max(0, Math.floor((nextCrop.x / 100) * sourceWidth));
    const sy = Math.max(0, Math.floor((nextCrop.y / 100) * sourceHeight));
    const sw = Math.max(8, Math.min(sourceWidth - sx, Math.floor((nextCrop.w / 100) * sourceWidth)));
    const sh = Math.max(8, Math.min(sourceHeight - sy, Math.floor((nextCrop.h / 100) * sourceHeight)));

    preview.width = sw;
    preview.height = sh;
    const pctx = preview.getContext('2d');
    if (!pctx) return null;
    pctx.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);

    return { sx, sy, sw, sh };
  }

  function isLevelDigitLightPixel(r: number, g: number, b: number) {
    const brightness = (r + g + b) / 3;
    const channelSpread = Math.max(r, g, b) - Math.min(r, g, b);
    return brightness >= 165 && channelSpread <= 105 && r >= 150 && g >= 150 && b >= 145;
  }

  function preprocessLevelCrop(sourceCanvas: HTMLCanvasElement) {
    const scale = 10;
    const padding = 18;
    const binary = document.createElement('canvas');
    binary.width = sourceCanvas.width;
    binary.height = sourceCanvas.height;
    const binaryCtx = binary.getContext('2d', { willReadFrequently: true });
    if (!binaryCtx) return sourceCanvas;

    binaryCtx.drawImage(sourceCanvas, 0, 0);
    const sourceImage = binaryCtx.getImageData(0, 0, binary.width, binary.height);
    const sourceData = sourceImage.data;

    // The number glyph is white/grey inside an orange tile. Make the glyph
    // black and everything else white, instead of OCRing the orange tile shape.
    for (let index = 0; index < sourceData.length; index += 4) {
      const digitPixel = isLevelDigitLightPixel(
        sourceData[index],
        sourceData[index + 1],
        sourceData[index + 2],
      );
      const value = digitPixel ? 0 : 255;
      sourceData[index] = value;
      sourceData[index + 1] = value;
      sourceData[index + 2] = value;
      sourceData[index + 3] = 255;
    }
    binaryCtx.putImageData(sourceImage, 0, 0);

    const scaled = document.createElement('canvas');
    scaled.width = sourceCanvas.width * scale + padding * 2;
    scaled.height = sourceCanvas.height * scale + padding * 2;
    const ctx = scaled.getContext('2d', { willReadFrequently: true });
    if (!ctx) return binary;

    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, scaled.width, scaled.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      binary,
      padding,
      padding,
      sourceCanvas.width * scale,
      sourceCanvas.height * scale,
    );

    return scaled;
  }

  function mergeLevelGlyphComponents(components: HudColorComponent[]) {
    const sorted = [...components].sort((a, b) => a.minX - b.minX || a.minY - b.minY);
    const merged: HudColorComponent[] = [];

    for (const component of sorted) {
      const width = component.maxX - component.minX + 1;
      const height = component.maxY - component.minY + 1;
      if (width < 1 || height < 3) continue;

      const previous = merged[merged.length - 1];
      if (previous) {
        const previousHeight = previous.maxY - previous.minY + 1;
        const verticalOverlap =
          Math.min(previous.maxY, component.maxY) -
          Math.max(previous.minY, component.minY) +
          1;
        const overlapRatio =
          verticalOverlap / Math.max(1, Math.min(previousHeight, height));
        const gap = component.minX - previous.maxX - 1;

        // Merge only fragments from the same glyph. The actual digit tiles have
        // a much larger gap than this threshold.
        if (
          overlapRatio >= 0.45 &&
          gap >= -1 &&
          gap <= Math.max(1, Math.round(Math.min(previousHeight, height) * 0.16))
        ) {
          previous.minX = Math.min(previous.minX, component.minX);
          previous.minY = Math.min(previous.minY, component.minY);
          previous.maxX = Math.max(previous.maxX, component.maxX);
          previous.maxY = Math.max(previous.maxY, component.maxY);
          previous.count += component.count;
          continue;
        }
      }

      merged.push({ ...component });
    }

    return merged;
  }

  function sampleLevelGlyphRegion(
    mask: Uint8Array,
    width: number,
    height: number,
    xStart: number,
    xEnd: number,
    yStart: number,
    yEnd: number,
  ) {
    const left = Math.max(0, Math.min(width - 1, Math.round(xStart * (width - 1))));
    const right = Math.max(left, Math.min(width - 1, Math.round(xEnd * (width - 1))));
    const top = Math.max(0, Math.min(height - 1, Math.round(yStart * (height - 1))));
    const bottom = Math.max(top, Math.min(height - 1, Math.round(yEnd * (height - 1))));

    let on = 0;
    let total = 0;
    for (let y = top; y <= bottom; y += 1) {
      for (let x = left; x <= right; x += 1) {
        on += mask[y * width + x];
        total += 1;
      }
    }
    return total > 0 ? on / total : 0;
  }

  function classifyLevelSevenSegmentDigit(
    sourceCanvas: HTMLCanvasElement,
    component: HudColorComponent,
  ) {
    const ctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const x = Math.max(0, Math.floor(component.minX));
    const y = Math.max(0, Math.floor(component.minY));
    const width = Math.max(1, Math.min(sourceCanvas.width - x, Math.ceil(component.maxX - component.minX + 1)));
    const height = Math.max(1, Math.min(sourceCanvas.height - y, Math.ceil(component.maxY - component.minY + 1)));
    const image = ctx.getImageData(x, y, width, height);
    const data = image.data;
    const mask = new Uint8Array(width * height);

    for (let index = 0; index < width * height; index += 1) {
      const pixelIndex = index * 4;
      mask[index] = isLevelDigitLightPixel(
        data[pixelIndex],
        data[pixelIndex + 1],
        data[pixelIndex + 2],
      )
        ? 1
        : 0;
    }

    const aspect = width / Math.max(1, height);
    // The pixel-font "1" is intentionally much narrower than every other digit.
    if (aspect <= 0.58) {
      return { digit: 1, error: 0, confidence: 1, segments: [0, 1, 1, 0, 0, 0, 0] };
    }

    // Sample the seven-segment centers, intentionally avoiding the rounded /
    // anti-aliased corners visible in the Maple-style pixel font.
    const segments = [
      sampleLevelGlyphRegion(mask, width, height, 0.2, 0.8, 0.0, 0.1),   // top
      sampleLevelGlyphRegion(mask, width, height, 0.86, 1.0, 0.31, 0.36), // upper-right
      sampleLevelGlyphRegion(mask, width, height, 0.86, 1.0, 0.64, 0.7),  // lower-right
      sampleLevelGlyphRegion(mask, width, height, 0.2, 0.8, 0.9, 1.0),    // bottom
      sampleLevelGlyphRegion(mask, width, height, 0.0, 0.14, 0.64, 0.7),  // lower-left
      sampleLevelGlyphRegion(mask, width, height, 0.0, 0.14, 0.31, 0.36), // upper-left
      sampleLevelGlyphRegion(mask, width, height, 0.2, 0.8, 0.45, 0.53),  // middle
    ];

    const patterns: Record<number, number[]> = {
      0: [1, 1, 1, 1, 1, 1, 0],
      1: [0, 1, 1, 0, 0, 0, 0],
      2: [1, 1, 0, 1, 1, 0, 1],
      3: [1, 1, 1, 1, 0, 0, 1],
      4: [0, 1, 1, 0, 0, 1, 1],
      5: [1, 0, 1, 1, 0, 1, 1],
      6: [1, 0, 1, 1, 1, 1, 1],
      7: [1, 1, 1, 0, 0, 0, 0],
      8: [1, 1, 1, 1, 1, 1, 1],
      9: [1, 1, 1, 1, 0, 1, 1],
    };

    const ranked = Object.entries(patterns)
      .map(([digit, pattern]) => ({
        digit: Number(digit),
        error: segments.reduce((sum, value, index) => {
          const difference = value - pattern[index];
          return sum + difference * difference;
        }, 0),
      }))
      .sort((a, b) => a.error - b.error);

    const best = ranked[0];
    const second = ranked[1];
    const confidence = Math.max(0, Math.min(1, (second.error - best.error + 0.15) / 1.15));

    return {
      digit: best.digit,
      error: best.error,
      confidence,
      segments,
    };
  }

  function recognizeLevelByPixelSegments(sourceCanvas: HTMLCanvasElement) {
    const components = findColorComponents(
      sourceCanvas,
      { x: 0, y: 0, w: sourceCanvas.width, h: sourceCanvas.height },
      isLevelDigitLightPixel,
      2,
    );

    const minimumHeight = Math.max(3, sourceCanvas.height * 0.28);
    const glyphs = mergeLevelGlyphComponents(
      components.filter((component) => {
        const width = component.maxX - component.minX + 1;
        const height = component.maxY - component.minY + 1;
        return (
          height >= minimumHeight &&
          width >= 1 &&
          width <= sourceCanvas.width * 0.55 &&
          component.count >= Math.max(3, height * 0.8)
        );
      }),
    )
      .sort((a, b) => a.minX - b.minX)
      .slice(-3);

    if (glyphs.length < 1 || glyphs.length > 3) return null;

    const recognized = glyphs.map((glyph) =>
      classifyLevelSevenSegmentDigit(sourceCanvas, glyph),
    );
    if (recognized.some((item) => !item)) return null;

    const results = recognized.filter(Boolean) as Array<{
      digit: number;
      error: number;
      confidence: number;
      segments: number[];
    }>;
    const text = results.map((item) => item.digit).join('');
    const value = Number(text);
    const averageConfidence =
      results.reduce((sum, item) => sum + item.confidence, 0) /
      Math.max(1, results.length);

    if (
      !Number.isInteger(value) ||
      value < 1 ||
      value > 200 ||
      averageConfidence < 0.18
    ) {
      return null;
    }

    return {
      value,
      text,
      confidence: averageConfidence,
      digits: results,
    };
  }

  function parseDetectedLevel(rawText: string) {
    const normalized = rawText
      .replace(/[Oo]/g, '0')
      .replace(/[Il|]/g, '1');
    const values = normalized
      .match(/[0-9]{1,3}/g)
      ?.map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 1 && value <= 200) || [];
    return values.length > 0 ? values[values.length - 1] : null;
  }

  function applyDetectedLevel(level: number) {
    const current = Math.max(
      0,
      Math.min(200, Number(currentLevelInput) || 0),
    );

    if (current === 0) {
      setCurrentLevelInput(String(level));
      levelCandidateRef.current = { value: level, count: 1 };
      setLevelOcrMessage(`等級初始辨識：Lv.${level}`);
      setLevelOcrSuccessCount((prev) => prev + 1);
      return true;
    }

    if (level === current) {
      levelCandidateRef.current = { value: level, count: 1 };
      setLevelOcrMessage(`等級自動辨識成功：Lv.${level}`);
      setLevelOcrSuccessCount((prev) => prev + 1);
      return true;
    }

    const previous = levelCandidateRef.current;
    const nextCount =
      previous?.value === level ? previous.count + 1 : 1;
    levelCandidateRef.current = { value: level, count: nextCount };

    const requiredCount = level === current + 1 ? 2 : 3;
    if (nextCount >= requiredCount) {
      setCurrentLevelInput(String(level));
      setLevelOcrMessage(
        `等級連續辨識確認：Lv.${level}（${requiredCount}/${requiredCount}）`,
      );
      setLevelOcrSuccessCount((prev) => prev + 1);
      return true;
    }

    setLevelOcrMessage(
      `等級候選 Lv.${level}，等待確認（${nextCount}/${requiredCount}）。`,
    );
    return false;
  }

  async function runOcrOnce() {
    if (ocrBusyRef.current) return;
    ocrBusyRef.current = true;
    const ocrCycleStartedAt = performance.now();

    try {
      const liveFrame = await captureLiveTrackFrame(2560);
      if (!liveFrame) {
        setOcrMessage('尚未取得可辨識的螢幕擷取影格。');
        return;
      }

      const analysisFrame = makeScaledFrame(liveFrame, 1280);
      const adaptive = detectAdaptiveCrops({
        silent: true,
        frame: analysisFrame,
      });
      if (!adaptive.hudFound) {
        setOcrMessage(
          '本次 OCR 略過：直接擷取影格中未確認完整狀態列；下一個週期會重新掃描。',
        );
        return;
      }

      const expCanvas = cropFrameByPercent(
        liveFrame,
        adaptive.expCrop,
        10,
        10,
        previewCanvasRef.current,
      );
      const levelCanvas = cropFrameByPercent(
        liveFrame,
        adaptive.levelCrop,
        8,
        8,
        levelPreviewCanvasRef.current,
      );

      if (!expCanvas || !levelCanvas) {
        setOcrMessage(
          '完整狀態列已找到，但等級或 EXP 子區域無法從直接擷取影格建立。',
        );
        return;
      }

      canvasRef.current = expCanvas;
      setOcrMessage('已取得最新擷取軌道影格，正在辨識 EXP 與等級…');

      const expVariants = buildExpOcrVariants(expCanvas);
      const pixelLevelResult = recognizeLevelByPixelSegments(levelCanvas);
      const processedLevel = !pixelLevelResult
        ? preprocessLevelCrop(levelCanvas)
        : null;
      const worker = await ensureTrainingOcrWorker();

      let expRecognition: {
        value: number | null;
        rawText: string;
        source: string;
        confidence: number;
        agreement: number;
        successfulCount: number;
        conflicting: boolean;
        attempts: Array<{
          name: string;
          rawText: string;
          value: number | null;
          confidence: number;
        }>;
      } | null = null;
      let levelResult: any = null;

      expRecognition = await recognizeExpWithVariants(
        worker,
        expVariants,
        samples[samples.length - 1]?.exp ?? null,
      );

      if (processedLevel) {
        levelResult = await recognizeWithTrainingWorker(
          worker,
          processedLevel,
          {
            tessedit_char_whitelist: '0123456789',
            tessedit_pageseg_mode: '7',
          },
        );
      }

      const rawText = expRecognition?.rawText || '';
      const exp =
        expRecognition?.value !== null &&
        expRecognition?.value !== undefined
          ? expRecognition.value
          : NaN;
      setOcrText(
        expRecognition
          ? `${expRecognition.source}｜一致 ${expRecognition.agreement}/${Math.max(1, expRecognition.successfulCount)}：${rawText || '空白'}`
          : '(無文字)',
      );

      let expDecision: TrainingExpPushResult | null = null;
      if (!Number.isFinite(exp)) {
        if (samples.length === 0) {
          initialExpCandidateRef.current = null;
        }
        setOcrFailCount((prev) => prev + 1);
        appendTrainingOcrHistory({
          source: 'ocr',
          status: 'failed',
          exp: null,
          rawText,
          message: `EXP 未辨識${rawText ? `：${rawText}` : '：空白'}`,
        });
      } else {
        expDecision = pushSample(
          exp,
          'ocr',
          expRecognition?.agreement || 0,
        );
        appendTrainingOcrHistory({
          source: 'ocr',
          status: expDecision.status,
          exp,
          rawText,
          message: expDecision.message,
        });
        if (expDecision.accepted) {
          setOcrSuccessCount((prev) => prev + 1);
        } else if (expDecision.status === 'rejected') {
          setOcrFailCount((prev) => prev + 1);
        }
      }

      const tesseractLevelText = String(
        levelResult?.data?.text || '',
      ).trim();
      const rawLevelText = pixelLevelResult
        ? pixelLevelResult.text
        : tesseractLevelText;
      const levelSource = pixelLevelResult
        ? '像素七段辨識'
        : 'Tesseract';
      setLevelOcrText(
        rawLevelText
          ? `${levelSource}：${rawLevelText}`
          : '(無文字)',
      );
      const detectedLevel =
        pixelLevelResult?.value ??
        (processedLevel
          ? parseDetectedLevel(tesseractLevelText)
          : null);
      const levelAccepted = detectedLevel
        ? applyDetectedLevel(detectedLevel)
        : false;

      const expStatus = Number.isFinite(exp)
        ? `${expDecision?.message || `EXP ${formatTrainingNumber(exp)}`}（${expRecognition?.source || 'OCR'}）`
        : `EXP 未辨識${rawText ? `（${rawText}）` : ''}`;
      const levelStatus = detectedLevel
        ? levelAccepted
          ? `Lv.${detectedLevel}`
          : `Lv.${detectedLevel} 待確認`
        : adaptive.levelCrop
          ? '等級未辨識'
          : '尚未定位等級區域';

      setOcrMessage(
        `OCR：${expStatus}；${levelStatus}。影格來源：${captureFrameSource === 'image-capture' ? '擷取軌道' : '影片備援'}。`,
      );
      if (!detectedLevel) {
        setLevelOcrMessage(
          `等級辨識失敗：像素七段辨識與 Tesseract 都沒有取得 1～200 的數字${tesseractLevelText ? `（${tesseractLevelText}）` : ''}`,
        );
      } else if (pixelLevelResult) {
        setLevelOcrMessage(
          `等級像素辨識：Lv.${detectedLevel}｜信心 ${Math.round(pixelLevelResult.confidence * 100)}%`,
        );
      }
    } catch (err) {
      setOcrFailCount((prev) => prev + 1);
      setOcrMessage(
        err instanceof Error
          ? `OCR 失敗：${err.message}`
          : 'OCR 失敗',
      );
    } finally {
      setOcrDurationMs(
        Math.max(
          0,
          Math.round(performance.now() - ocrCycleStartedAt),
        ),
      );
      ocrBusyRef.current = false;
    }
  }

  runOcrOnceRef.current = runOcrOnce;

  async function detectInitialHudWithRetries() {
    hudPanelCropRef.current = null;
    hudDetectionMissRef.current = 0;
    setHudPanelCrop(null);

    const attempts = 10;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      await waitForCapturePaint();
      const liveFrame = await captureLiveTrackFrame(2560);
      const frame = liveFrame
        ? makeScaledFrame(liveFrame, 1280)
        : captureReferenceFrame(1280);
      const detection = detectAdaptiveCrops({
        silent: attempt < attempts,
        initial: true,
        frame,
      });

      if (detection.hudFound) {
        setOcrMessage(
          `初始狀態列辨識成功（第 ${attempt} 次掃描），準備開始 OCR。`,
        );
        return detection;
      }

      setOcrMessage(
        `正在掃描完整狀態列… ${attempt}/${attempts}（允許最大化／全螢幕切換完成）`,
      );
      await new Promise<void>((resolve) =>
        window.setTimeout(resolve, 220),
      );
    }

    return null;
  }

  async function startAnalysis() {
    const ok = await startCapture();
    if (!ok) return;

    const startedAt = Date.now();
    if (samples.length === 0) {
      initialExpCandidateRef.current = null;
    }
    setRunning(true);
    setPaused(false);
    setOcrActive(true);
    setAccumulatedActiveMs(0);
    setCurrentRunStartedAt(startedAt);
    setAnalysisStartedAt(startedAt);
    setOcrMessage('正在準備畫面並自動抓取 OCR 裁切區…');

    const ready = await waitForVideoReady();
    if (!ready) {
      setOcrActive(false);
      setCurrentRunStartedAt(null);
      setOcrMessage('等待螢幕畫面逾時，請重新開始分析。');
      return;
    }

    initialCropDetectionRef.current = false;
    const initialDetection = await detectInitialHudWithRetries();
    initialCropDetectionRef.current = Boolean(initialDetection?.hudFound);

    if (!initialDetection?.hudFound) {
      setOcrActive(false);
      setRunning(false);
      setCurrentRunStartedAt(null);
      setOcrMessage(
        '開始分析已停止：連續 10 次仍找不到完整狀態列。請讓狀態列完整顯示在擷取畫面內，再重新開始。',
      );
      return;
    }

    setOcrMessage('狀態列定位完成，正在載入快速 OCR 引擎…');
    try {
      await ensureTrainingOcrWorker();
    } catch (error) {
      setOcrActive(false);
      setRunning(false);
      setCurrentRunStartedAt(null);
      setOcrMessage(
        error instanceof Error
          ? `OCR 引擎載入失敗：${error.message}`
          : 'OCR 引擎載入失敗。',
      );
      return;
    }

    startOcrScheduler(ocrIntervalSec);
  }

  function pauseAnalysis() {
    stopOcrScheduler();
    const pausedAt = Date.now();
    if (currentRunStartedAt) {
      setAccumulatedActiveMs((prev) => prev + Math.max(0, pausedAt - currentRunStartedAt));
    }
    setCurrentRunStartedAt(null);
    setOcrActive(false);
    setPaused(true);
    setRunning(true);
    setOcrMessage('分析已暫停，OCR 與計時已暫停。');
  }

  function continueAnalysis() {
    setRunning(true);
    setPaused(false);
    setOcrActive(true);
    setCurrentRunStartedAt(Date.now());
    setOcrMessage('分析已繼續，OCR 與計時已恢復。');
    startOcrScheduler(ocrIntervalSec);
  }

  function togglePauseContinueAnalysis() {
    if (ocrActive) {
      pauseAnalysis();
      return;
    }
    if (paused) {
      continueAnalysis();
      return;
    }
    void startAnalysis();
  }

  function stopAnalysis() {
    stopOcrScheduler();
    const stoppedAt = Date.now();
    if (ocrActive && currentRunStartedAt) {
      setAccumulatedActiveMs((prev) => prev + Math.max(0, stoppedAt - currentRunStartedAt));
    }
    setCurrentRunStartedAt(null);
    setOcrActive(false);
    setPaused(false);
    setRunning(false);
    if (samples.length === 0) {
      initialExpCandidateRef.current = null;
    }
    setOcrMessage('分析已停止，OCR 與計時已停止。');
  }

  useEffect(() => {
    function onTrainingHotkey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target?.isContentEditable) return;
      if (!['F8', 'F9', 'F10'].includes(event.key)) return;

      event.preventDefault();
      if (event.key === 'F8') {
        void startAnalysis();
      } else if (event.key === 'F9') {
        togglePauseContinueAnalysis();
      } else if (event.key === 'F10') {
        stopAnalysis();
      }
    }

    window.addEventListener('keydown', onTrainingHotkey);
    return () => window.removeEventListener('keydown', onTrainingHotkey);
  }, [ocrActive, paused, currentRunStartedAt, ocrIntervalSec, captureActive]);

  const overlayBox = cropToOverlayBox(ocrCrop);
  const levelOverlayBox = cropToOverlayBox(levelCrop);
  const hudPanelOverlayBox = cropToOverlayBox(hudPanelCrop);
  const activeBox = dragBox ? cropToOverlayBox(dragBox) : overlayBox;

  function getTrainingStatsShareRows() {
    return [
      { title: 'EXP', value: `${formatTrainingNumber(currentExp)}[${currentPercent.toFixed(2)}%]`, sub: totalExp > 0 ? `+${formatTrainingNumber(totalExp)}${targetExp > 0 ? ` [${totalExpPercent.toFixed(2)}%]` : ''}` : '' },
      { title: 'EXP / 分', value: `⚡ ${formatTrainingNumber(expPerMinute)}`, sub: '' },
      { title: '統計時間', value: formatTrainingDuration(elapsedMinutes), sub: analysisStartedAt ? `開始 ${new Date(analysisStartedAt).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}` : '' },
      { title: 'EXP累積 (10分)', value: `${formatTrainingNumber(accumulated10)} (${elapsedMinutes < 10 ? '<10m' : '10m'})`, sub: '' },
      { title: '預估 10 分( 近10分 | 最高 )', value: `${formatTrainingNumber(predicted10)} (${formatTrainingNumber(accumulated10)} | ${formatTrainingNumber(highest10)})`, sub: '' },
      { title: '預估百分比 (1 | 10 | 60分)', value: targetExp > 0 ? `${percentPerMinute.toFixed(2)}% | ${(percentPerMinute * 10).toFixed(2)}% | ${(percentPerMinute * 60).toFixed(2)}%` : '-- | -- | --', sub: '' },
      { title: 'EXP累積 (60分)', value: `${formatTrainingNumber(accumulated60)} (${elapsedMinutes < 60 ? '<1h' : '60m'})`, sub: '' },
      { title: '預估 60 分( 近60分 | 最高 )', value: `${formatTrainingNumber(predicted60)} (${formatTrainingNumber(accumulated60)} | ${formatTrainingNumber(highest60)})`, sub: '' },
      { title: '預估升級時間', value: formatTrainingDuration(etaMinutes), sub: currentLevel > 0 ? `等級 ${Math.min(200, currentLevel + 1)}` : '' },
    ];
  }

  function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 2) {
    const chars = Array.from(text || '');
    const lines: string[] = [];
    let current = '';
    for (const ch of chars) {
      const test = current + ch;
      if (!current || ctx.measureText(test).width <= maxWidth) {
        current = test;
      } else {
        lines.push(current);
        current = ch;
      }
      if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && current) lines.push(current);
    if (lines.length > maxLines) return lines.slice(0, maxLines);
    if (chars.length > lines.join('').length && lines.length > 0) {
      const last = lines[lines.length - 1];
      lines[lines.length - 1] = `${last.slice(0, Math.max(0, last.length - 1))}…`;
    }
    return lines;
  }

  function fitCanvasFontSize(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    startSize: number,
    minSize = 14,
    weight = 900,
  ) {
    let fontSize = startSize;
    while (fontSize > minSize) {
      ctx.font = `${weight} ${fontSize}px sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) return fontSize;
      fontSize -= 1;
    }
    return minSize;
  }

  function recordTrainingStatsSnapshot() {
    const snapshot: TrainingStatsSnapshot = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now(),
      rows: getTrainingStatsShareRows().map((row) => ({
        title: row.title,
        value: row.value,
        sub: row.sub || undefined,
      })),
    };

    setTrainingStatSnapshots((prev) => {
      const next = [snapshot, ...prev].slice(0, 10);
      saveTrainingStatsSnapshots(next);
      return next;
    });
    setMessage('已紀錄當下統計資訊。');
  }

  function openTrainingStatsSnapshotViewer() {
    if (trainingStatSnapshots.length === 0) {
      setMessage('目前沒有之前的統計資訊紀錄。');
      return;
    }
    setSelectedTrainingStatSnapshotId(trainingStatSnapshots[0].id);
  }

  function removeTrainingStatsSnapshot(id: string) {
    setTrainingStatSnapshots((prev) => {
      const next = prev.filter((snapshot) => snapshot.id !== id);
      saveTrainingStatsSnapshots(next);
      setSelectedTrainingStatSnapshotId((current) => {
        if (current !== id) return current;
        return next[0]?.id || null;
      });
      return next;
    });
  }

  async function exportTrainingStatsImage(rowsOverride?: Array<{ title: string; value: string; sub?: string }>, subtitleOverride?: string) {
    if (shareBusy) return;
    setShareBusy(true);

    try {
      const rows = rowsOverride || getTrainingStatsShareRows();
      const width = 1420;
      const headerH = 126;
      const footerH = 60;
      const cols = 3;
      const gap = 24;
      const side = 32;
      const cardW = Math.floor((width - side * 2 - gap * (cols - 1)) / cols);
      const cardH = 150;
      const rowCount = Math.ceil(rows.length / cols);
      const height = headerH + rowCount * cardH + Math.max(0, rowCount - 1) * gap + footerH;

      const canvas = document.createElement('canvas');
      const ratio = Math.max(2, Math.min(3, window.devicePixelRatio || 1));
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('無法建立圖片畫布');
      ctx.scale(ratio, ratio);

      const bg = ctx.createLinearGradient(0, 0, width, height);
      bg.addColorStop(0, '#fff7ed');
      bg.addColorStop(0.55, '#ffffff');
      bg.addColorStop(1, '#fff7ed');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      const glow = ctx.createRadialGradient(width * 0.82, height * 0.18, 0, width * 0.82, height * 0.18, width * 0.4);
      glow.addColorStop(0, 'rgba(251,146,60,0.16)');
      glow.addColorStop(1, 'rgba(251,146,60,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 32px sans-serif';
      ctx.fillText('TSN 練功效率統計', side, 50);

      ctx.fillStyle = '#475569';
      ctx.font = '700 16px sans-serif';
      const subtitle = subtitleOverride || (analysisStartedAt
        ? `開始分析：${new Date(analysisStartedAt).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
        : '尚未開始分析');
      ctx.fillText(subtitle, side, 80);

      ctx.textBaseline = 'top';

      rows.forEach((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        const x = side + col * (cardW + gap);
        const y = headerH + row * (cardH + gap);

        const cardGrad = ctx.createLinearGradient(x, y, x + cardW, y + cardH);
        cardGrad.addColorStop(0, 'rgba(255,255,255,0.98)');
        cardGrad.addColorStop(1, 'rgba(255,247,237,0.95)');
        drawRoundedRect(ctx, x, y, cardW, cardH, 24);
        ctx.fillStyle = cardGrad;
        ctx.fill();

        ctx.lineWidth = 1.4;
        ctx.strokeStyle = 'rgba(251,146,60,0.24)';
        ctx.stroke();

        ctx.fillStyle = '#64748b';
        const titleSize = fitCanvasFontSize(ctx, item.title, cardW - 36, 15, 11, 800);
        ctx.font = `800 ${titleSize}px sans-serif`;
        ctx.fillText(item.title, x + 18, y + 18);

        const valueSize = fitCanvasFontSize(ctx, item.value, cardW - 36, 28, 18, 900);
        ctx.font = `900 ${valueSize}px sans-serif`;
        ctx.fillStyle = '#0f172a';
        ctx.fillText(item.value, x + 18, y + 56);

        if (item.sub) {
          const subSize = fitCanvasFontSize(ctx, item.sub, cardW - 36, 14, 11, 800);
          ctx.font = `800 ${subSize}px sans-serif`;
          ctx.fillStyle = '#ea580c';
          ctx.fillText(item.sub, x + 18, y + cardH - 36);
        }
      });

      ctx.fillStyle = 'rgba(71,85,105,0.8)';
      ctx.font = '600 14px sans-serif';
      ctx.fillText('Maple Raid Board • Training Efficiency', side, height - 24);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((output) => {
          if (output) resolve(output);
          else reject(new Error('無法產生統計圖片'));
        }, 'image/png');
      });

      const filename = `training-stats-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`;
      const shareNavigator = navigator as Navigator & {
        share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
        canShare?: (data: { files?: File[] }) => boolean;
        clipboard?: Clipboard & {
          write?: (data: ClipboardItem[]) => Promise<void>;
        };
      };

      const file = new File([blob], filename, { type: 'image/png' });

      const ClipboardItemCtor = (window as Window & { ClipboardItem?: typeof ClipboardItem }).ClipboardItem;
      if (ClipboardItemCtor && shareNavigator.clipboard?.write) {
        try {
          await shareNavigator.clipboard.write([new ClipboardItemCtor({ 'image/png': blob })]);
          setMessage('已複製統計圖片到剪貼簿，可直接貼到其他軟體對話框。');
          return;
        } catch (error) {
          console.warn('Copy training stats image to clipboard failed:', error);
        }
      }

      if (shareNavigator.share && shareNavigator.canShare?.({ files: [file] })) {
        try {
          await shareNavigator.share({
            title: 'TSN 練功效率統計',
            text: '練功效率統計圖片',
            files: [file],
          });
          setMessage('已開啟統計圖片分享視窗。');
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') {
            setMessage('已取消分享。');
            return;
          }
        }
      }

      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      setMessage('瀏覽器不支援直接複製圖片到剪貼簿，已改為下載統計圖片。');
    } catch (error) {
      setMessage(error instanceof Error ? `擷取統計圖片失敗：${error.message}` : '擷取統計圖片失敗');
    } finally {
      setShareBusy(false);
    }
  }

  return (
    <section className="w-full min-w-0 overflow-x-auto pb-2">
      <div className="grid min-w-[1080px] gap-4">
      <section className="rounded-[2rem] border border-orange-100 bg-white/85 p-5 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-slate-950">練功效率偵測</h2>
              <Pill tone={ocrActive ? 'green' : running ? 'orange' : 'slate'}>{ocrActive ? 'OCR 自動辨識中' : running ? '統計中' : '未啟動'}</Pill>
              <label htmlFor="training-debug-toggle" className="inline-flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50/80 px-3 py-1.5 text-xs font-black text-orange-700">
                <input id="training-debug-toggle" type="checkbox" checked={debugEnabled} onChange={(event) => setDebugEnabled(event.target.checked)} className="h-4 w-4 rounded border-orange-300 text-orange-500 focus:ring-orange-400" />
                Debug
              </label>
            </div>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-500">一般使用直接按「開始分析」；切換到遊戲視窗後，OCR 會直接從螢幕擷取軌道取得新影格，並由背景 Worker 排程，不依賴分析頁保持在前景。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={startAnalysis} disabled={ocrActive}>{ocrActive ? '分析中' : '開始分析(F8)'}</Button>
            <Button variant="secondary" onClick={togglePauseContinueAnalysis} disabled={!ocrActive && !paused}>{paused ? '繼續分析 (F9)' : '暫停分析 (F9)'}</Button>
            <Button variant="secondary" onClick={stopAnalysis} disabled={!ocrActive && !paused && !running}>停止分析 (F10)</Button>
            <Button variant="secondary" onClick={() => void exportTrainingStatsImage()} disabled={shareBusy}>{shareBusy ? "產生圖片中" : "擷取統計資訊"}</Button>
            <Button variant="ghost" onClick={resetAll}>重置</Button>
          </div>
        </div>

        <div className="mt-5 grid gap-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_260px_160px_160px] xl:items-end">
            <Field label="當前等級（自動辨識）">
              <Input inputMode="numeric" value={currentLevelInput} placeholder="開始分析後自動辨識，可手動修正" onChange={(event) => setCurrentLevelInput(event.target.value.replace(/[^0-9]/g, '').slice(0, 3))} />
              <div className="mt-2 text-xs font-bold text-orange-700">
                {targetExp > 0 ? `Lv.${currentLevel}｜升下一级所需经验：${formatTrainingNumber(targetExp)}` : levelOcrMessage}
              </div>
            </Field>
            <div className={classNames('rounded-2xl border border-orange-100 bg-orange-50/70 p-2', manualSelectMode && 'xl:col-span-4')}>
              <div className="mb-1 flex items-center justify-between text-[11px] font-black text-orange-700">
                <span>螢幕擷取對照</span>
                {captureActive ? <button className="text-rose-600" onClick={stopCapture}>停止</button> : null}
              </div>
              <div
                ref={videoWrapRef}
                className={classNames('relative overflow-hidden rounded-xl bg-slate-950', manualSelectMode ? 'h-[420px] cursor-crosshair ring-2 ring-orange-300' : 'h-28')}
                onPointerDown={onVideoPointerDown}
                onPointerMove={onVideoPointerMove}
                onPointerUp={onVideoPointerUp}
              >
                <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-contain" />
                {hudPanelOverlayBox && !manualSelectMode ? (
                  <div
                    className="pointer-events-none absolute border-2 border-cyan-300 bg-cyan-300/5"
                    style={{ left: hudPanelOverlayBox.x, top: hudPanelOverlayBox.y, width: hudPanelOverlayBox.w, height: hudPanelOverlayBox.h }}
                  />
                ) : null}
                {activeBox ? (
                  <div
                    className="pointer-events-none absolute border-2 border-orange-400 bg-orange-400/10"
                    style={{ left: activeBox.x, top: activeBox.y, width: activeBox.w, height: activeBox.h }}
                  />
                ) : null}
                {levelOverlayBox && !manualSelectMode ? (
                  <div
                    className="pointer-events-none absolute border-2 border-sky-400 bg-sky-400/15"
                    style={{ left: levelOverlayBox.x, top: levelOverlayBox.y, width: levelOverlayBox.w, height: levelOverlayBox.h }}
                  />
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-orange-100 bg-white/85 p-2">
              <div className="mb-1 text-[11px] font-black text-orange-700">EXP OCR 預覽</div>
              <canvas ref={previewCanvasRef} className="h-28 w-full rounded-xl bg-slate-950 object-contain" />
            </div>
            <div className="rounded-2xl border border-sky-100 bg-white/85 p-2">
              <div className="mb-1 text-[11px] font-black text-sky-700">等級 OCR 預覽</div>
              <canvas ref={levelPreviewCanvasRef} className="h-28 w-full rounded-xl bg-slate-950 object-contain" />
            </div>
          </div>

          {debugEnabled ? (
            <>
              <div className="flex flex-wrap gap-2 rounded-2xl border border-orange-100 bg-orange-50/60 px-4 py-3">
                <Button variant="secondary" disabled={!captureActive} onClick={() => setManualSelectMode((prev) => !prev)}>{manualSelectMode ? '取消框選' : '手動框選裁切區'}</Button>
                <Button variant="secondary" disabled={!captureActive} onClick={saveCropAsDefault}>儲存為預設裁切區</Button>
                <Button variant="secondary" disabled={!captureActive} onClick={() => { void autoDetectOcrCrop(); }}>從螢幕擷取對照重新辨識 EXP / 等級</Button>
                <Button variant="ghost" onClick={resetSavedCrop}>清除預設裁切區</Button>
                <span className="self-center text-xs font-semibold text-orange-700">青框為完整 LV / HP / MP / EXP 狀態列；青框確認後才產生橘色 EXP 框與藍色等級框。找不到青框時不會使用舊座標辨識。</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-5">
                <Field label="OCR 間隔秒數">
                  <Select value={ocrIntervalSec} onChange={(event) => setOcrIntervalSec(Number(event.target.value))}>
                    {[1, 2, 3, 5, 10].map((sec) => <option key={sec} value={sec}>{sec} 秒</option>)}
                  </Select>
                </Field>
                <Field label="X">
                  <Input type="number" min="0" max="100" value={ocrCrop.x} onChange={(event) => setOcrCrop((prev) => ({ ...prev, x: Math.max(0, Math.min(100, Number(event.target.value))) }))} />
                </Field>
                <Field label="Y">
                  <Input type="number" min="0" max="100" value={ocrCrop.y} onChange={(event) => setOcrCrop((prev) => ({ ...prev, y: Math.max(0, Math.min(100, Number(event.target.value))) }))} />
                </Field>
                <Field label="寬">
                  <Input type="number" min="1" max="100" value={ocrCrop.w} onChange={(event) => setOcrCrop((prev) => ({ ...prev, w: Math.max(1, Math.min(100, Number(event.target.value))) }))} />
                </Field>
                <Field label="高">
                  <Input type="number" min="1" max="100" value={ocrCrop.h} onChange={(event) => setOcrCrop((prev) => ({ ...prev, h: Math.max(1, Math.min(100, Number(event.target.value))) }))} />
                </Field>
              </div>

              <div className="mb-3 grid gap-3 rounded-2xl border border-sky-100 bg-sky-50 p-3 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-center">
                <div className="text-sm font-black text-sky-700">定位來源：{cropDetectionSource}<div className="mt-1 text-xs font-semibold text-sky-600">必須先辨識右側參考形式的完整狀態列，才會建立等級與 EXP 裁切框。</div></div>
                <img src="/training-hud-reference.png" alt="LV HP MP EXP 狀態列辨識參考" className="w-full rounded-lg border border-sky-200 bg-slate-950 object-contain" />
              </div>
              <div className="mb-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-2xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700">OCR 引擎：{ocrWorkerStatus === 'ready' ? '已就緒' : ocrWorkerStatus === 'loading' ? '載入中' : ocrWorkerStatus === 'error' ? '載入失敗' : '未啟動'}</div>
                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm font-black text-violet-700">最近 OCR 耗時：{ocrDurationMs > 0 ? `${(ocrDurationMs / 1000).toFixed(2)} 秒` : '--'}</div>
                <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">辨識間隔：{ocrIntervalSec} 秒</div>
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">影格來源：{captureFrameSource === 'image-capture' ? '擷取軌道' : captureFrameSource === 'video' ? '影片備援' : '未取得'}</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700">排程：{ocrSchedulerMode === 'worker' ? '背景 Worker' : ocrSchedulerMode === 'window' ? '頁面計時器備援' : '停止'}{lastFrameCapturedAt ? `｜影格 ${Math.max(0, Math.round((now - lastFrameCapturedAt) / 1000))} 秒前` : ''}</div>
              </div>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">EXP OCR 成功：{ocrSuccessCount}</div>
                <div className="rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-black text-rose-700">EXP 失敗 / 忽略：{ocrFailCount}</div>
                <div className="rounded-3xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-black text-orange-700">EXP 最近辨識：{ocrText || '--'}</div>
                <div className="rounded-3xl border border-sky-100 bg-sky-50 px-4 py-3 text-sm font-black text-sky-700">等級辨識：{levelOcrText || '--'}｜成功 {levelOcrSuccessCount}</div>
              </div>
            </>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-[minmax(0,360px)_auto_auto_auto] xl:items-end">
            <Field label="手動修正目前 EXP">
              <Input inputMode="numeric" value={expInput} placeholder="OCR 誤判時手動輸入" onChange={(event) => setExpInput(event.target.value.replace(/[^0-9]/g, ''))} />
            </Field>
            <Button onClick={addSample}>手動加入紀錄</Button>
            <Button variant="secondary" onClick={recordTrainingStatsSnapshot}>紀錄統計資訊</Button>
            <Button variant="secondary" onClick={openTrainingStatsSnapshotViewer} disabled={trainingStatSnapshots.length === 0}>檢視之前統計資訊</Button>
          </div>
        </div>

        {debugEnabled ? (
          <>
            {message ? <div className="mt-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-700">{message}</div> : null}
            <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-600">{ocrMessage}</div>
          </>
        ) : null}
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <TrainingStatCard title="EXP" value={`${formatTrainingNumber(currentExp)}${targetExp > 0 ? ` [${currentPercent.toFixed(2)}%]` : ''}`} sub={totalExp > 0 ? `+${formatTrainingNumber(totalExp)}${targetExp > 0 ? ` [${totalExpPercent.toFixed(2)}%]` : ''}` : undefined} icon="👁" />
        <TrainingStatCard title="EXP / 分" value={`⚡ ${formatTrainingNumber(expPerMinute)}`} icon="👁" />
        <TrainingStatCard title="統計時間" value={formatTrainingDuration(elapsedMinutes)} sub={analysisStartedAt ? `開始 ${new Date(analysisStartedAt).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}` : undefined} icon="👁" />
        <TrainingStatCard title="EXP累積 (10分)" value={`${formatTrainingNumber(accumulated10)} (${elapsedMinutes < 10 ? '<10m' : '10m'})`} icon="👁" />
        <TrainingStatCard title="預估 10 分( 近10分 | 最高 )" value={`${formatTrainingNumber(predicted10)} (${formatTrainingNumber(accumulated10)} | ${formatTrainingNumber(highest10)})`} icon="👁" />
        <TrainingStatCard title="預估百分比 (1 | 10 | 60分)" value={targetExp > 0 ? `${percentPerMinute.toFixed(2)}% | ${(percentPerMinute * 10).toFixed(2)}% | ${(percentPerMinute * 60).toFixed(2)}%` : '-- | -- | --'} icon="👁" />
        <TrainingStatCard title="EXP累積 (60分)" value={`${formatTrainingNumber(accumulated60)} (${elapsedMinutes < 60 ? '<1h' : '60m'})`} icon="👁" />
        <TrainingStatCard title="預估 60 分( 近60分 | 最高 )" value={`${formatTrainingNumber(predicted60)} (${formatTrainingNumber(accumulated60)} | ${formatTrainingNumber(highest60)})`} icon="👁" />
        <TrainingStatCard title="預估升級時間" value={formatTrainingDuration(etaMinutes)} sub={currentLevel > 0 ? `等級 ${Math.min(200, currentLevel + 1)}` : undefined} icon="👁" />
      </div>

      <TrainingChart samples={samples} />

      {selectedTrainingStatSnapshotId ? (() => {
        const selectedSnapshot = trainingStatSnapshots.find((snapshot) => snapshot.id === selectedTrainingStatSnapshotId) || trainingStatSnapshots[0];
        return selectedSnapshot ? (
          <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/40 p-4">
            <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-[2rem] border border-orange-100 bg-white p-5 shadow-2xl">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">Training Stats Records</div>
                  <h3 className="mt-1 text-2xl font-black text-slate-950">統計資訊紀錄</h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">最多保存最近 10 次按下「紀錄統計資訊」的內容；點擊時間可查看該時間點的統計區資訊。</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => void exportTrainingStatsImage(
                      selectedSnapshot.rows,
                      `紀錄時間：${new Date(selectedSnapshot.timestamp).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`,
                    )}
                    disabled={shareBusy}
                  >
                    {shareBusy ? '產生圖片中' : '擷取統計資訊'}
                  </Button>
                  <Button variant="ghost" onClick={() => setSelectedTrainingStatSnapshotId(null)}>關閉</Button>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                <div className="rounded-3xl border border-orange-100 bg-orange-50/60 p-3">
                  <div className="mb-2 text-xs font-black text-orange-700">紀錄時間</div>
                  <div className="grid gap-2">
                    {trainingStatSnapshots.map((snapshot) => (
                      <div
                        key={snapshot.id}
                        className={classNames(
                          'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border px-2 py-2 transition',
                          snapshot.id === selectedSnapshot.id ? 'border-orange-300 bg-white text-orange-700 ring-2 ring-orange-100' : 'border-orange-100 bg-white/70 text-slate-500 hover:bg-white',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => setSelectedTrainingStatSnapshotId(snapshot.id)}
                          className="truncate px-1 text-left text-xs font-black"
                          title={new Date(snapshot.timestamp).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                        >
                          {new Date(snapshot.timestamp).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            removeTrainingStatsSnapshot(snapshot.id);
                          }}
                          className="rounded-lg px-2 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50"
                        >
                          清除
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-3xl border border-orange-100 bg-white p-4">
                  <div className="mb-3 text-sm font-black text-slate-950">
                    {new Date(selectedSnapshot.timestamp).toLocaleString('zh-TW', { year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} 的統計資訊
                  </div>
                  <div className="grid gap-3 md:grid-cols-3">
                    {selectedSnapshot.rows.map((row) => (
                      <div key={row.title} className="rounded-2xl border border-orange-100 bg-orange-50/60 p-3">
                        <div className="text-xs font-black text-slate-400">{row.title}</div>
                        <div className="mt-1 break-words text-lg font-black text-slate-950">{row.value}</div>
                        {row.sub ? <div className="mt-1 break-words text-xs font-bold text-orange-700">{row.sub}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null;
      })() : null}

      {debugEnabled ? (
        <section className="rounded-[2rem] border border-orange-100 bg-white/85 p-5 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-black text-slate-950">最近 OCR / 手動紀錄</h3>
            <span className="text-xs font-black text-slate-400">OCR 紀錄：{ocrHistory.length}｜目前統計樣本：{samples.length}</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {ocrHistoryFilterOptions.map((option) => {
              const count =
                option.key === 'all'
                  ? ocrHistory.length
                  : ocrHistory.filter(
                      (record) => record.status === option.key,
                    ).length;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setOcrHistoryFilter(option.key)}
                  className={classNames(
                    'rounded-full px-3 py-1.5 text-xs font-black transition',
                    ocrHistoryFilter === option.key
                      ? 'bg-orange-500 text-white shadow-sm'
                      : 'bg-white text-slate-600 ring-1 ring-orange-100 hover:bg-orange-50',
                  )}
                >
                  {option.label} {count}
                </button>
              );
            })}
          </div>
          <div className="mt-3 max-h-96 overflow-auto rounded-2xl border border-orange-100 bg-orange-50/50 p-3">
            {filteredOcrHistory.length > 0 ? filteredOcrHistory.slice().reverse().map((record) => {
              const tone =
                record.status === 'added' || record.status === 'unchanged'
                  ? 'bg-emerald-50 text-emerald-700'
                  : record.status === 'rebaseline'
                    ? 'bg-sky-50 text-sky-700'
                    : record.status === 'pending'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-rose-50 text-rose-700';
              const statusLabel =
                record.status === 'added'
                  ? '已加入'
                  : record.status === 'unchanged'
                    ? '未變化'
                    : record.status === 'pending'
                      ? '待確認'
                      : record.status === 'rebaseline'
                        ? '新基準'
                        : record.status === 'failed'
                          ? '未辨識'
                          : '已拒絕';

              return (
                <div key={record.id} className="grid gap-2 border-b border-orange-100 py-2 text-sm last:border-b-0 md:grid-cols-[110px_70px_110px_minmax(0,1fr)] md:items-center">
                  <span className="font-bold text-slate-400">{new Date(record.timestamp).toLocaleTimeString('zh-TW')}</span>
                  <span className={classNames('w-fit rounded-full px-2 py-0.5 text-[11px] font-black', tone)}>{statusLabel}</span>
                  <span className="font-black text-slate-700">{record.exp !== null ? `EXP ${formatTrainingNumber(record.exp)}` : 'EXP --'}</span>
                  <span className="min-w-0 break-words text-xs font-semibold text-slate-500">{record.message}{record.rawText ? `｜原始：${record.rawText}` : ''}</span>
                </div>
              );
            }) : <div className="py-6 text-center text-sm font-bold text-slate-400">{ocrHistory.length > 0 ? '此分類目前沒有紀錄。' : '尚無紀錄。按「開始分析」後，每次 OCR 成功、失敗、待確認與手動輸入都會保留在這裡。'}</div>}
          </div>
        </section>
      ) : null}
      </div>
    </section>
  );
}

function SettingsPanel({ groups, leaderCodes, signupCodes, onForgetLeaderCode, onForgetSignupCode, onImportManagementRecords }: { groups: RaidGroup[]; leaderCodes: Record<string, string>; signupCodes: Record<string, string>; onForgetLeaderCode: (groupId: string) => void; onForgetSignupCode: (groupId: string) => void; onImportManagementRecords: (leaderCodes: Record<string, string>, signupCodes: Record<string, string>) => void }) {
  const [copied, setCopied] = useState<string | null>(null);
  const savedGroupIds = Array.from(new Set([...Object.keys(leaderCodes), ...Object.keys(signupCodes)]));
  const rows = savedGroupIds.map((groupId) => ({ groupId, group: groups.find((item) => item.id === groupId), leaderCode: leaderCodes[groupId] || '', signupCode: signupCodes[groupId] || '' }));

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1600);
  }

  function exportManagementRecords() {
    const payload = {
      version: 'UI-6.2-management-records',
      exportedAt: new Date().toISOString(),
      leaderCodes,
      signupCodes,
      links: rows.map(({ groupId, group, signupCode }) => ({
        groupId,
        title: group?.title || '',
        boss: group?.boss || '',
        cleanLink: buildGroupShareUrl(groupId),
        inviteLink: signupCode ? buildGroupShareUrl(groupId, signupCode) : '',
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `raid-management-records-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setCopied('export-management');
    window.setTimeout(() => setCopied(null), 1600);
  }

  async function importManagementRecords(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text()) as {
        leaderCodes?: Record<string, unknown>;
        signupCodes?: Record<string, unknown>;
        leader_codes?: Record<string, unknown>;
        signup_codes?: Record<string, unknown>;
        rows?: Array<{ groupId?: unknown; group_id?: unknown; leaderCode?: unknown; signupCode?: unknown; leader_code?: unknown; signup_code?: unknown }>;
      };

      const nextLeaderCodes: Record<string, string> = {};
      const nextSignupCodes: Record<string, string> = {};

      const rawLeaderCodes = parsed.leaderCodes || parsed.leader_codes || {};
      const rawSignupCodes = parsed.signupCodes || parsed.signup_codes || {};

      for (const [groupId, code] of Object.entries(rawLeaderCodes)) {
        const cleanCode = String(code || '').trim();
        if (groupId && cleanCode) nextLeaderCodes[groupId] = cleanCode;
      }

      for (const [groupId, code] of Object.entries(rawSignupCodes)) {
        const cleanCode = String(code || '').trim();
        if (groupId && cleanCode) nextSignupCodes[groupId] = cleanCode;
      }

      if (Array.isArray(parsed.rows)) {
        for (const row of parsed.rows) {
          const groupId = String(row.groupId || row.group_id || '').trim();
          if (!groupId) continue;
          const leaderCode = String(row.leaderCode || row.leader_code || '').trim();
          const signupCode = String(row.signupCode || row.signup_code || '').trim();
          if (leaderCode) nextLeaderCodes[groupId] = leaderCode;
          if (signupCode) nextSignupCodes[groupId] = signupCode;
        }
      }

      if (Object.keys(nextLeaderCodes).length === 0 && Object.keys(nextSignupCodes).length === 0) {
        setCopied('import-empty');
        window.setTimeout(() => setCopied(null), 1800);
        return;
      }

      onImportManagementRecords(nextLeaderCodes, nextSignupCodes);
      setCopied('import-management');
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied('import-error');
      window.setTimeout(() => setCopied(null), 2200);
    }
  }

  return (
    <section className="rounded-[2rem] border border-orange-100/80 bg-white/80 p-6 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">Local Settings</div>
          <h2 className="mt-2 text-2xl font-black text-slate-950">設定</h2>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-7 text-slate-500">這裡顯示「目前這台瀏覽器」保存的團長管理碼、團邀請碼與帶邀請碼的團連結。這些明碼不會從 Supabase 反查；換裝置或清除瀏覽器資料後需要重新輸入。</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="orange">本機保存 {rows.length} 團</Pill>
          <Button variant="secondary" onClick={exportManagementRecords} disabled={rows.length === 0}>{copied === 'export-management' ? '已匯出' : '匯出管理碼紀錄'}</Button>
          <label className="inline-flex cursor-pointer items-center rounded-2xl border border-orange-100 bg-white px-4 py-2 text-sm font-black text-orange-700 shadow-sm transition hover:bg-orange-50">
            {copied === 'import-management' ? '已匯入' : copied === 'import-error' ? '匯入失敗' : copied === 'import-empty' ? '無可匯入資料' : '匯入管理碼紀錄'}
            <input type="file" accept="application/json,.json" className="hidden" onChange={importManagementRecords} />
          </label>
        </div>
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
  const [teamFavorites, setTeamFavorites] = useState<TeamFavorite[]>(() => loadTeamFavorites());
  const [gameAccountRecords, setGameAccountRecords] = useState<GameAccountRecord[]>(() => loadGameAccountRecords());
  const [showGameAccountModal, setShowGameAccountModal] = useState(false);
  const [showArtalePriceModal, setShowArtalePriceModal] = useState(false);
  const [showVersionAnnouncement, setShowVersionAnnouncement] = useState(true);
  const [onlineUserCount, setOnlineUserCount] = useState<number | null>(isSupabaseConfigured ? null : 1);

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
    if (!isSupabaseConfigured) {
      setOnlineUserCount(1);
      return;
    }

    const clientId = getSitePresenceClientId();
    const channel = supabase.channel('maple-raid-board-site-presence', {
      config: {
        presence: {
          key: clientId,
        },
      },
    });

    function updateCount() {
      const state = channel.presenceState();
      setOnlineUserCount(Math.max(1, Object.keys(state).length));
    }

    channel
      .on('presence', { event: 'sync' }, updateCount)
      .on('presence', { event: 'join' }, updateCount)
      .on('presence', { event: 'leave' }, updateCount)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          void channel.track({
            clientId,
            onlineAt: new Date().toISOString(),
            page: window.location.pathname,
          });
          window.setTimeout(updateCount, 400);
        }
      });

    const heartbeat = window.setInterval(() => {
      void channel.track({
        clientId,
        onlineAt: new Date().toISOString(),
        page: window.location.pathname,
      });
    }, 30000);

    return () => {
      window.clearInterval(heartbeat);
      void channel.untrack();
      void supabase.removeChannel(channel);
    };
  }, []);

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

  function importManagementRecords(nextLeaderCodes: Record<string, string>, nextSignupCodes: Record<string, string>) {
    setLeaderCodes((prev) => {
      const next = { ...prev, ...nextLeaderCodes };
      saveLeaderCodes(next);
      return next;
    });
    setSignupCodes((prev) => {
      const next = { ...prev, ...nextSignupCodes };
      saveSignupCodes(next);
      return next;
    });
    const count = new Set([...Object.keys(nextLeaderCodes), ...Object.keys(nextSignupCodes)]).size;
    setRefreshNotice(`已匯入 ${count} 筆管理碼 / 邀請碼紀錄。`);
    window.setTimeout(() => setRefreshNotice(null), 3200);
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

  function updateGameAccountRecords(records: GameAccountRecord[]) {
    const next = records.slice(0, 10);
    setGameAccountRecords(next);
    saveGameAccountRecords(next);
  }

  function rememberTeamFavorite(favorite: TeamFavorite) {
    setTeamFavorites((prev) => {
      const next = [
        favorite,
        ...prev.filter((item) => !(item.groupId === favorite.groupId && item.party === favorite.party)),
      ].slice(0, 60);
      saveTeamFavorites(next);
      return next;
    });
    setRefreshNotice(`已收藏「${favorite.groupTitle}」隊伍 ${favorite.party}。`);
    window.setTimeout(() => setRefreshNotice(null), 3200);
  }

  function forgetTeamFavorite(id: string) {
    setTeamFavorites((prev) => {
      const next = prev.filter((item) => item.id !== id);
      saveTeamFavorites(next);
      return next;
    });
  }

  async function createGroup(group: NewRaidGroup, importedMembers: ImportedRaidMemberDraft[] = []) {
    await runAction(async () => {
      await insertRaidGroup(group);

      for (const [index, member] of importedMembers.entries()) {
        await insertRaidMember({
          groupId: group.id,
          name: member.name,
          job: member.job,
          level: member.level,
          role: member.role,
          party: member.party,
          status: member.status,
          note: member.note,
          signupCode: group.signupCode,
          clientNonce: `team-favorite-${group.id}-${index}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        });
      }

      rememberLeaderCode(group.id, group.leaderCode);
      rememberSignupCode(group.id, group.signupCode);
      setSelectedId(group.id);
      setShowCreate(false);
      if (importedMembers.length > 0) {
        setRefreshNotice(`已建立場次並帶入 ${importedMembers.length} 位隊伍收藏成員。`);
        window.setTimeout(() => setRefreshNotice(null), 3200);
      }
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
            <div className="flex shrink-0 flex-col items-center gap-1">
              <MapleLeafLogo />
              <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-black text-orange-700 shadow-sm ring-1 ring-orange-200">
                <span>線上人數</span>
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-orange-600" aria-hidden="true">
                  <path fill="currentColor" d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5s-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5C15 14.17 10.33 13 8 13Zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5Z" />
                </svg>
                <span className="font-mono text-orange-700">{onlineUserCount ?? '--'}</span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-950">Maple Raid Board</h1>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-black text-orange-700 ring-1 ring-orange-200">TSN UI-9.6</span>
                <span className="text-orange-500">✦</span>
              </div>
              <p className="mt-1 text-xs font-bold text-slate-400">點擊右上蘑菇 Logo 可紀錄「遊戲id / 特徵碼」。</p>
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
            <Button variant="secondary" onClick={() => setShowArtalePriceModal(true)}>
              📈 Artale物價查詢
            </Button>
            <Button className="shadow-lg shadow-orange-500/20" onClick={() => setShowCreate(true)} disabled={busy || !isSupabaseConfigured}>＋ 新增突襲</Button>
            <button
              type="button"
              onClick={() => setShowGameAccountModal(true)}
              className="grid h-11 w-11 place-items-center rounded-full border border-orange-100 bg-orange-50 text-xl shadow-sm transition hover:-translate-y-0.5 hover:bg-orange-100"
              title="遊戲id / 特徵碼紀錄"
              aria-label="遊戲id / 特徵碼紀錄"
            >
              🍄
            </button>
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
                onTeamFavoriteSave={rememberTeamFavorite}
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
                <SignupPanel group={selectedGroup} onSignup={addSignup} initialSignupCode={selectedSignupCode} gameAccountOptions={gameAccountRecords.map(formatGameAccountRecord)} />
              </div>
            ) : (
              <div className="rounded-[2rem] border border-orange-100 bg-white/85 p-10 text-center text-slate-500 shadow-sm">沒有可報名的場次。</div>
            )
          ) : activePanel === 'favorite' ? (
            <LinkFavoritesPanel selectedGroup={selectedGroup} selectedSignupCode={selectedSignupCode} onGoSettings={() => setActivePanel('settings')} />
          ) : activePanel === 'teamFavorite' ? (
            <TeamFavoritesPanel favorites={teamFavorites} onRemove={forgetTeamFavorite} onSelectGroup={setSelectedId} onGoRaid={() => setActivePanel('raid')} />
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
              onImportManagementRecords={importManagementRecords}
            />
          )}
        </div>
      )}


      {showVersionAnnouncement && activePanel === 'home' ? (
        <div className="fixed inset-0 z-[95] grid place-items-center bg-slate-950/45 p-4">
          <div className="w-full max-w-xl rounded-[2rem] border border-orange-100 bg-white p-6 shadow-2xl">
            <div className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">TSN UI-9.6 更新公告</div>
            <h2 className="mt-2 text-2xl font-black text-slate-950">本次版本更新內容</h2>
            <div className="mt-4 grid gap-3 text-sm font-bold leading-7 text-slate-600">
              <div className="rounded-2xl bg-orange-50 px-4 py-3">EXP 辨識處理狀態改為只有勾選 Debug 時顯示。</div>
              <div className="rounded-2xl bg-orange-50 px-4 py-3">OCR 詳細訊息，包括影像流程、等級與影格來源，也改為只有勾選 Debug 時顯示。</div>
              <div className="rounded-2xl bg-orange-50 px-4 py-3">關閉 Debug 時不會保留兩個狀態訊息區塊的空白版面。</div>
              <div className="rounded-2xl bg-orange-50 px-4 py-3">OCR 判定、EXP 基準、計數、紀錄與統計邏輯維持不變。</div>
            </div>
            <div className="mt-5 rounded-2xl border border-orange-100 bg-amber-50 px-4 py-3 text-sm font-black text-amber-800">若有問題可以聯絡作者DC:Mmumu0730</div>
            <div className="mt-5 flex justify-end">
              <Button onClick={() => setShowVersionAnnouncement(false)}>我知道了</Button>
            </div>
          </div>
        </div>
      ) : null}

      {showArtalePriceModal ? <ArtalePriceModal onClose={() => setShowArtalePriceModal(false)} /> : null}
      {showGameAccountModal ? <GameAccountModal records={gameAccountRecords} onClose={() => setShowGameAccountModal(false)} onSaveRecords={updateGameAccountRecords} /> : null}
      {showCreate ? <CreateRaidModal onClose={() => setShowCreate(false)} onCreate={createGroup} teamFavorites={teamFavorites} gameAccountOptions={gameAccountRecords.map(formatGameAccountRecord)} /> : null}
    </div>
  );
}
