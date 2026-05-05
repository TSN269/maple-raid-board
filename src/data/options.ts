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

export const roleOptions = ['主坦', '副坦', '輸出', '補師', '主輸出', '副輸出', '輔助', '綁王/控場', '隊長', '替補'];

export const statusOptions: MemberStatus[] = ['待確認', '已確認', '候補', '請假'];

export const difficultyOptions = ['NORMAL', 'HARD'] as const;
