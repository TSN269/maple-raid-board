import { useEffect, useMemo, useState } from 'react';
import { getRaidStatusMeta } from '../data/bossArt';
import { jobOptions, roleOptions } from '../data/options';
import type { NewRaidMember, RaidGroup } from '../types';
import { Button, Field, Input, Pill, Select, Textarea, classNames } from './ui';

type Props = {
  group: RaidGroup;
  onSignup: (member: NewRaidMember) => Promise<void>;
  initialSignupCode?: string;
};

const roleButtons = [
  { value: '打手', icon: '⚔', label: '打手', cls: 'border-rose-200 bg-rose-50 text-rose-700' },
  { value: '控時', icon: '⏱', label: '控時', cls: 'border-violet-200 bg-violet-50 text-violet-700' },
  { value: '火', icon: '🔥', label: '火', cls: 'border-orange-200 bg-orange-50 text-orange-700' },
  { value: '煙霧機', icon: '☁', label: '煙霧機', cls: 'border-slate-200 bg-slate-50 text-slate-700' },
  { value: '輔助', icon: '✚', label: '輔助', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
];

function getPartyCount(capacity: number) {
  return Math.max(1, Math.ceil(Math.max(1, Number(capacity || 1)) / 6));
}

const namePattern = /^[A-Za-z0-9_\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]{2,16}$/;

function getClientNonce() {
  const key = 'maple_raid_board_client_nonce_v13';
  const existing = localStorage.getItem(key);
  if (existing && existing.length >= 16) return existing;
  const next = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem(key, next);
  return next;
}

export function SignupPanel({ group, onSignup, initialSignupCode = '' }: Props) {
  const [saving, setSaving] = useState(false);
  const [clientNonce] = useState(() => getClientNonce());
  const [form, setForm] = useState({
    name: '',
    job: jobOptions[0],
    level: group.minLevel,
    role: roleButtons.some((x) => x.value === roleOptions[0]) ? roleOptions[0] : roleButtons[2].value,
    party: 0,
    status: '待確認' as const,
    note: '',
    signupCode: initialSignupCode,
    website: '',
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      level: Math.max(Number(prev.level || 0), Number(group.minLevel || 1)),
      signupCode: initialSignupCode,
      website: '',
    }));
  }, [group.id, group.minLevel, initialSignupCode]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const raidStatus = getRaidStatusMeta(group);
  const isFull = group.members.length >= group.capacity;
  const partyCount = getPartyCount(group.capacity);
  const selectedParty = form.party === 0 ? Math.max(1, Math.min(partyCount, Math.ceil((group.members.length + 1) / 6))) : Math.max(1, Math.min(partyCount, form.party));

  const validationMessage = useMemo(() => {
    if (!raidStatus.canSignup || isFull) return `目前狀態：${raidStatus.label}，暫停報名。`;
    if (!form.signupCode.trim()) return '請輸入報名邀請碼。';
    if (form.signupCode.trim().length < 4) return '報名邀請碼至少 4 碼。';
    if (!form.name.trim()) return '請輸入角色名稱。';
    if (!namePattern.test(form.name.trim())) return '角色名稱限 2～16 字，可用中文、日文、英文、數字與底線。';
    if (group.members.some((m) => m.name.trim().toLowerCase() === form.name.trim().toLowerCase())) return '此角色已在名單內，請勿重複報名。';
    if (Number(form.level) < Number(group.minLevel)) return `等級低於此團門檻 Lv.${group.minLevel}。`;
    if (Number(form.level) > 300) return '等級不可超過 300。';
    if (form.note.length > 100) return '備註不可超過 100 字。';
    return '';
  }, [form, group.members, group.minLevel, isFull, raidStatus.canSignup, raidStatus.label]);

  const canSignup = !validationMessage;

  return (
    <aside className="rounded-[2rem] border border-orange-100 bg-white/85 p-5 shadow-[0_18px_70px_-48px_rgba(124,45,18,0.9)] backdrop-blur-xl xl:sticky xl:top-24 xl:h-[calc(100vh-112px)] xl:overflow-auto soft-scrollbar">
      <div className="flex items-start justify-between gap-3 border-b border-orange-100 pb-4">
        <div>
          <h3 className="text-2xl font-black text-slate-950">我要報名</h3>
          <p className="mt-1 text-sm font-semibold text-slate-400">輸入邀請碼與角色資訊，送出後由團長確認。</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 text-xl text-orange-600">▣</div>
      </div>

      <div className="mt-5 grid gap-4">
        <Field label="報名邀請碼" required>
          <Input type="password" value={form.signupCode} placeholder="請向團長取得邀請碼" onChange={(e) => set('signupCode', e.target.value.trim())} />
          {initialSignupCode ? (
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              已由團長分享連結自動帶入邀請碼。
            </div>
          ) : null}
        </Field>

        <Field label="角色名稱" required>
          <div className="relative">
            <Input maxLength={16} value={form.name} placeholder="2～16 字，例：阿楓123" onChange={(e) => set('name', e.target.value.trim())} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300">{form.name.length}/16</span>
          </div>
        </Field>

        <Field label="職業" required>
          <Select value={form.job} onChange={(e) => set('job', e.target.value)}>
            {jobOptions.map((j) => <option key={j}>{j}</option>)}
          </Select>
        </Field>

        <Field label="等級" required>
          <Input type="number" min="1" max="300" value={form.level} onChange={(e) => set('level', Math.min(300, Math.max(1, Number(e.target.value))))} />
        </Field>

        <Field label="角色定位" required>
          <div className="grid grid-cols-2 gap-2">
            {roleButtons.map((role) => {
              const active = form.role === role.value;
              return (
                <button
                  type="button"
                  key={role.value}
                  onClick={() => set('role', role.value)}
                  className={classNames(
                    'rounded-2xl border px-3 py-3 text-sm font-black transition hover:-translate-y-0.5',
                    role.cls,
                    active ? 'ring-2 ring-orange-300 ring-offset-2' : 'opacity-80 hover:opacity-100',
                  )}
                >
                  <span className="mr-2">{role.icon}</span>{role.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="希望加入的隊伍">
          <Select value={form.party} onChange={(e) => set('party', Number(e.target.value))}>
            <option value={0}>不指定（由系統暫分）</option>
            {Array.from({ length: partyCount }, (_, index) => index + 1).map((n) => <option key={n} value={n}>隊伍 {n}</option>)}
          </Select>
        </Field>

        <Field label="備註（選填）">
          <div className="relative">
            <Textarea maxLength={100} value={form.note} placeholder="有想說的話可以在這裡告訴隊長～" onChange={(e) => set('note', e.target.value)} />
            <span className="absolute bottom-3 right-3 text-xs font-bold text-slate-300">{form.note.length}/100</span>
          </div>
        </Field>

        <div className="hidden" aria-hidden="true">
          <label>
            Website
            <input tabIndex={-1} autoComplete="off" value={form.website} onChange={(e) => set('website', e.target.value)} />
          </label>
        </div>

        <div className={classNames('rounded-2xl border px-4 py-3 text-sm font-semibold leading-6', canSignup ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-700')}>
          {canSignup ? 'ⓘ 已通過前端檢查；送出後資料庫仍會再驗證邀請碼、重複角色與送出頻率。' : validationMessage}
        </div>

        <Button
          className="w-full py-4 text-base"
          disabled={saving || !canSignup}
          onClick={async () => {
            setSaving(true);
            try {
              await onSignup({
                ...form,
                party: selectedParty,
                groupId: group.id,
                signupCode: form.signupCode.trim(),
                clientNonce,
                honeypot: form.website,
              });
              setForm((prev) => ({ ...prev, name: '', note: '', signupCode: initialSignupCode, website: '' }));
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? '送出中' : '✈ 送出報名'}
        </Button>

        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <span><Pill tone={raidStatus.tone}>{raidStatus.label}</Pill></span>
          <span>預計加入：隊伍 {selectedParty}</span>
        </div>
      </div>
    </aside>
  );
}
