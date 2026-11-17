/**
 * Public, manually curated current activities.
 * Add, remove, or reorder individual entries; the page has no fixed sections.
 * No live activity inference, private server details, or outgoing links.
 */
export const NOW_UPDATED_AT = '2026-11-17';

export type NowKind = 'project' | 'game' | 'watching';

export interface NowEntry {
  id: string;
  kind: NowKind;
  category: string;
  title: string;
  subtitle?: string;
  status?: string;
  detail?: string;
}

export const NOW_ENTRIES: readonly NowEntry[] = [
  {
    id: 'memoflow',
    kind: 'project',
    category: 'PERSONAL PROJECT',
    title: '完善 MemoFlow',
    status: '进行中',
    detail: '继续完善目标、任务、提醒和笔记之间的使用体验。',
  },
  {
    id: 'ali-three',
    kind: 'project',
    category: 'PERSONAL PROJECT',
    title: '阿里三项目',
    status: '进行中',
  },
  {
    id: 'league-of-legends',
    kind: 'game',
    category: 'MOBA',
    title: '英雄联盟',
    subtitle: 'League of Legends',
  },
  {
    id: 'pubg',
    kind: 'game',
    category: 'BATTLE ROYALE',
    title: 'PUBG',
  },
  {
    id: 'counter-strike',
    kind: 'game',
    category: 'TACTICAL FPS',
    title: 'CS:GO',
  },
  {
    id: 'dwarf-fortress',
    kind: 'game',
    category: 'SIMULATION',
    title: '矮人要塞',
    subtitle: 'Dwarf Fortress',
  },
  {
    id: 'breaking-bad',
    kind: 'watching',
    category: 'TV SERIES',
    title: '绝命毒师',
    subtitle: 'Breaking Bad',
    status: '正在看',
  },
];
