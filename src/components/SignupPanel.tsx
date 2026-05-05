import { useEffect, useState } from 'react';
import { jobOptions, roleOptions } from '../data/options';
import type { NewRaidMember, RaidGroup } from '../types';
import { Button, Field, Input, Pill, Select, Textarea } from './ui';

type Props = {
  group: RaidGroup;
  onSignup: (member: NewRaidMember) => Promise<void>;
};

export function SignupPanel({ group, onSignup }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: '',
    job: jobOptions[0],
    level: group.minLevel,
    role: roleOptions[0],
    party: 1,
    status: '待確認' as const,
    note: '',
  });

  useEffect(() => {
    setForm((prev) => ({ ...prev, level: Math.max(Number(prev.level || 0), Number(group.minLevel || 1)) }));
  }, [group.id, group.minLevel]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const isFull = group.members.length >= group.capacity;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-slate-950">我要報名</h3>
          <p className="mt-1 text-sm text-slate-500">送出後會寫入 Supabase。</p>
        </div>
        {isFull ? <Pill tone="red">已滿</Pill> : <Pill tone="green">可報名</Pill>}
      </div>

      <div className="mt-4 grid gap-3">
        <Field label="角色名稱">
          <Input value={form.name} placeholder="輸入遊戲 ID" onChange={(e) => set('name', e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="職業">
            <Select value={form.job} onChange={(e) => set('job', e.target.value)}>
              {jobOptions.map((j) => <option key={j}>{j}</option>)}
            </Select>
          </Field>
          <Field label="等級">
            <Input type="number" min="1" value={form.level} onChange={(e) => set('level', Number(e.target.value))} />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="定位">
            <Select value={form.role} onChange={(e) => set('role', e.target.value)}>
              {roleOptions.map((r) => <option key={r}>{r}</option>)}
            </Select>
          </Field>
          <Field label="隊伍">
            <Select value={form.party} onChange={(e) => set('party', Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>第 {n} 隊</option>)}
            </Select>
          </Field>
        </div>
        <Field label="備註">
          <Textarea value={form.note} placeholder="例：第一次打、可語音、會晚 5 分鐘" onChange={(e) => set('note', e.target.value)} />
        </Field>
        <Button
          disabled={saving || isFull || !form.name.trim() || Number(form.level) < Number(group.minLevel)}
          onClick={async () => {
            setSaving(true);
            try {
              await onSignup({ ...form, groupId: group.id });
              setForm((prev) => ({ ...prev, name: '', note: '' }));
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? '送出中' : '送出報名'}
        </Button>
        {Number(form.level) < Number(group.minLevel) ? (
          <div className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-700">等級低於此團門檻 Lv.{group.minLevel}。</div>
        ) : null}
      </div>
    </div>
  );
}
