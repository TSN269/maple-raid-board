import { useState } from 'react';
import { buildBossStorageValue, getBossArtMeta, getBossDifficultyMeta, getBossDisplayName, getBossVisualMeta } from '../data/bossArt';
import { bossOptions, difficultyOptions } from '../data/options';
import type { ImportedRaidMemberDraft, NewRaidGroup, TeamFavorite } from '../types';
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
  onCreate: (group: NewRaidGroup, importedMembers?: ImportedRaidMemberDraft[]) => Promise<void>;
  teamFavorites: TeamFavorite[];
};

export function CreateRaidModal({ onClose, onCreate, teamFavorites }: Props) {
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

  const [showTeamFavoritePicker, setShowTeamFavoritePicker] = useState(false);
  const [selectedTeamFavoriteIds, setSelectedTeamFavoriteIds] = useState<string[]>([]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const selectedTeamFavorites = teamFavorites.filter((favorite) => selectedTeamFavoriteIds.includes(favorite.id));
  const importedMembers: ImportedRaidMemberDraft[] = selectedTeamFavorites.flatMap((favorite) => favorite.members.map((member) => ({
    name: member.name,
    job: member.job,
    level: member.level,
    role: member.role,
    party: favorite.party,
    status: member.status,
    note: member.note,
  })));
  const importedMemberCount = importedMembers.length;

  function toggleTeamFavorite(favorite: TeamFavorite) {
    setSelectedTeamFavoriteIds((prev) => {
      const exists = prev.includes(favorite.id);
      const next = exists ? prev.filter((id) => id !== favorite.id) : [...prev, favorite.id];
      if (!exists) {
        const nextCount = teamFavorites
          .filter((item) => next.includes(item.id))
          .reduce((sum, item) => sum + item.members.length, 0);
        setForm((formPrev) => ({ ...formPrev, capacity: Math.min(18, Math.max(Number(formPrev.capacity || 1), nextCount || 1)) }));
      }
      return next;
    });
  }

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
          <div className="md:col-span-2 rounded-3xl border border-orange-100 bg-white/90 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-black text-slate-950">隊伍收藏名單</div>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">可直接帶入左側「隊伍收藏」保存的隊伍名單，建立場次後自動加入成員。</p>
              </div>
              <Button type="button" variant="secondary" onClick={() => setShowTeamFavoritePicker((prev) => !prev)} disabled={teamFavorites.length === 0}>
                {teamFavorites.length === 0 ? '尚無隊伍收藏' : `帶入隊伍收藏${importedMemberCount > 0 ? `（${importedMemberCount}人）` : ''}`}
              </Button>
            </div>

            {showTeamFavoritePicker ? (
              <div className="mt-4 grid gap-3">
                {teamFavorites.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-orange-100 bg-orange-50/70 p-4 text-sm font-semibold text-slate-500">尚無可帶入的隊伍收藏。</div>
                ) : teamFavorites.map((favorite) => {
                  const selected = selectedTeamFavoriteIds.includes(favorite.id);
                  return (
                    <button
                      key={favorite.id}
                      type="button"
                      onClick={() => toggleTeamFavorite(favorite)}
                      className={`rounded-2xl border p-3 text-left transition ${selected ? 'border-orange-300 bg-orange-50 ring-2 ring-orange-200' : 'border-orange-100 bg-white hover:bg-orange-50/60'}`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="font-black text-slate-900">{favorite.groupTitle} · 隊伍 {favorite.party}</div>
                        <div className="text-xs font-black text-orange-700">{selected ? '已選擇' : '點選帶入'}</div>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                        <span>{getBossDisplayName(favorite.boss)}</span>
                        <span>{favorite.raidDate} {favorite.raidTime}</span>
                        <span>{favorite.members.length} 人</span>
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs font-semibold text-slate-500">
                        {favorite.members.map((member) => member.name).join('、') || '無成員'}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            {importedMemberCount > 0 ? (
              <div className="mt-3 rounded-2xl bg-orange-50 px-3 py-2 text-xs font-bold text-orange-700">
                已選擇 {selectedTeamFavorites.length} 隊，共 {importedMemberCount} 位成員。建立場次後會自動帶入隊伍名單。
              </div>
            ) : null}
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
                  capacity: Math.min(18, Math.max(1, Number(payload.capacity || 18), importedMemberCount || 1)),
                  boss: buildBossStorageValue(payload.boss, difficulty),
                  id: slugify(`${payload.title}-${difficulty}` || payload.boss),
                  status: 'open',
                }, importedMembers);
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
