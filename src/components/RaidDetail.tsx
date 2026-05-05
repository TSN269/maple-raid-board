import { useEffect, useMemo, useState } from 'react';
import { getBossArtMeta, getBossDifficultyMeta, getBossDisplayName, getBossVisualMeta, getRaidStatusMeta } from '../data/bossArt';
import { statusOptions } from '../data/options';
import type { MemberStatus, RaidGroup, RaidMember, RaidStatus } from '../types';
import { Button, Input, Pill, Select, classNames } from './ui';

type Props = {
  group: RaidGroup;
  onStatusChange: (memberId: string, status: MemberStatus) => Promise<void>;
  onGroupStatusChange: (groupId: string, status: RaidStatus) => Promise<void>;
  onRemove: (memberId: string) => Promise<void>;
  onDelete: (groupId: string) => Promise<void>;
  isLeaderUnlocked: boolean;
  onLeaderUnlock: (code: string) => Promise<void>;
  onLeaderLock: () => void;
  signupCode?: string;
  onSignupCodeSave: (code: string) => void;
  onSignupCodeForget: () => void;
};

const groupStatusOptions: Array<{ value: RaidStatus; label: string; helper: string }> = [
  { value: 'open', label: '招募中', helper: '允許玩家報名' },
  { value: 'closed', label: '招募截止', helper: '保留團，但不再接受報名' },
  { value: 'finished', label: '已結束', helper: '團已完成或過期' },
];

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

function MemberRow({ member, onStatusChange, onRemove, canManage }: { member: RaidMember; onStatusChange: Props['onStatusChange']; onRemove: Props['onRemove']; canManage: boolean }) {
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
        {canManage ? (
          <button className="hidden rounded-lg px-1.5 py-1 text-[10px] font-bold text-rose-400 hover:bg-rose-50 group-hover/member:block" onClick={() => onRemove(member.id)}>
            移除
          </button>
        ) : null}
      </div>
      <div className={classNames('col-span-3 pt-1', canManage ? 'hidden group-hover/member:block' : member.note ? 'block' : 'hidden')}>
        {canManage ? (
          <Select className="py-2 text-xs" value={member.status} onChange={(e) => onStatusChange(member.id, e.target.value as MemberStatus)}>
            {statusOptions.map((s) => <option key={s}>{s}</option>)}
          </Select>
        ) : null}
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

function GroupStatusPanel({ group, onGroupStatusChange, canManage }: { group: RaidGroup; onGroupStatusChange: Props['onGroupStatusChange']; canManage: boolean }) {
  const raidStatus = getRaidStatusMeta(group);
  const rawStatus = groupStatusOptions.find((x) => x.value === group.status) ?? groupStatusOptions[0];

  return (
    <section className="rounded-[2rem] border border-orange-100 bg-white/85 p-5 shadow-[0_18px_60px_-46px_rgba(124,45,18,0.8)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-950">招募狀態</h3>
            <Pill tone={raidStatus.tone}>{raidStatus.label}</Pill>
            {raidStatus.isAuto ? <Pill tone="yellow">時間自動判定</Pill> : null}
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            手動狀態：{rawStatus.label}。若目前時間已超過「日期 + 時間 / 招募截止時間」，前端會自動顯示為「已結束」。
          </p>
          {raidStatus.isAuto ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
              此團已超過招募時間，因此目前顯示「已結束」。資料庫狀態仍是 open；可在右側手動改成「已結束」固定保存。
            </div>
          ) : null}
        </div>
        <div className="w-full shrink-0 lg:w-64">
          {canManage ? (
            <Select value={group.status} onChange={(e) => onGroupStatusChange(group.id, e.target.value as RaidStatus)}>
              {groupStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label} — {item.helper}</option>)}
            </Select>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-500">團長模式解鎖後可手動修改狀態</div>
          )}
        </div>
      </div>
    </section>
  );
}

