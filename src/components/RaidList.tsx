import type { RaidGroup } from '../types';
import { Pill, classNames } from './ui';

type Props = {
  groups: RaidGroup[];
  selectedId?: string;
  query: string;
  setQuery: (value: string) => void;
  onSelect: (id: string) => void;
};

const bossPalette = [
  'from-red-950 via-red-800 to-orange-600',
  'from-violet-950 via-indigo-800 to-fuchsia-500',
  'from-rose-900 via-pink-700 to-orange-400',
  'from-slate-950 via-slate-800 to-red-500',
  'from-emerald-950 via-green-800 to-lime-500',
  'from-zinc-950 via-stone-800 to-amber-600',
  'from-blue-950 via-sky-800 to-cyan-500',
];

function bossInitial(group: RaidGroup) {
  const source = group.boss || group.title || '?';
  return source.replace(/\s+/g, '').slice(0, 1).toUpperCase();
}

function difficultyTone(group: RaidGroup) {
  const text = `${group.title} ${group.boss}`;
  if (/困難|hard|chaos/i.test(text)) return 'orange';
  if (/普通|normal/i.test(text)) return 'purple';
  return 'slate';
}

function statusText(group: RaidGroup) {
  if (group.members.length >= group.capacity) return '額滿';
  if (group.status === 'closed') return '關閉';
  if (group.status === 'finished') return '結束';
  return '招募中';
}

export function RaidList({ groups, selectedId, query, onSelect }: Props) {
  const filtered = groups.filter((g) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    return [g.title, g.boss, g.leader, g.notice].some((x) => String(x || '').toLowerCase().includes(keyword));
  });

  return (
    <aside className="rounded-[2rem] border border-orange-100/80 bg-white/75 p-4 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl lg:sticky lg:top-24 lg:h-[calc(100vh-112px)] lg:overflow-auto soft-scrollbar">
      <div className="flex items-center justify-between gap-3 px-1">
        <div>
          <h2 className="text-lg font-black text-slate-950">突襲場次</h2>
          <p className="text-xs font-semibold text-slate-400">選一團查看與報名</p>
        </div>
        <span className="grid h-7 min-w-7 place-items-center rounded-full bg-slate-100 px-2 text-xs font-black text-slate-500">{groups.length}</span>
      </div>

      <div className="mt-4 grid gap-3">
        {filtered.map((group, index) => {
          const confirmed = group.members.filter((m) => m.status === '已確認').length;
          const palette = bossPalette[index % bossPalette.length];
          const selected = selectedId === group.id;
          return (
            <button
              key={group.id}
              onClick={() => onSelect(group.id)}
              className={classNames(
                'group w-full rounded-3xl border p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-orange-200 hover:bg-white hover:shadow-lg hover:shadow-orange-200/25',
                selected ? 'border-orange-300 bg-orange-50/70 shadow-lg shadow-orange-200/30' : 'border-orange-100/70 bg-white/70',
              )}
            >
              <div className="flex gap-3">
                <div className={classNames('relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-3xl bg-gradient-to-br text-xl font-black text-white shadow-inner', palette)}>
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.35),transparent_32%),radial-gradient(circle_at_70%_80%,rgba(0,0,0,0.35),transparent_44%)]" />
                  <span className="relative">{bossInitial(group)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-950">{group.title}</div>
                      <div className="mt-1 truncate text-xs font-semibold text-slate-500">{group.raidDate}　{group.raidTime}</div>
                    </div>
                    <Pill tone={difficultyTone(group)}>{difficultyTone(group) === 'orange' ? '困難' : difficultyTone(group) === 'purple' ? '普通' : '活動'}</Pill>
                  </div>
                  <div className="mt-1 truncate text-xs text-slate-500">隊長：{group.leader}</div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                      {group.members.length} / {group.capacity}
                    </div>
                    <Pill tone={group.members.length >= group.capacity ? 'red' : 'green'}>{statusText(group)}</Pill>
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
          <div className="rounded-3xl border border-dashed border-orange-200 bg-orange-50/70 p-6 text-center text-sm font-semibold text-orange-700">找不到符合搜尋的場次</div>
        ) : null}
      </div>

      <button className="mt-4 w-full rounded-2xl border border-orange-100 bg-white/70 px-4 py-3 text-sm font-bold text-slate-500 transition hover:bg-orange-50 hover:text-orange-700">
        載入更多場次⌄
      </button>
    </aside>
  );
}
