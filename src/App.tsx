import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteRaidGroup, deleteRaidMember, fetchRaidGroups, insertRaidGroup, insertRaidMember, updateRaidMemberStatus } from './api/raids';
import { CreateRaidModal } from './components/CreateRaidModal';
import { RaidDetail } from './components/RaidDetail';
import { RaidList } from './components/RaidList';
import { Button, classNames } from './components/ui';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import type { MemberStatus, NewRaidGroup, NewRaidMember, RaidGroup } from './types';

function getInitialGroupId() {
  return new URLSearchParams(window.location.search).get('group') || 'demo-zakum-soon';
}

function NavigationRail() {
  const items = [
    { icon: '⌂', label: '首頁' },
    { icon: '楓', label: '突襲', active: true },
    { icon: '▣', label: '我的報名' },
    { icon: '☆', label: '收藏' },
    { icon: '●', label: '通知', badge: '3' },
    { icon: '⚙', label: '設定' },
  ];

  return (
    <nav className="hidden rounded-[2rem] border border-orange-100/80 bg-white/80 p-2 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.8)] backdrop-blur-xl lg:flex lg:h-[calc(100vh-112px)] lg:flex-col lg:items-center lg:gap-2 lg:sticky lg:top-24">
      {items.map((item) => (
        <button
          key={item.label}
          className={classNames(
            'relative grid w-full place-items-center gap-1 rounded-2xl px-2 py-3 text-[11px] font-bold transition',
            item.active ? 'bg-orange-100 text-orange-700 shadow-inner' : 'text-slate-500 hover:bg-orange-50 hover:text-orange-700',
          )}
        >
          <span className="text-xl leading-none">{item.icon}</span>
          <span className="whitespace-nowrap">{item.label}</span>
          {item.badge ? <span className="absolute right-2 top-2 grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] text-white">{item.badge}</span> : null}
        </button>
      ))}
    </nav>
  );
}

export default function App() {
  const [groups, setGroups] = useState<RaidGroup[]>([]);
  const [selectedId, setSelectedId] = useState(getInitialGroupId);
  const [query, setQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedGroup = useMemo(() => groups.find((g) => g.id === selectedId) || groups[0], [groups, selectedId]);

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
    if (!selectedGroup) return;
    const url = new URL(window.location.href);
    url.searchParams.set('group', selectedGroup.id);
    window.history.replaceState({}, '', url.toString());
  }, [selectedGroup]);

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

  async function createGroup(group: NewRaidGroup) {
    await runAction(async () => {
      await insertRaidGroup(group);
      setSelectedId(group.id);
      setShowCreate(false);
    });
  }

  async function addSignup(member: NewRaidMember) {
    await runAction(() => insertRaidMember(member));
  }

  async function changeStatus(memberId: string, status: MemberStatus) {
    await runAction(() => updateRaidMemberStatus(memberId, status));
  }

  async function removeMember(memberId: string) {
    await runAction(() => deleteRaidMember(memberId));
  }

  async function removeGroup(groupId: string) {
    const ok = window.confirm('確定刪除此團？成員會一起刪除。');
    if (!ok) return;
    await runAction(() => deleteRaidGroup(groupId));
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
                <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-black text-orange-700 ring-1 ring-orange-200">秋楓 UI-V2</span>
                <span className="text-orange-500">✦</span>
              </div>
              <p className="text-xs font-semibold text-slate-500">新版視覺：左導覽＋Hero＋右側報名面板</p>
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
                  const url = new URL(window.location.href);
                  url.searchParams.set('group', selectedGroup.id);
                  void navigator.clipboard.writeText(url.toString());
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
        <div className="mx-auto grid max-w-[1560px] gap-4 px-4 py-4 lg:grid-cols-[76px_320px_minmax(0,1fr)] xl:grid-cols-[76px_340px_minmax(0,1fr)]">
          <NavigationRail />
          <RaidList groups={groups} selectedId={selectedGroup?.id} onSelect={setSelectedId} query={query} setQuery={setQuery} />
          {selectedGroup ? (
            <RaidDetail
              group={selectedGroup}
              onSignup={addSignup}
              onStatusChange={changeStatus}
              onRemove={removeMember}
              onDelete={removeGroup}
            />
          ) : (
            <div className="rounded-[2rem] border border-orange-100 bg-white/85 p-10 text-center text-slate-500 shadow-sm">沒有可顯示的場次。請先執行 Supabase SQL seed。</div>
          )}
        </div>
      )}

      <footer className="mx-auto max-w-[1560px] px-4 pb-8 text-xs text-slate-400">
        UI-V2 visible marker：如果你看不到『秋楓 UI-V2』，代表 Vercel 沒部署到新版 commit。Demo mode：目前 SQL policy 開放匿名 CRUD。正式站請改成登入制、管理員權限與每團邀請碼。
      </footer>

      {showCreate ? <CreateRaidModal onClose={() => setShowCreate(false)} onCreate={createGroup} /> : null}
    </div>
  );
}
