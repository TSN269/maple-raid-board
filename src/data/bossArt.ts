import type { RaidGroup } from '../types';

export type BossArtMeta = {
  key: 'zakum' | 'horntail' | 'pink-bean' | 'papulatus' | 'custom';
  label: string;
  image?: string;
  smallImage?: string;
  accent: string;
  glow: string;
};

export type BossDifficultyMeta = {
  label: 'NORMAL' | 'HARD';
  chipClass: string;
  ringClass: string;
};

export type BossVisualMeta = {
  bossPillClass: string;
  difficultyPillClass: string;
  cardBorderClass: string;
};

function normalize(text: string) {
  return String(text || '').toLowerCase();
}

export function getBossDisplayName(text: string) {
  const raw = String(text || '');
  const [head] = raw.split('｜');
  return head.replace(/\b(normal|hard|簡單|困難|普通)\b/gi, '').trim() || raw.trim() || 'Custom Boss';
}

export function buildBossStorageValue(boss: string, difficulty: 'NORMAL' | 'HARD') {
  return `${getBossDisplayName(boss)}｜${difficulty}`;
}

export function getBossDifficultyMeta(text: string): BossDifficultyMeta {
  const t = normalize(text);
  if (/困難|hard|chaos/.test(t)) {
    return {
      label: 'HARD',
      chipClass: 'bg-rose-500/95 text-white',
      ringClass: 'ring-rose-300/55',
    };
  }
  return {
    label: 'NORMAL',
    chipClass: 'bg-emerald-500/95 text-white',
    ringClass: 'ring-emerald-300/55',
  };
}

export function getBossArtMeta(text: string): BossArtMeta {
  const t = normalize(text);
  if (/zakum|炎魔/.test(t)) {
    return {
      key: 'zakum',
      label: 'Zakum',
      image: 'https://media.maplestorywiki.net/yetidb/Boss_UI_-_Zakum.png',
      smallImage: 'https://media.maplestorywiki.net/yetidb/Boss_Entry_UI_-_Zakum.png',
      accent: 'from-red-950 via-red-800 to-orange-600',
      glow: 'shadow-orange-500/30',
    };
  }
  if (/horntail|龍王/.test(t)) {
    return {
      key: 'horntail',
      label: 'Horntail',
      image: 'https://media.maplestorywiki.net/yetidb/Boss_Entry_UI_-_Horntail.png',
      smallImage: 'https://media.maplestorywiki.net/yetidb/Boss_Entry_UI_-_Horntail.png',
      accent: 'from-sky-950 via-cyan-800 to-blue-500',
      glow: 'shadow-sky-500/30',
    };
  }
  if (/pink\s*bean|皮卡|粉豆/.test(t)) {
    return {
      key: 'pink-bean',
      label: 'Pink Bean',
      image: 'https://media.maplestorywiki.net/yetidb/Boss_Entry_UI_-_Pink_Bean.png',
      smallImage: 'https://media.maplestorywiki.net/yetidb/Boss_Entry_UI_-_Pink_Bean.png',
      accent: 'from-fuchsia-900 via-pink-700 to-rose-400',
      glow: 'shadow-pink-400/30',
    };
  }
  if (/papulatus|鐘王|帕普|拉圖斯/.test(t)) {
    return {
      key: 'papulatus',
      label: 'Papulatus',
      image: 'https://media.maplestorywiki.net/yetidb/Boss_UI_-_Papulatus.png',
      smallImage: 'https://media.maplestorywiki.net/yetidb/Boss_Entry_UI_-_Papulatus.png',
      accent: 'from-indigo-950 via-blue-800 to-cyan-500',
      glow: 'shadow-cyan-500/30',
    };
  }
  return {
    key: 'custom',
    label: 'Custom Boss',
    accent: 'from-emerald-950 via-green-800 to-lime-500',
    glow: 'shadow-emerald-500/30',
  };
}

