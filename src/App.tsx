import { useCallback, useEffect, useMemo, useState } from 'react';
import { deleteRaidGroup, deleteRaidMember, fetchRaidGroups, insertRaidGroup, insertRaidMember, updateRaidMemberStatus } from './api/raids';
import { CreateRaidModal } from './components/CreateRaidModal';
import { RaidDetail } from './components/RaidDetail';
import { RaidList } from './components/RaidList';
import { Button } from './components/ui';
import { isSupabaseConfigured, supabase } from './lib/supabase';
import type { MemberStatus, NewRaidGroup, NewRaidMember, RaidGroup } from './types';

function getInitialGroupId() {
  return new URLSearchParams(window.location.search).get('group') || 'demo-zakum-soon';
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
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-500">Maple Raid Board + Supabase</div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950">突襲組隊報名平台</h1>
            <p className="mt-1 text-sm text-slate-500">Boss 場次、報名、分隊、確認狀態、group 直連分享。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void loadGroups()} disabled={busy || loading}>重新整理</Button>
            <Button onClick={() => setShowCreate(true)} disabled={busy || !isSupabaseConfigured}>新增突襲</Button>
          </div>
        </div>
      </header>

      {error ? (
        <div className="mx-auto mt-5 max-w-7xl px-4">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div>
        </div>
      ) : null}

      {loading ? (
        <div className="mx-auto max-w-7xl px-4 py-10 text-slate-500">載入中...</div>
      ) : (
        <div className="mx-auto grid max-w-7xl gap-5 px-4 py-5 lg:grid-cols-[360px_1fr]">
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
            <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-slate-500">沒有可顯示的場次。請先執行 Supabase SQL seed。</div>
          )}
        </div>
      )}

      <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-slate-400">
        Demo mode：目前 SQL policy 開放匿名 CRUD。正式站請改成登入制或管理 key。
      </footer>

      {showCreate ? <CreateRaidModal onClose={() => setShowCreate(false)} onCreate={createGroup} /> : null}
    </div>
  );
}
