import type { RaidGroup } from '../types';
import { Input, Pill, classNames } from './ui';

type Props = {
  groups: RaidGroup[];
  selectedId?: string;
  query: string;
  setQuery: (value: string) => void;
  onSelect: (id: string) => void;
};

export function RaidList({ groups, selectedId, query, setQuery, onSelect }: Props) {
  const filtered = groups.filter((g) => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return true;
    return [g.title, g.boss, g.leader, g.notice].some((x) => String(x || '').toLowerCase().includes(keyword));
  });

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:h-[calc(100vh-2rem)] lg:overflow-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-bold text-slate-950">突襲場次</h2>
          <p className="text-xs text-slate-500">選一團查看與報名</p>
        </div>
        <Pill tone="blue">{groups.length} 團</Pill>
      </div>
      <div className="mt-4">
        <Input value={query} placeholder="搜尋 Boss / 團長 / 公告" onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="mt-4 grid gap-3">
        {filtered.map((group) => {
          const confirmed = group.members.filter((m) => m.status === '已確認').length;
          const standby = group.members.filter((m) => m.status === '候補').length;
          return (
            <button
              key={group.id}
              onClick={() => onSelect(group.id)}
              className={classNames(
                'w-full rounded-2xl border p-4 text-left transition hover:border-slate-300 hover:bg-slate-50',
                selectedId === group.id ? 'border-slate-950 bg-slate-50' : 'border-slate-200 bg-white',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold text-slate-950">{group.title}</div>
                  <div className="mt-1 text-sm text-slate-500">{group.boss}</div>
                </div>
                <Pill tone={group.members.length >= group.capacity ? 'red' : 'green'}>{group.members.length}/{group.capacity}</Pill>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                <div>時間：{group.raidDate} {group.raidTime}</div>
                <div>團長：{group.leader}</div>
                <div>已確認：{confirmed}</div>
                <div>候補：{standby}</div>
              </div>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