const visuals: Record<BossArtMeta['key'], Record<BossDifficultyMeta['label'], BossVisualMeta>> = {
  zakum: {
    NORMAL: { bossPillClass: 'bg-amber-50 text-amber-800 ring-amber-200', difficultyPillClass: 'bg-amber-500 text-white ring-amber-300', cardBorderClass: 'border-amber-200/80 hover:border-amber-300' },
    HARD: { bossPillClass: 'bg-rose-50 text-rose-800 ring-rose-200', difficultyPillClass: 'bg-rose-600 text-white ring-rose-300', cardBorderClass: 'border-rose-200/80 hover:border-rose-300' },
  },
  horntail: {
    NORMAL: { bossPillClass: 'bg-sky-50 text-sky-800 ring-sky-200', difficultyPillClass: 'bg-sky-500 text-white ring-sky-300', cardBorderClass: 'border-sky-200/80 hover:border-sky-300' },
    HARD: { bossPillClass: 'bg-indigo-50 text-indigo-800 ring-indigo-200', difficultyPillClass: 'bg-indigo-600 text-white ring-indigo-300', cardBorderClass: 'border-indigo-200/80 hover:border-indigo-300' },
  },
  'pink-bean': {
    NORMAL: { bossPillClass: 'bg-pink-50 text-pink-800 ring-pink-200', difficultyPillClass: 'bg-pink-500 text-white ring-pink-300', cardBorderClass: 'border-pink-200/80 hover:border-pink-300' },
    HARD: { bossPillClass: 'bg-fuchsia-50 text-fuchsia-800 ring-fuchsia-200', difficultyPillClass: 'bg-fuchsia-600 text-white ring-fuchsia-300', cardBorderClass: 'border-fuchsia-200/80 hover:border-fuchsia-300' },
  },
  papulatus: {
    NORMAL: { bossPillClass: 'bg-cyan-50 text-cyan-800 ring-cyan-200', difficultyPillClass: 'bg-cyan-500 text-white ring-cyan-300', cardBorderClass: 'border-cyan-200/80 hover:border-cyan-300' },
    HARD: { bossPillClass: 'bg-violet-50 text-violet-800 ring-violet-200', difficultyPillClass: 'bg-violet-600 text-white ring-violet-300', cardBorderClass: 'border-violet-200/80 hover:border-violet-300' },
  },
  custom: {
    NORMAL: { bossPillClass: 'bg-emerald-50 text-emerald-800 ring-emerald-200', difficultyPillClass: 'bg-emerald-500 text-white ring-emerald-300', cardBorderClass: 'border-emerald-200/80 hover:border-emerald-300' },
    HARD: { bossPillClass: 'bg-slate-100 text-slate-800 ring-slate-200', difficultyPillClass: 'bg-slate-700 text-white ring-slate-300', cardBorderClass: 'border-slate-200/80 hover:border-slate-300' },
  },
};

export function getBossVisualMeta(text: string): BossVisualMeta {
  const art = getBossArtMeta(text);
  const difficulty = getBossDifficultyMeta(text);
  return visuals[art.key][difficulty.label];
}

export function getRaidDateTime(group: Pick<RaidGroup, 'raidDate' | 'raidTime'>): Date | null {
  const raw = `${group.raidDate}T${String(group.raidTime || '00:00').slice(0, 5)}:00`;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isRaidExpired(group: Pick<RaidGroup, 'raidDate' | 'raidTime'>, now = new Date()) {
  const raidAt = getRaidDateTime(group);
  return raidAt ? now.getTime() >= raidAt.getTime() : false;
}

export function getRaidStatusMeta(group: RaidGroup, now = new Date()) {
  const expired = isRaidExpired(group, now);
  if (expired || group.status === 'finished') {
    return { label: '已結束', tone: 'slate' as const, canSignup: false, effectiveStatus: 'finished' as const, isAuto: expired && group.status !== 'finished' };
  }
  if (group.status === 'closed') {
    return { label: '招募截止', tone: 'yellow' as const, canSignup: false, effectiveStatus: 'closed' as const, isAuto: false };
  }
  if (group.members.length >= group.capacity) {
    return { label: '額滿', tone: 'red' as const, canSignup: false, effectiveStatus: 'closed' as const, isAuto: false };
  }
  return { label: '招募中', tone: 'green' as const, canSignup: true, effectiveStatus: 'open' as const, isAuto: false };
}
