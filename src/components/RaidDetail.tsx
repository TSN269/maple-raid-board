import { useMemo, useState } from 'react';
import { statusOptions } from '../data/options';
import type { MemberStatus, RaidGroup, RaidMember } from '../types';
import { Button, Pill, Select, classNames } from './ui';

type Props = {
  group: RaidGroup;
  onStatusChange: (memberId: string, status: MemberStatus) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
  onDelete: (groupId: string) => Promise<void>;
};

const roleAccent: Record<string, string> = {
  主坦: 'bg-slate-100 text-slate-700',
  副坦: 'bg-emerald-50 text-emerald-700',
  輸出: 'bg-rose-50 text-rose-700',
  補師: 'bg-sky-50 text-sky-700',
  主輸出: 'bg-rose-50 text-rose-700',
  副輸出: 'bg-orange-50 text-orange-700',
  輔助: 'bg-emerald-50 text-emerald-700',
  隊長: 'bg-violet-50 text-violet-700',
  替補: 'bg-slate-100 text-slate-600',
};

function statusDot(status: MemberStatus) {
  if (status === '已確認') return 'bg-emerald-500';
  if (status === '待確認') return 'bg-amber-500';
  if (status === '候補') return 'bg-sky-500';
  return 'bg-rose-500';
}

function jobIcon(job: string) {
  if (/主教|補|牧|priest|bishop/i.test(job)) return '✚';
  if (/黑騎|聖騎|英雄|坦/i.test(job)) return '🛡';
  if (/弓|箭|神射/i.test(job)) return '➶';
  if (/夜|盜|神偷|雙刀/i.test(job)) return '☾';
  if (/火|冰|雷|魔|法/i.test(job)) return '✦';
  if (/拳|槍/i.test(job)) return '✹';
  return '◆';
}

function difficultyMeta(group: RaidGroup) {
  const text = `${group.title} ${group.boss}`;
  if (/困難|hard|chaos/i.test(text)) return { label: '困難', tone: 'orange' as const };
  if (/簡單|easy/i.test(text)) return { label: '簡單', tone: 'green' as const };
  if (/普通|normal/i.test(text)) return { label: '普通', tone: 'purple' as const };
  return { label: '活動', tone: 'slate' as const };
}

function MemberRow({ member, onStatusChange, onRemove }: { member: RaidMember; onStatusChange: Props['onStatusChange']; onRemove: Props['onRemove'] }) {
  return (
    <div className="group/member grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-transparent bg-white/70 px-2.5 py-2 transition hover:border-orange-100 hover:bg-white hover:shadow-sm">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-slate-800 to-slate-600 text-xs font-black text-white shadow-inner">{jobIcon(member.job)}</div>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="truncate text-xs font-black text-slate-800">{member.name}</span>
          <span className={classNames('h-2 w-2 shrink-0 rounded-full', statusDot(member.status))} />
        </div>
        <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-400">Lv.{member.level} · {member.job}</div>
      </div>
      <div className="flex items-center gap-1">
        <span className={classNames('rounded-full px-2 py-1 text-[11px] font-black', roleAccent[member.role] ?? 'bg-slate-100 text-slate-600')}>{member.role}</span>
        <button className="hidden rounded-lg px-1.5 py-1 text-[10px] font-bold text-rose-400 hover:bg-rose-50 group-hover/member:block" onClick={() => onRemove(member.id)}>
          移除
        </button>
      </div>
      <div className="col-span-3 hidden pt-1 group-hover/member:block">
        <Select className="py-2 text-xs" value={member.status} onChange={(e) => onStatusChange(member.id, e.target.value as MemberStatus)}>
          {statusOptions.map((s) => <option key={s}>{s}</option>)}
        </Select>
        {member.note ? <div className="mt-2 rounded-xl bg-orange-50 px-3 py-2 text-xs text-slate-600">{member.note}</div> : null}
      </div>
    </div>
  );
}

function EmptySlot({ role }: { role: string }) {
  return (
    <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-2 rounded-2xl border border-dashed border-orange-100 bg-white/45 px-2.5 py-2 text-slate-400">
      <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-sm font-black">＋</div>
      <div className="text-xs font-bold">等待中</div>
      <div className="text-[11px] font-bold">{role}</div>
    </div>
  );
}

