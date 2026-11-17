/**
 * Curated public snapshot for /now. Update NOW_UPDATED_AT together with its contents.
 * No client polling, private service metadata, or automatic claims about live activity.
 */
export const NOW_UPDATED_AT = '2026-11-17';

export const NOW_FOCUS = [
  {
    label: 'BUILDING',
    title: '整理自己的数字空间',
    detail: '最近在整理 Digital Biome，让 About 讲述相对稳定的自己，让 Now 记录正在发生的事情。',
    href: '/about',
    linkLabel: 'About',
  },
  {
    label: 'TINKERING',
    title: '家庭网络和服务器',
    detail: '继续折腾云服务器、家庭服务器与网络，尝试让日常使用的服务更简单、可靠。',
    href: '/infrastructure',
    linkLabel: 'Infrastructure',
  },
  {
    label: 'LEARNING',
    title: '编程与 AI 协作',
    detail: '一边做项目，一边摸索更适合自己的开发方式，把有价值的经验写进笔记。',
    href: '/blog',
    linkLabel: 'Blog',
  },
] as const;

export const NOW_GAMES = [
  { title: '英雄联盟', subtitle: 'LEAGUE OF LEGENDS', category: 'MOBA' },
  { title: 'PUBG', subtitle: 'BATTLEGROUNDS', category: 'BATTLE ROYALE' },
  { title: 'CS:GO', subtitle: 'COUNTER-STRIKE', category: 'TACTICAL FPS' },
  { title: '矮人要塞', subtitle: 'DWARF FORTRESS', category: 'SIMULATION' },
] as const;

export const NOW_MEDIA = [
  {
    title: '绝命毒师',
    originalTitle: 'Breaking Bad',
    status: '正在看',
    detail: '最近慢慢追的一部剧。',
  },
  {
    title: '寒蝉鸣泣之时',
    originalTitle: 'Higurashi When They Cry',
    status: '最近看过解说',
    detail: '最近看的是作品解说，而不是完整观看原作。',
  },
] as const;
