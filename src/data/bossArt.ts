import zakumArt from '../assets/bosses/zakum.png';
import horntailArt from '../assets/bosses/horntail.png';
import pinkBeanArt from '../assets/bosses/pink-bean.png';
import papulatusArt from '../assets/bosses/papulatus.png';
import zakumEntry from '../assets/bosses/entry/zakum-entry.png';
import horntailEntry from '../assets/bosses/entry/horntail-entry.png';
import pinkBeanEntry from '../assets/bosses/entry/pink-bean-entry.png';
import papulatusEntry from '../assets/bosses/entry/papulatus-entry.png';

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

function normalize(text: string) {
  return String(text || '').toLowerCase();
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
      image: zakumArt,
      smallImage: zakumEntry,
      accent: 'from-red-950 via-red-800 to-orange-600',
      glow: 'shadow-orange-500/30',
    };
  }

  if (/horntail|龍王/.test(t)) {
    return {
      key: 'horntail',
      label: 'Horntail',
      image: horntailArt,
      smallImage: horntailEntry,
      accent: 'from-sky-950 via-cyan-800 to-blue-500',
      glow: 'shadow-sky-500/30',
    };
  }

  if (/pink\s*bean|皮卡|粉豆/.test(t)) {
    return {
      key: 'pink-bean',
      label: 'Pink Bean',
      image: pinkBeanArt,
      smallImage: pinkBeanEntry,
      accent: 'from-fuchsia-900 via-pink-700 to-rose-400',
      glow: 'shadow-pink-400/30',
    };
  }

  if (/papulatus|鐘王|帕普|拉圖斯/.test(t)) {
    return {
      key: 'papulatus',
      label: 'Papulatus',
      image: papulatusArt,
      smallImage: papulatusEntry,
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
