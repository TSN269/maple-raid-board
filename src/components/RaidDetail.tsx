import { useMemo, useState } from 'react';
import { statusOptions } from '../data/options';
import type { MemberStatus, RaidGroup, RaidMember, NewRaidMember } from '../types';
import { Button, Pill, Select } from './ui';
import { SignupPanel } from './SignupPanel';

type Props = {
  group: RaidGroup;
  onSignup: (member: NewRaidMember) => Promise<void>;
  onStatusChange: (memberId: string, status: MemberStatus) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
  onDelete: (groupId: string) => Promise<void>;
};

function MemberCard({ member, onStatusChange, onRemove }: { member: RaidMember; onStatusChange: Props['onStatusChange']; onRemove: Props['onRemove'] }) {
  const tone = member.status === '已確認' ? 'green' : member.status === '候補' ? 'yellow' : member.status === '請假' ? 'red' : 'slate';

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="truncate font-semibold text-slate-900">{member.name}</div>
            <Pill tone={tone}>{member.status}</Pill>
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Lv.{member.level} · {member.job} · {member.role}
          </div>
        </div>
        <button className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600" onClick={() => onRemove(member.id)}>
          移除
        </button>
      </div>
      {member.note ? <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">{member.note}</div> : null}
      <div className="mt-3">
        <Select value={member.status} onChange={(e) => onStatusChange(member.id, e.target.value as MemberStatus)}>
          {statusOptions.map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>
    </div>
  );
}

export function RaidDetail({ group, onSignup, onStatusChange, onRemove, onDelete }: Props) {
  const [copied, setCopied] = useState(false);
  const confirmed = group.members.filter((m) => m.status === '已確認').length;
  const pending = group.members.filter((m) => m.status === '待確認').length;
  const standby = group.members.filter((m) => m.status === '候補').length;

  const roleCount = useMemo(() => {
    return group.members.reduce<Record<string, number>>((acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, {});
  }, [group.members]);

  const shareUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('group', group.id);
    return url.toString();
  }, [group.id]);

  async function copyShareUrl() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(group, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${group.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="grid gap-5">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-700 p-6 text-white">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="purple">{group.boss}</Pill>
                <Pill tone={group.members.length >= group.capacity ? 'red' : 'green'}>{group.members.length >= group.capacity ? '額滿' : '開放報名'}</Pill>
              </div>
              <h1 className="mt-4 text-2xl font-black tracking-tight md:text-4xl">{group.title}</h1>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-200">
                <span>時間：{group.raidDate} {group.raidTime}</span>
                <span>團長：{group.leader}</span>
                <span>門檻：Lv.{group.minLevel}+</span>
                <span>名額：{group.capacity}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={copyShareUrl}>{copied ? '已複製' : '複製團連結'}</Button>
              <Button variant="secondary" onClick={exportJson}>匯出 JSON</Button>
              <Button variant="danger" onClick={() => onDelete(group.id)}>刪除團</Button>
            </div>
          </div>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-4">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">總報名</div>
            <div className="mt-1 text-2xl font-black text-slate-950">{group.members.length}/{group.capacity}</div>
          </div>
          <div className="rounded-2xl bg-emerald-50 p-4">
            <div className="text-sm text-emerald-700">已確認</div>
            <div className="mt-1 text-2xl font-black text-emerald-900">{confirmed}</div>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4">
            <div className="text-sm text-amber-700">待確認</div>
            <div className="mt-1 text-2xl font-black text-amber-900">{pending}</div>
          </div>
          <div className="rounded-2xl bg-blue-50 p-4">
            <div className="text-sm text-blue-700">候補</div>
            <div className="mt-1 text-2xl font-black text-blue-900">{standby}</div>
          </div>
        </div>
      </section>

      {group.notice ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="font-bold text-slate-950">公告</h3>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{group.notice}</p>
        </section>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <section className="grid gap-5">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-950">分隊看板</h3>
                <p className="mt-1 text-sm text-slate-500">第 1～6 隊；每隊最多 6 人。</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(roleCount).map(([role, count]) => <Pill key={role}>{role} {count}</Pill>)}
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              {[1, 2, 3, 4, 5, 6].map((partyNo) => {
                const members = group.members.filter((m) => Number(m.party) === partyNo);
                return (
                  <div key={partyNo} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="font-bold text-slate-950">第 {partyNo} 隊</h4>
                      <Pill tone={members.length >= 6 ? 'red' : 'blue'}>{members.length}/6</Pill>
                    </div>
                    <div className="grid gap-3">
                      {members.length > 0 ? (
                        members.map((m) => <MemberCard key={m.id} member={m} onStatusChange={onStatusChange} onRemove={onRemove} />)
                      ) : (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-400">尚無成員</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <SignupPanel group={group} onSignup={onSignup} />
      </div>
    </main>
  );
}
