import { useEffect, useState } from 'react';
import { getRaidStatusMeta } from '../data/bossArt';
import { jobOptions, roleOptions } from '../data/options';
import type { NewRaidMember, RaidGroup } from '../types';
import { Button, Field, Input, Pill, Select, Textarea, classNames } from './ui';

type Props = {
  group: RaidGroup;
  onSignup: (member: NewRaidMember) => Promise<void>;
};

const roleButtons = [
  { value: '主坦', icon: '🛡', label: '主坦', cls: 'border-slate-200 bg-slate-50 text-slate-700' },
  { value: '副坦', icon: '🛡', label: '副坦', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  { value: '輸出', icon: '⚔', label: '輸出', cls: 'border-rose-200 bg-rose-50 text-rose-700' },
  { value: '補師', icon: '✚', label: '補師', cls: 'border-sky-200 bg-sky-50 text-sky-700' },
];

export function SignupPanel({ group, onSignup }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    job: jobOptions[0],
    level: group.minLevel,
    role: roleButtons.some((x) => x.value === roleOptions[0]) ? roleOptions[0] : roleButtons[2].value,
    party: 0,
    status: '待確認' as const,
    note: '',
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, level: Math.max(Number(prev.level || 0), Number(group.minLevel || 1)) }));
  }, [group.id, group.minLevel]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const raidStatus = getRaidStatusMeta(group);
  const isFull = group.members.length >= group.capacity;
  const canSignup = raidStatus.canSignup && !isFull;
  const selectedParty = form.party === 0 ? Math.max(1, Math.min(3, Math.ceil((group.members.length + 1) / 6))) : form.party;

  return (
    <aside className="rounded-[2rem] border border-orange-100 bg-white/85 p-5 shadow-[0_18px_70px_-48px_rgba(124,45,18,0.9)] backdrop-blur-xl xl:sticky xl:top-24 xl:h-[calc(100vh-112px)] xl:overflow-auto soft-scrollbar">
      <div className="flex items-start justify-between gap-3 border-b border-orange-100 pb-4">
        <div>
          <h3 className="text-2xl font-black text-slate-950">我要報名</h3>
          <p className="mt-1 text-sm font-semibold text-slate-400">填寫角色資訊，加入這場突襲！</p>
        </div>
        <div className="grid h-10 w-10 place-items-center rounded-2xl bg-orange-50 text-xl text-orange-600">▣</div>
      </div>

      <div className="mt-5 grid gap-4">
        <Field label="角色名稱" required>
          <div className="relative">
            <Input maxLength={12} value={form.name} placeholder="請輸入角色名稱" onChange={(e) => set('name', e.target.value)} />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-300">{form.name.length}/12</span>
          </div>
        </Field>

        <Field label="職業" required>
          <Select value={form.job} onChange={(e) => set('job', e.target.value)}>
            {jobOptions.map((j) => <option key={j}>{j}</option>)}
          </Select>
        </Field>

        <Field label="等級" required>
          <Input type="number" min="1" value={form.level} onChange={(e) => set('level', Number(e.target.value))} />
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
            {[1, 2, 3].map((n) => <option key={n} value={n}>隊伍 {n}</option>)}
          </Select>
        </Field>

        <Field label="備註（選填）">
          <div className="relative">
            <Textarea maxLength={100} value={form.note} placeholder="有想說的話可以在這裡告訴隊長～" onChange={(e) => set('note', e.target.value)} />
            <span className="absolute bottom-3 right-3 text-xs font-bold text-slate-300">{form.note.length}/100</span>
          </div>
        </Field>

        <div className={classNames('rounded-2xl border px-4 py-3 text-sm font-semibold leading-6', canSignup ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-rose-200 bg-rose-50 text-rose-700')}>
          {canSignup ? 'ⓘ 報名後需經隊長確認，狀態將顯示於名單中。' : `目前狀態：${raidStatus.label}，暫停報名。`}
        </div>

        <Button
          className="w-full py-4 text-base"
          disabled={saving || !canSignup || !form.name.trim() || Number(form.level) < Number(group.minLevel)}
          onClick={async () => {
            setSaving(true);
            try {
              await onSignup({ ...form, party: selectedParty, groupId: group.id });
              setForm((prev) => ({ ...prev, name: '', note: '' }));
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

        {Number(form.level) < Number(group.minLevel) ? (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">等級低於此團門檻 Lv.{group.minLevel}。</div>
        ) : null}
      </div>
    </aside>
  );
}
