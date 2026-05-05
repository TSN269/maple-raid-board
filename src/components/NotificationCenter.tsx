import { useMemo } from 'react';
import type { RaidGroup } from '../types';
import { getBossDisplayName, getBossDifficultyMeta, getBossVisualMeta, getRaidDateTime, getRaidStatusMeta } from '../data/bossArt';
import { Button, Pill, classNames } from './ui';

export type RaidNotificationType = 'raid_reminder' | 'status_change' | 'standby_promoted' | 'standby_waiting' | 'system';
export type RaidNotificationPriority = 'high' | 'medium' | 'low';

export type RaidNotification = {
  id: string;
  type: RaidNotificationType;
  priority: RaidNotificationPriority;
  groupId?: string;
  memberId?: string;
  title: string;
  description: string;
  createdAt: string;
  read?: boolean;
};

type Props = {
  groups: RaidGroup[];
  selectedId?: string;
  notifications: RaidNotification[];
  readIds: string[];
  onSelectGroup: (groupId: string) => void;
  onGoRaid: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearLocalEvents: () => void;
};

const typeMeta: Record<RaidNotificationType, { label: string; icon: string; tone: 'green' | 'yellow' | 'red' | 'blue' | 'purple' | 'orange' | 'slate' }> = {
  raid_reminder: { label: '開團提醒', icon: '⏰', tone: 'orange' },
  status_change: { label: '狀態變更', icon: '↻', tone: 'blue' },
  standby_promoted: { label: '候補轉正', icon: '✓', tone: 'green' },
  standby_waiting: { label: '候補名單', icon: '…', tone: 'yellow' },
  system: { label: '系統通知', icon: '●', tone: 'slate' },
};