function StatCard({ icon, label, value, suffix, tone }: { icon: string; label: string; value: number | string; suffix?: string; tone: 'red' | 'green' | 'yellow' | 'blue' }) {
  const tones = {
    red: { card: 'from-rose-50 to-white text-rose-600', icon: 'bg-rose-100' },
    green: { card: 'from-emerald-50 to-white text-emerald-600', icon: 'bg-emerald-100' },
    yellow: { card: 'from-amber-50 to-white text-amber-600', icon: 'bg-amber-100' },
    blue: { card: 'from-sky-50 to-white text-sky-600', icon: 'bg-sky-100' },
  };
  const selectedTone = tones[tone];

  return (
    <div className={classNames('rounded-3xl border border-orange-100/70 bg-gradient-to-br p-4 shadow-sm', selectedTone.card)}>
      <div className="flex items-center gap-3">
        <div className={classNames('grid h-12 w-12 place-items-center rounded-full text-xl', selectedTone.icon)}>{icon}</div>
        <div>
          <div className="text-xs font-black text-slate-400">{label}</div>
          <div className="text-3xl font-black tracking-tight text-slate-950">
            {value}{suffix ? <span className="ml-1 text-sm font-black text-slate-400">{suffix}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function RaidDetail({ group, onStatusChange, onRemove, onDelete }: Props) {
  const [copied, setCopied] = useState(false);
  const confirmed = group.members.filter((m) => m.status === '已確認').length;
  const pending = group.members.filter((m) => m.status === '待確認').length;
  const standby = group.members.filter((m) => m.status === '候補').length;
  const difficulty = difficultyMeta(group);

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
    <main className="grid min-w-0 gap-4">
      <section className="grid min-w-0 gap-4">
        <section className="relative overflow-hidden rounded-[2rem] border border-orange-100 bg-slate-950 text-white shadow-[0_28px_80px_-48px_rgba(15,23,42,0.95)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_68%_28%,rgba(239,68,68,0.52),transparent_26%),radial-gradient(circle_at_82%_75%,rgba(249,115,22,0.34),transparent_32%),linear-gradient(120deg,#09090b_0%,#1c1917_45%,#431407_100%)]" />
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,#fff_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="absolute -right-14 bottom-0 top-0 hidden w-1/2 items-center justify-center text-[13rem] font-black text-red-500/15 lg:flex">楓</div>
          <div className="absolute right-8 top-8 hidden rounded-3xl border border-white/10 bg-black/25 px-4 py-3 text-xs font-black text-orange-100 shadow-2xl backdrop-blur lg:block">Premium Raid Dashboard</div>
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={difficulty.tone}>{difficulty.label}</Pill>
                  <Pill tone="dark">{group.boss}</Pill>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-black text-orange-100 ring-1 ring-white/20">新版 Hero 版型</span>
                </div>
                <h2 className="mt-4 truncate text-4xl font-black tracking-tight md:text-5xl">{group.title}</h2>
                <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-orange-50/90">
                  <span>📅 {group.raidDate}</span>
                  <span>🕘 {group.raidTime}</span>
                  <span>👤 隊長：{group.leader}</span>
                </div>
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <span className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-black ring-1 ring-white/10">最低等級：{group.minLevel}</span>
                  <Pill tone={group.members.length >= group.capacity ? 'red' : 'green'} className="px-4 py-2">{group.members.length >= group.capacity ? '額滿' : '招募中'}</Pill>
                  <span className="text-sm font-black text-white/90">👥 {group.members.length} / {group.capacity}</span>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="secondary" onClick={copyShareUrl}>{copied ? '已複製' : '🔗 複製團連結'}</Button>
                <Button variant="secondary" onClick={exportJson}>匯出 JSON</Button>
                <Button variant="danger" onClick={() => onDelete(group.id)}>刪除團</Button>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-4">
          <StatCard icon="👥" label="總報名" value={group.members.length} suffix={`/ ${group.capacity}`} tone="red" />
          <StatCard icon="✓" label="已確認" value={confirmed} tone="green" />
          <StatCard icon="◴" label="待確認" value={pending} tone="yellow" />
          <StatCard icon="●" label="候補" value={standby} tone="blue" />
        </div>

        {group.notice ? (
          <section className="rounded-[2rem] border border-orange-100 bg-white/85 p-5 shadow-[0_18px_60px_-46px_rgba(124,45,18,0.8)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 text-xl text-orange-600">📣</div>
                <h3 className="text-lg font-black text-slate-950">公告</h3>
              </div>
              <span className="text-slate-300">📌</span>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-600">{group.notice}</p>
            <div className="mt-4 text-right text-xs font-semibold text-slate-400">發布時間：{new Date(group.updatedAt || group.createdAt).toLocaleString('zh-TW')}</div>
          </section>
        ) : null}

        <section className="rounded-[2rem] border border-orange-100 bg-white/85 p-5 shadow-[0_18px_60px_-46px_rgba(124,45,18,0.8)] backdrop-blur-xl">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-orange-600">♟</span>
                <h3 className="text-lg font-black text-slate-950">隊伍配置</h3>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-400">每隊最多 6 人；hover 成員可調整狀態或移除。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(roleCount).map(([role, count]) => <Pill key={role}>{role} {count}</Pill>)}
              <Button variant="secondary" className="py-2 text-xs">☷ 查看名單模式</Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((partyNo) => {
              const members = group.members.filter((m) => Number(m.party) === partyNo);
              const missing = Math.max(0, 6 - members.length);
              const emptyRoles = ['副坦', '輸出', '輸出', '輸出', '補師', '自由'];
              return (
                <div key={partyNo} className="rounded-3xl border border-orange-100 bg-gradient-to-br from-orange-50/75 to-white p-3">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h4 className="font-black text-slate-950">隊伍 {partyNo}</h4>
                    <span className="text-xs font-black text-slate-400">{members.length}/6</span>
                  </div>
                  <div className="grid gap-2">
                    {members.map((m) => <MemberRow key={m.id} member={m} onStatusChange={onStatusChange} onRemove={onRemove} />)}
                    {Array.from({ length: Math.min(missing, 6) }).map((_, i) => <EmptySlot key={i} role={emptyRoles[i] ?? '自由'} />)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4 border-t border-orange-100 pt-4 text-xs font-bold text-slate-500">
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />已確認</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" />待確認</span>
            <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-sky-500" />候補</span>
            <span className="ml-auto text-slate-400">拖曳成員調整隊伍順序可留作下一階段功能</span>
          </div>
        </section>
      </section>
    </main>
  );
}