function LeaderAccessPanel({ isUnlocked, onUnlock, onLock }: { isUnlocked: boolean; onUnlock: Props['onLeaderUnlock']; onLock: Props['onLeaderLock'] }) {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <section className="rounded-[2rem] border border-orange-100 bg-white/85 p-5 shadow-[0_18px_60px_-46px_rgba(124,45,18,0.8)] backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-slate-950">團長管理</h3>
            <Pill tone={isUnlocked ? 'green' : 'slate'}>{isUnlocked ? '已解鎖' : '一般玩家模式'}</Pill>
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
            一般玩家只能報名。輸入團長管理碼後，才能刪除成員、修改成員狀態、修改招募狀態或刪除團。
          </p>
          {message ? <div className="mt-2 text-sm font-bold text-rose-600">{message}</div> : null}
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row lg:w-[420px]">
          {isUnlocked ? (
            <Button variant="secondary" className="w-full" onClick={onLock}>鎖定團長模式</Button>
          ) : (
            <>
              <input
                type="password"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-2xl border border-orange-100 bg-white/90 px-3.5 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-orange-300 focus:ring-4 focus:ring-orange-100/80"
                placeholder="輸入團長管理碼"
              />
              <Button
                className="shrink-0"
                disabled={checking || code.trim().length < 4}
                onClick={async () => {
                  setChecking(true);
                  setMessage(null);
                  try {
                    await onUnlock(code.trim());
                    setCode('');
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : '管理碼驗證失敗');
                  } finally {
                    setChecking(false);
                  }
                }}
              >
                {checking ? '驗證中' : '解鎖'}
              </Button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export function RaidDetail({ group, onStatusChange, onGroupStatusChange, onRemove, onDelete, isLeaderUnlocked, onLeaderUnlock, onLeaderLock, signupCode = '', onSignupCodeSave, onSignupCodeForget }: Props) {
  const [copied, setCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [signupCodeDraft, setSignupCodeDraft] = useState(signupCode);
  const confirmed = group.members.filter((m) => m.status === '已確認').length;
  const pending = group.members.filter((m) => m.status === '待確認').length;
  const standby = group.members.filter((m) => m.status === '候補').length;
  const bossText = `${group.title} ${group.boss}`;
  const bossArt = getBossArtMeta(bossText);
  const bossDifficulty = getBossDifficultyMeta(bossText);
  const bossVisual = getBossVisualMeta(bossText);
  const raidStatus = getRaidStatusMeta(group);

  const roleCount = useMemo(() => {
    return group.members.reduce<Record<string, number>>((acc, m) => {
      acc[m.role] = (acc[m.role] || 0) + 1;
      return acc;
    }, {});
  }, [group.members]);

  const shareUrl = useMemo(() => {
    const url = new URL(window.location.href);
    url.searchParams.set('group', group.id);
    if (signupCode.trim()) {
      url.searchParams.set('invite', signupCode.trim());
    } else {
      url.searchParams.delete('invite');
      url.searchParams.delete('signupCode');
      url.searchParams.delete('raidCode');
    }
    return url.toString();
  }, [group.id, signupCode]);

  useEffect(() => {
    setSignupCodeDraft(signupCode);
  }, [group.id, signupCode]);

  async function copyShareUrl() {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function copySignupCode() {
    if (!signupCode.trim()) return;
    await navigator.clipboard.writeText(signupCode.trim());
    setCodeCopied(true);
    window.setTimeout(() => setCodeCopied(false), 1600);
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
          {bossArt.image ? <img src={bossArt.image} alt={bossArt.label} className="absolute -right-10 bottom-0 top-0 hidden h-full w-[36%] object-contain opacity-95 drop-shadow-[0_20px_30px_rgba(0,0,0,0.45)] lg:block" /> : null}
          <div className="absolute right-8 top-8 hidden rounded-3xl border border-white/10 bg-black/25 px-4 py-3 text-xs font-black text-orange-100 shadow-2xl backdrop-blur lg:block">Leader Mode UI-V12</div>
          <div className="relative p-6 md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 max-w-4xl">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={classNames('inline-flex items-center rounded-full px-3 py-1 text-xs font-black ring-1', bossVisual.bossPillClass)}>{getBossDisplayName(group.boss)}</span>
                  <span className={classNames('inline-flex items-center rounded-full px-3 py-1 text-xs font-black ring-1', bossVisual.difficultyPillClass)}>{bossDifficulty.label}</span>
                  <Pill tone={raidStatus.tone}>{raidStatus.label}</Pill>
                  {raidStatus.isAuto ? <Pill tone="yellow">自動</Pill> : null}
                </div>
                <div className="mt-5 flex items-start gap-4">
                  <div className={classNames('relative hidden h-24 w-24 shrink-0 overflow-hidden rounded-[1.6rem] border border-white/10 bg-gradient-to-br shadow-2xl ring-2 md:block', bossArt.accent, bossArt.glow, bossDifficulty.ringClass)}>
                    {bossArt.smallImage ? <img src={bossArt.smallImage} alt={`${bossArt.label} ${bossDifficulty.label}`} className="h-full w-full object-cover" /> : bossArt.image ? <img src={bossArt.image} alt={bossArt.label} className="h-full w-full object-cover" /> : null}
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.2),transparent_38%,rgba(15,23,42,0.2)_100%)]" />
                    <span className={classNames('absolute left-2 top-2 rounded-md px-2 py-1 text-[10px] font-black tracking-wide shadow-sm', bossDifficulty.chipClass)}>{bossDifficulty.label}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="truncate text-4xl font-black tracking-tight md:text-5xl">{group.title}</h2>
                      <span className={classNames('inline-flex items-center rounded-full px-3 py-1 text-sm font-black ring-1', bossVisual.difficultyPillClass)}>{bossDifficulty.label}</span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-orange-50/90">
                      <span>📅 {group.raidDate}</span>
                      <span>🕘 {group.raidTime}</span>
                      <span>👤 隊長：{group.leader}</span>
                    </div>
                    <div className="mt-7 flex flex-wrap items-center gap-3">
                      <span className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-black ring-1 ring-white/10">最低等級：{group.minLevel}</span>
                      <Pill tone={raidStatus.tone} className="px-4 py-2">{raidStatus.label}</Pill>
                      <span className="text-sm font-black text-white/90">👥 {group.members.length} / {group.capacity}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button variant="secondary" onClick={copyShareUrl}>{copied ? '已複製' : signupCode.trim() ? '🔗 複製報名連結' : '🔗 複製團連結'}</Button>
                <Button variant="secondary" onClick={exportJson}>匯出 JSON</Button>
                {isLeaderUnlocked ? <Button variant="danger" onClick={() => onDelete(group.id)}>刪除團</Button> : null}
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

        <LeaderAccessPanel isUnlocked={isLeaderUnlocked} onUnlock={onLeaderUnlock} onLock={onLeaderLock} />

        {isLeaderUnlocked ? (
          <section className="rounded-[2rem] border border-orange-100 bg-white/85 p-5 shadow-[0_18px_60px_-46px_rgba(124,45,18,0.8)] backdrop-blur-xl">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0 flex-1">
                <h3 className="text-lg font-black text-slate-950">報名連結邀請碼</h3>
                <p className="mt-1 text-sm font-semibold text-slate-400">團長在這裡儲存報名邀請碼後，複製團連結會自動帶入 invite 參數，玩家開啟後會自動填入報名表單。</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <Input
                    type="password"
                    value={signupCodeDraft}
                    placeholder="輸入此團報名邀請碼"
                    onChange={(e) => setSignupCodeDraft(e.target.value.trim())}
                  />
                  <Button variant="secondary" disabled={signupCodeDraft.trim().length < 4} onClick={() => onSignupCodeSave(signupCodeDraft.trim())}>儲存邀請碼</Button>
                  <Button variant="secondary" disabled={!signupCode.trim()} onClick={copySignupCode}>{codeCopied ? '已複製' : '複製邀請碼'}</Button>
                </div>
                <div className="mt-3 rounded-2xl bg-orange-50 px-4 py-3 text-xs font-semibold leading-6 text-orange-700">
                  這個邀請碼只會儲存在團長目前瀏覽器的 localStorage，不會從資料庫反查明碼。若換裝置管理，請重新輸入一次邀請碼。
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" disabled={!signupCode.trim()} onClick={copyShareUrl}>{copied ? '已複製' : '複製含邀請碼連結'}</Button>
                <Button variant="ghost" disabled={!signupCode.trim()} onClick={onSignupCodeForget}>清除此機邀請碼</Button>
              </div>
            </div>
          </section>
        ) : null}

        <GroupStatusPanel group={group} onGroupStatusChange={onGroupStatusChange} canManage={isLeaderUnlocked} />

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
              <p className="mt-1 text-sm font-semibold text-slate-400">共 3 隊，每隊最多 6 人；一般玩家只能查看與報名，團長模式才可調整狀態或移除。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(roleCount).map(([role, count]) => <Pill key={role}>{role} {count}</Pill>)}
              <Button variant="secondary" className="py-2 text-xs">☷ 查看名單模式</Button>
            </div>
          </div>

          <div className="mt-5 grid gap-4 xl:grid-cols-3">
            {[1, 2, 3].map((partyNo) => {
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
                    {members.map((m) => <MemberRow key={m.id} member={m} onStatusChange={onStatusChange} onRemove={onRemove} canManage={isLeaderUnlocked} />)}
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
