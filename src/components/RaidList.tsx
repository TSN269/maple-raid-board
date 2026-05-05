import { useMemo, useState } from 'react';
import { getBossArtMeta, getBossDifficultyMeta, getBossDisplayName, getBossVisualMeta, getRaidStatusMeta } from '../data/bossArt';
import type { RaidGroup } from '../types';
import { Pill, classNames } from './ui';

type Props = {
  groups: RaidGroup[];
  selectedId?: string;
  query: string;
  setQuery: (value: string) => void;
  onSelect: (id: string) => void;
};

export function RaidList({ groups, selectedId, query, onSelect }: Props) {
  const [difficultyFilter, setDifficultyFilter] = useState<'ALL' | 'NORMAL' | 'HARD'>('ALL');

  const filtered = useMemo(() => groups.filter((g) => {
    const keyword = query.trim().toLowerCase();
    const difficulty = getBossDifficultyMeta(`${g.title} ${g.boss}`).label;
    const queryMatched = !keyword || [g.title, g.boss, g.leader, g.notice].some((x) => String(x || '').toLowerCase().includes(keyword));
    const difficultyMatched = difficultyFilter === 'ALL' || difficulty === difficultyFilter;
    return queryMatched && difficultyMatched;
  }), [groups, query, difficultyFilter]);

  return (
    <aside className="rounded-[2rem] border border-orange-100/80 bg-white/75 p-4 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl lg:sticky lg:top-24 lg:h-[calc(100vh-112px)] lg:overflow-auto soft-scrollbar">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-lg font-black text-slate-950">突襲場次</h2>
          <p className="text-xs font-semibold text-slate-400">選一團查看與報名</p>
        </div>
        <span className="grid h-7 min-w-7 place-items-center rounded-full bg-slate-100 px-2 text-xs font-black text-slate-500">{groups.length}</span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 px-1">
        {(['ALL', 'NORMAL', 'HARD'] as const).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setDifficultyFilter(item)}
            className={classNames(
              'rounded-full px-3 py-1.5 text-xs font-black ring-1 transition',
              difficultyFilter === item
                ? item === 'ALL'
                  ? 'bg-slate-900 text-white ring-slate-700'
                  : item === 'NORMAL'
                    ? 'bg-emerald-500 text-white ring-emerald-300'
                    : 'bg-rose-600 text-white ring-rose-300'
                : 'bg-white text-slate-500 ring-orange-100 hover:bg-orange-50 hover:text-orange-700',
            )}
          >
            {item === 'ALL' ? '全部難度' : item}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        {filtered.map((group) => {
          const confirmed = group.members.filter((m) => m.status === '已確認').length;
          const bossText = `${group.title} ${group.boss}`;
          const bossArt = getBossArtMeta(bossText);
          const bossDifficulty = getBossDifficultyMeta(bossText);
          const bossVisual = getBossVisualMeta(bossText);
          const raidStatus = getRaidStatusMeta(group);
          const selected = selectedId === group.id;

          return (
            <button
              key={group.id}
              onClick={() => onSelect(group.id)}
              className={classNames(
                'group w-full rounded-3xl border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:bg-white hover:shadow-lg hover:shadow-orange-200/25',
                selected ? 'border-orange-300 bg-orange-50/70 shadow-lg shadow-orange-200/30' : classNames('bg-white/70', bossVisual.cardBorderClass),
              )}
            >
              <div className="flex gap-3">
                <div className={classNames('relative h-16 w-16 shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br shadow-xl ring-2', bossArt.accent, bossArt.glow, bossDifficulty.ringClass)}>
                  {bossArt.smallImage ? (
                    <img src={bossArt.smallImage} alt={`${bossArt.label} ${bossDifficulty.label}`} className="h-full w-full object-cover" />
                  ) : bossArt.image ? (
                    <img src={bossArt.image} alt={bossArt.label} className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xl font-black text-white">{bossArt.label.slice(0, 1)}</div>
                  )}
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.16),transparent_35%,rgba(15,23,42,0.18)_100%)]" />
                  <span className={classNames('absolute left-1.5 top-1.5 rounded-md px-1.5 py-0.5 text-[9px] font-black tracking-wide shadow-sm', bossDifficulty.chipClass)}>{bossDifficulty.label}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="truncate text-sm font-black text-slate-950">{group.title}</div>
                        <span className={classNames('inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-black ring-1', bossVisual.difficultyPillClass)}>{bossDifficulty.label}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
                        <span className={classNames('inline-flex items-center rounded-full px-2 py-1 text-[11px] font-bold ring-1', bossVisual.bossPillClass)}>{getBossDisplayName(group.boss)}</span>
                        <span>{group.raidDate}　{group.raidTime}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">隊長：{group.leader}</div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                      {group.members.length} / {group.capacity}
                    </div>
                    <Pill tone={raidStatus.tone}>{raidStatus.label}</Pill>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-orange-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-emerald-400" style={{ width: `${Math.min(100, Math.round((confirmed / Math.max(1, group.capacity)) * 100))}%` }} />
                  </div>
                </div>
              </div>
            </button>
          );
        })}

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50/70 p-6 text-center text-sm font-semibold text-orange-700">找不到符合搜尋或難度篩選的場次</div>
        ) : null}
      </div>
    </aside>
  );
}