function formatRelativeTime(iso: string) {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return '剛剛';
  const diff = Date.now() - time;
  if (diff < 60_000) return '剛剛';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分鐘前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小時前`;
  return `${Math.floor(diff / 86_400_000)} 天前`;
}

function formatRaidTime(group: RaidGroup) {
  const raidAt = getRaidDateTime(group);
  if (!raidAt) return `${group.raidDate} ${group.raidTime}`;
  return raidAt.toLocaleString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function severityClass(priority: RaidNotificationPriority, unread: boolean) {
  if (priority === 'high') return unread ? 'border-rose-200 bg-rose-50/80' : 'border-rose-100 bg-white/75';
  if (priority === 'medium') return unread ? 'border-amber-200 bg-amber-50/80' : 'border-amber-100 bg-white/75';
  return unread ? 'border-sky-200 bg-sky-50/80' : 'border-orange-100 bg-white/75';
}

export function buildDerivedNotifications(groups: RaidGroup[], now = new Date()): RaidNotification[] {
  const result: RaidNotification[] = [];

  for (const group of groups) {
    const raidAt = getRaidDateTime(group);
    const status = getRaidStatusMeta(group, now);
    const boss = getBossDisplayName(group.boss);
    const difficulty = getBossDifficultyMeta(`${group.title} ${group.boss}`).label;
    const titlePrefix = `${group.title} ${difficulty}`;

    if (raidAt && status.effectiveStatus !== 'finished') {
      const diffMs = raidAt.getTime() - now.getTime();
      if (diffMs > 0 && diffMs <= 60 * 60 * 1000) {
        result.push({
          id: `reminder-1h-${group.id}`,
          type: 'raid_reminder',
          priority: 'high',
          groupId: group.id,
          title: '即將開團',
          description: `${titlePrefix} 將在 1 小時內開始。Boss：${boss}，時間：${formatRaidTime(group)}。`,
          createdAt: new Date(raidAt.getTime() - 60 * 60 * 1000).toISOString(),
        });
      } else if (diffMs > 0 && diffMs <= 24 * 60 * 60 * 1000) {
        result.push({
          id: `reminder-24h-${group.id}`,
          type: 'raid_reminder',
          priority: 'medium',
          groupId: group.id,
          title: '24 小時內開團',
          description: `${titlePrefix} 將於 ${formatRaidTime(group)} 開始。`,
          createdAt: new Date(raidAt.getTime() - 24 * 60 * 60 * 1000).toISOString(),
        });
      }
    }

    if (status.effectiveStatus === 'closed') {
      result.push({
        id: `status-closed-${group.id}`,
        type: 'status_change',
        priority: 'medium',
        groupId: group.id,
        title: '招募已截止',
        description: `${titlePrefix} 目前狀態為「${status.label}」，一般玩家不能再報名。`,
        createdAt: group.updatedAt || group.createdAt,
      });
    }

    if (status.effectiveStatus === 'finished') {
      result.push({
        id: `status-finished-${group.id}`,
        type: 'status_change',
        priority: 'low',
        groupId: group.id,
        title: status.isAuto ? '已過開團時間' : '突襲已結束',
        description: `${titlePrefix} 顯示為「已結束」。`,
        createdAt: group.updatedAt || group.createdAt,
      });
    }

    const standby = group.members.filter((m) => m.status === '候補');
    if (standby.length > 0 && status.effectiveStatus === 'open') {
      result.push({
        id: `standby-waiting-${group.id}-${standby.length}`,
        type: 'standby_waiting',
        priority: 'low',
        groupId: group.id,
        title: '有候補成員待處理',
        description: `${titlePrefix} 目前有 ${standby.length} 位候補。若有空位，團長可到「楓突襲」調整狀態。`,
        createdAt: group.updatedAt || group.createdAt,
      });
    }
  }

  return result;
}

export function NotificationCenter({ groups, selectedId, notifications, readIds, onSelectGroup, onGoRaid, onMarkRead, onMarkAllRead, onClearLocalEvents }: Props) {
  const unreadCount = notifications.filter((n) => !readIds.includes(n.id)).length;
  const grouped = useMemo(() => {
    const sorted = [...notifications].sort((a, b) => {
      const priorityWeight = { high: 0, medium: 1, low: 2 } as const;
      const priorityDiff = priorityWeight[a.priority] - priorityWeight[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return sorted;
  }, [notifications]);

  const selectedGroup = selectedId ? groups.find((g) => g.id === selectedId) : undefined;

  return (
    <main className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-[2rem] border border-orange-100/80 bg-white/80 p-5 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-black text-slate-950">通知中心</h2>
              {unreadCount > 0 ? <Pill tone="red">未讀 {unreadCount}</Pill> : <Pill tone="green">已讀完</Pill>}
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">整合開團提醒、招募狀態變更、候補轉正與候補待處理通知。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={onMarkAllRead} disabled={notifications.length === 0}>全部標為已讀</Button>
            <Button variant="ghost" onClick={onClearLocalEvents}>清除本機事件</Button>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {grouped.length === 0 ? (
            <div className="grid min-h-[360px] place-items-center rounded-[1.5rem] border border-dashed border-orange-200 bg-orange-50/60 p-8 text-center">
              <div>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-white text-3xl shadow-sm">🔔</div>
                <h3 className="mt-4 text-lg font-black text-slate-950">目前沒有通知</h3>
                <p className="mt-2 text-sm font-semibold text-slate-500">有快開團、狀態變更或候補轉正時，會顯示在這裡。</p>
              </div>
            </div>
          ) : grouped.map((item) => {
            const meta = typeMeta[item.type];
            const unread = !readIds.includes(item.id);
            const group = item.groupId ? groups.find((g) => g.id === item.groupId) : undefined;
            const visual = group ? getBossVisualMeta(`${group.title} ${group.boss}`) : null;
            return (
              <article key={item.id} className={classNames('rounded-3xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg', severityClass(item.priority, unread))}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-white text-lg shadow-sm">{meta.icon}</span>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                      {unread ? <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white">NEW</span> : null}
                      {group && visual ? <span className={classNames('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ring-1', visual.bossPillClass)}>{getBossDisplayName(group.boss)}</span> : null}
                    </div>
                    <h3 className="mt-3 text-lg font-black text-slate-950">{item.title}</h3>
                    <p className="mt-1 text-sm font-semibold leading-6 text-slate-600">{item.description}</p>
                    <div className="mt-3 text-xs font-bold text-slate-400">{formatRelativeTime(item.createdAt)}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {item.groupId ? (
                      <Button
                        variant="secondary"
                        className="py-2 text-xs"
                        onClick={() => {
                          onSelectGroup(item.groupId!);
                          onGoRaid();
                          onMarkRead(item.id);
                        }}
                      >
                        查看突襲
                      </Button>
                    ) : null}
                    {unread ? <Button variant="ghost" className="py-2 text-xs" onClick={() => onMarkRead(item.id)}>標為已讀</Button> : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="rounded-[2rem] border border-orange-100/80 bg-white/80 p-5 shadow-[0_18px_60px_-42px_rgba(124,45,18,0.75)] backdrop-blur-xl xl:sticky xl:top-24 xl:h-[calc(100vh-112px)]">
        <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-950 via-orange-950 to-amber-800 p-5 text-white shadow-inner">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-orange-200">通知規則</div>
          <h3 className="mt-3 text-xl font-black">目前啟用</h3>
          <div className="mt-4 grid gap-3 text-sm font-semibold leading-6 text-orange-50/90">
            <div>⏰ 24 小時內開團提醒</div>
            <div>🔥 1 小時內快開打提醒</div>
            <div>↻ 招募截止 / 已結束狀態提醒</div>
            <div>✓ 候補轉正事件紀錄</div>
            <div>… 候補待處理提醒</div>
          </div>
        </div>

        {selectedGroup ? (
          <div className="mt-4 rounded-3xl border border-orange-100 bg-orange-50/70 p-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-orange-500">目前選取</div>
            <div className="mt-2 text-lg font-black text-slate-950">{selectedGroup.title}</div>
            <div className="mt-1 text-sm font-semibold text-slate-500">{getBossDisplayName(selectedGroup.boss)} · {formatRaidTime(selectedGroup)}</div>
            <Button className="mt-4 w-full" onClick={onGoRaid}>查看楓突襲詳細</Button>
          </div>
        ) : null}

        <div className="mt-4 rounded-3xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-xs font-semibold leading-6 text-slate-500">
          候補轉正屬於本機事件偵測：此瀏覽器看到成員狀態從「候補」變成「已確認」時會產生通知。若清除瀏覽器資料或換裝置，舊事件不會同步。
        </div>
      </aside>
    </main>
  );
}
