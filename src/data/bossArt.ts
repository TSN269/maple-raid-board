import zakumArt from '../assets/bosses/zakum.png';
import horntailArt from '../assets/bosses/horntail.png';
import pinkBeanArt from '../assets/bosses/pink-bean.png';
import papulatusArt from '../assets/bosses/papulatus.png';

export type BossArtMeta = {
  key: 'zakum' | 'horntail' | 'pink-bean' | 'papulatus' | 'custom';
  label: string;
  image?: string;
  accent: string;
  glow: string;
};

function normalize(text: string) {
  return String(text || '').toLowerCase();
}

export function getBossArtMeta(text: string): BossArtMeta {
  const t = normalize(text);

  if (/zakum|炎魔/.test(t)) {
    return {
      key: 'zakum',
      label: 'Zakum',
      image: zakumArt,
      accent: 'from-red-950 via-red-800 to-orange-600',
      glow: 'shadow-orange-500/30',
    };
  }

  if (/horntail|龍王/.test(t)) {
    return {
      key: 'horntail',
      label: 'Horntail',
      image: horntailArt,
      accent: 'from-sky-950 via-cyan-800 to-blue-500',
      glow: 'shadow-sky-500/30',
    };
  }

  if (/pink\s*bean|皮卡|粉豆/.test(t)) {
    return {
      key: 'pink-bean',
      label: 'Pink Bean',
      image: pinkBeanArt,
      accent: 'from-fuchsia-900 via-pink-700 to-rose-400',
      glow: 'shadow-pink-400/30',
    };
  }

  if (/papulatus|鐘王|帕普|拉圖斯/.test(t)) {
    return {
      key: 'papulatus',
      label: 'Papulatus',
      image: papulatusArt,
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
