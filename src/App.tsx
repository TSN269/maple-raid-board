import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteRaidGroup, deleteRaidMember, fetchRaidGroups, insertRaidGroup, insertRaidMember, updateRaidGroupStatus, updateRaidMemberStatus, verifyLeaderCode } from './api/raids';
import { CreateRaidModal } from './components/CreateRaidModal';
import { RaidDetail } from './components/RaidDetail';
import { RaidList } from './components/RaidList';
import { SignupPanel } from './components/SignupPanel';
import { NotificationCenter, buildDerivedNotifications, type RaidNotification } from './components/NotificationCenter';
import { Button, Pill, classNames } from './components/ui';
import { getBossDifficultyMeta, getBossDisplayName, getBossVisualMeta, getRaidStatusMeta } from './data/bossArt';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import type { MemberStatus, NewRaidGroup, NewRaidMember, RaidGroup, RaidStatus } from './types';

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

type ActivePanel = 'home' | 'raid' | 'signup' | 'favorite' | 'notice' | 'settings';

function NavigationRail({ activePanel, onChange, noticeCount }: { activePanel: ActivePanel; onChange: (panel: ActivePanel) => void; noticeCount: number }) {
  const items: Array<{ icon: string; label: string; panel: ActivePanel; badge?: string; helper?: string }> = [
    { icon: '⌂', label: '首頁', panel: 'home', helper: '突襲場次清單' },
    { icon: '🍁', label: '楓突襲', panel: 'raid', helper: '突襲詳細內容' },
    { icon: '✎', label: '我要報名', panel: 'signup', helper: '報名表單' },
    { icon: '☆', label: '收藏', panel: 'favorite', helper: '下一階段' },
    { icon: '●', label: '通知', panel: 'notice', badge: noticeCount > 0 ? String(Math.min(99, noticeCount)) : undefined, helper: '開團提醒 / 狀態變更 / 候補轉正' },
    { icon: '⚙', label: '設定', panel: 'settings', helper: '下一階段' },
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
export default function App() {
  const [groups, setGroups] = useState<RaidGroup[]>([]);
  const [selectedId, setSelectedId] = useState(getInitialGroupId);
  const [query, setQuery] = useState('');
  const [activePanel, setActivePanel] = useState<ActivePanel>('home');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 text-2xl text-white shadow-lg shadow-orange-500/20">楓</div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-slate-950">Maple Raid Board</h1>
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-black text-orange-700 ring-1 ring-orange-200">秋楓 UI-V15</span>
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
            <Button variant="secondary" onClick={() => void loadGroups()} disabled={busy || loading}>重新整理</Button>
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

      {loading ? (
        <div className="mx-auto max-w-[1560px] px-4 py-10 text-slate-500">載入中...</div>
      ) : (
        <div className="mx-auto grid max-w-[1560px] gap-4 px-4 py-4 lg:grid-cols-[86px_minmax(0,1fr)]">
          <NavigationRail activePanel={activePanel} onChange={setActivePanel} noticeCount={unreadNotificationCount} />

          {activePanel === 'home' ? (
            <div className="grid gap-4 xl:grid-cols-[420px_minmax(0,1fr)]">
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
          ) : activePanel === 'raid' ? (
            selectedGroup ? (
              <RaidDetail
                group={selectedGroup}
                onStatusChange={changeStatus}
                onGroupStatusChange={changeGroupStatus}
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
              <div className="mx-auto grid w-full max-w-5xl gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
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
            <PlaceholderPanel title="收藏" description="下一階段可做成常用 Boss、固定團與收藏場次。" />
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
          ) : (
            <PlaceholderPanel title="設定" description="下一階段可做成公會名稱、管理碼、權限與顯示偏好。" />
          )}
        </div>
      )}

      {showCreate ? <CreateRaidModal onClose={() => setShowCreate(false)} onCreate={createGroup} /> : null}
    </div>
  );
}
