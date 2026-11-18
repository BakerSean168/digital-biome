/**
 * Individual public activities. Reorder or edit entries without touching page markup.
 * Kinds only select a recognizable icon; no labels or cross-page links are displayed.
 */
// Manually maintained snapshot date for the public /now page.
export const NOW_UPDATED_AT = '2026-11-18';

export type NowKind = 'project' | 'game' | 'watching';

export interface NowEntry {
  id: string;
  kind: NowKind;
  title: string;
  secondaryName?: string;
  description: string;
}

export const NOW_ENTRIES: readonly NowEntry[] = [
  {
    id: 'memoflow',
    kind: 'project',
    title: 'MemoFlow',
    description: '持续完善目标、任务、提醒与笔记之间的使用体验。',
  },
  {
    id: 'bodysense',
    kind: 'project',
    title: 'BodySense',
    description: '继续完善体态问诊、评估与诊断流程。',
  },
  {
    id: 'league-of-legends',
    kind: 'game',
    title: '英雄联盟',
    secondaryName: 'League of Legends',
    description: '最近在玩的团队竞技游戏。',
  },
  {
    id: 'pubg',
    kind: 'game',
    title: 'PUBG',
    secondaryName: '绝地求生',
    description: '多人战术生存射击。',
  },
  {
    id: 'counter-strike',
    kind: 'game',
    title: 'CS:GO',
    secondaryName: '反恐精英：全球攻势',
    description: '竞技射击。',
  },
  {
    id: 'dwarf-fortress',
    kind: 'game',
    title: '矮人要塞',
    secondaryName: 'Dwarf Fortress',
    description: '经营模拟与故事生成。',
  },
  {
    id: 'breaking-bad',
    kind: 'watching',
    title: '绝命毒师',
    secondaryName: 'Breaking Bad',
    description: '最近正在看的剧集。',
  },
];
