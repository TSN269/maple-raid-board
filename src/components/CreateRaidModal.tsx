import { useState } from 'react';
import { buildBossStorageValue, getBossArtMeta, getBossDifficultyMeta, getBossDisplayName, getBossVisualMeta } from '../data/bossArt';
import { bossOptions, difficultyOptions } from '../data/options';
import type { NewRaidGroup } from '../types';
import { Button, Field, Input, Select, Textarea } from './ui';

function getDateOffset(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function slugify(text: string) {
  const base = String(text || 'raid')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9\-\u4e00-\u9fa5]/g, '')
    .replace(/-+/g, '-')
    .slice(0, 28);
  return `${base || 'raid'}-${Math.random().toString(36).slice(2, 7)}`;
}

type Props = {
  onClose: () => void;
  onCreate: (group: NewRaidGroup) => Promise<void>;
};

export function CreateRaidModal({ onClose, onCreate }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    boss: bossOptions[0],
    difficulty: difficultyOptions[1],
    raidDate: getDateOffset(1),
    raidTime: '22:00',
    leader: '',
    minLevel: 90,
    capacity: 18,
    leaderCode: '',
    signupCode: '',
    notice: '',
  });

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const previewText = `${form.boss} ${form.difficulty}`;
  const bossArt = getBossArtMeta(previewText);
  const difficultyMeta = getBossDifficultyMeta(previewText);
  const visualMeta = getBossVisualMeta(previewText);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-auto rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-950">新增突襲場次</h2>
            <p className="mt-1 text-sm text-slate-500">建立後會產生可分享的 group 連結。</p>
          </div>
          <Button variant="ghost" onClick={onClose}>關閉</Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="標題">
            <Input value={form.title} placeholder="例：炎魔固定團 - 週六" onChange={(e) => set('title', e.target.value)} />
          </Field>
          <Field label="Boss">
            <Select value={form.boss} onChange={(e) => set('boss', e.target.value)}>
              {bossOptions.map((b) => <option key={b}>{b}</option>)}
            </Select>
          </Field>
          <Field label="難度">
            <Select value={form.difficulty} onChange={(e) => set('difficulty', e.target.value as (typeof form)['difficulty'])}>
              {difficultyOptions.map((d) => <option key={d}>{d}</option>)}
            </Select>
          </Field>
          <div className="md:col-span-2 rounded-3xl border border-orange-100 bg-orange-50/60 p-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">顯示預覽</div>
            <div className="mt-3 flex items-center gap-4">
              <div className={`relative h-16 w-16 overflow-hidden rounded-3xl bg-gradient-to-br shadow-xl ring-2 ${bossArt.accent} ${bossArt.glow} ${difficultyMeta.ringClass}`}>
                {bossArt.smallImage ? <img src={bossArt.smallImage} alt={bossArt.label} className="h-full w-full object-cover" /> : null}
                <span className={`absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-black tracking-wide shadow-sm ${difficultyMeta.chipClass}`}>{form.difficulty}</span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${visualMeta.bossPillClass}`}>{getBossDisplayName(form.boss)}</span>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1 ${visualMeta.difficultyPillClass}`}>{form.difficulty}</span>
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-600">BOSS 與難度會分開顯示；團長管理碼給管理用，報名邀請碼給玩家報名用。</div>
              </div>
            </div>
          </div>
          <Field label="日期">
            <Input type="date" value={form.raidDate} onChange={(e) => set('raidDate', e.target.value)} />
          </Field>
          <Field label="時間 / 招募截止時間">
            <Input type="time" value={form.raidTime} onChange={(e) => set('raidTime', e.target.value)} />
          </Field>
          <Field label="團長">
            <Input value={form.leader} placeholder="角色名或暱稱" onChange={(e) => set('leader', e.target.value)} />
          </Field>
          <Field label="團長管理碼">
            <Input type="password" value={form.leaderCode} placeholder="至少 4 碼，用於管理此團" onChange={(e) => set('leaderCode', e.target.value.trim())} />
          </Field>
          <Field label="報名邀請碼">
            <Input type="password" value={form.signupCode} placeholder="至少 4 碼，玩家報名時需要輸入" onChange={(e) => set('signupCode', e.target.value.trim())} />
          </Field>
          <Field label="最低等級">
            <Input type="number" min="1" value={form.minLevel} onChange={(e) => set('minLevel', Number(e.target.value))} />
          </Field>
          <Field label="名額上限">
            <Select value={form.capacity} onChange={(e) => set('capacity', Number(e.target.value))}>
              {Array.from({ length: 18 }, (_, index) => index + 1).map((n) => (
                <option key={n} value={n}>{n} 人</option>
              ))}
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="公告">
              <Textarea value={form.notice} placeholder="集合地點、藥水、語音、分配規則..." onChange={(e) => set('notice', e.target.value)} />
            </Field>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button
            disabled={saving || !form.title.trim() || !form.leader.trim() || form.leaderCode.trim().length < 4 || form.signupCode.trim().length < 4}
            onClick={async () => {
              setSaving(true);
              try {
                const { difficulty, ...payload } = form;
                await onCreate({
                  ...payload,
                  capacity: Math.min(18, Math.max(1, Number(payload.capacity || 18))),
                  boss: buildBossStorageValue(payload.boss, difficulty),
                  id: slugify(`${payload.title}-${difficulty}` || payload.boss),
                  status: 'open',
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? '建立中' : '建立場次'}
          </Button>
        </div>
      </div>
    </div>
  );
}
