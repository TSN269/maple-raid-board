import type { MemberStatus } from '../types';

export const jobOptions = [
  '英雄',
  '聖騎士',
  '黑騎士',
  '火毒魔導士',
  '冰雷魔導士',
  '主教',
  '箭神',
  '神射手',
  '夜使者',
  '暗影神偷',
  '拳霸',
  '槍神',
  '其他',
];

export const bossOptions = [
  '殘暴炎魔 Zakum',
  '闇黑龍王 Horntail',
  '皮卡啾 Pink Bean',
  '鐘王 Papulatus',
  '公會自訂團',
];

export const roleOptions = ['打手', '火', '煙霧機', '輔助', '大法', '控時', '清球', '清魔靈'];

export function getRoleOptionsForBoss(bossText: string) {
  const raw = String(bossText || '').toLowerCase();
  const isPapulatus = /鐘王|papulatus|帕普|拉圖斯/.test(raw);
  const isHard = /hard|困難|chaos/.test(raw);
  const isZakum = /殘暴炎魔|zakum|炎魔/.test(raw);

  return roleOptions.filter((role) => {
    if (role === '控時') return isPapulatus && isHard;
    if (role === '清球') return isPapulatus;
    if (role === '清魔靈') return isZakum;
    return true;
  });
}

export const statusOptions: MemberStatus[] = ['待確認', '已確認', '候補', '請假'];

export const difficultyOptions = ['NORMAL', 'HARD'] as const;
