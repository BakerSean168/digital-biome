export const HEADER_CONTROLS = ['search', 'access'] as const;
export type HeaderControl = (typeof HEADER_CONTROLS)[number];

/** Shared primary destinations for the dock, g + letter and search. */
export const PRIMARY_NAVIGATION = [
  { title: 'Home', href: '/', desc: '个人数字生态入口', alias: ['home', '首页'] },
  {
    title: 'Library',
    href: '/notes',
    desc: 'Notes 知识笔记 · Blog 博客文章',
    alias: ['library', 'notes', '知识', '笔记'],
  },
  {
    title: 'Projects',
    href: '/projects',
    desc: '项目、作品与代码',
    alias: ['projects', 'dev', '项目'],
  },
  {
    title: 'Uses',
    href: '/uses',
    desc: '我在使用的硬件、软件、服务与网站',
    alias: ['uses', 'tools', '硬件', '软件', '设备', '服务目录', '我在使用'],
  },
  {
    title: 'About',
    href: '/about',
    desc: '关于 BakerSean 与这片数字生态',
    alias: ['about', '关于'],
  },
  {
    title: 'Now',
    href: '/now',
    desc: '最近在做什么、玩什么、看什么',
    alias: ['now', '近况', '最近'],
  },
  {
    title: 'Other',
    href: '/other',
    desc: 'AI、Ideas、Canon 等 Slash Pages',
    alias: ['other', 'slash', '其他'],
  },
] as const;

export function activeNavigation(path: string): string | undefined {
  const route = path.replace(/\/+$/, '') || '/';
  if (route === '/') return '/';
  if (/^\/(notes|blog)(\/|$)/.test(route) || route === '/about/tags') return '/notes';
  if (/^\/projects(\/|$)/.test(route)) return '/projects';
  if (/^\/(uses|infrastructure)(\/|$)/.test(route)) return '/uses';
  if (route === '/about') return '/about';
  if (route === '/now') return '/now';
  if (/^\/(other|ai|ideas|canon|colophon|friends|blogroll|carry|defaults)(\/|$)/.test(route))
    return '/other';
  return undefined;
}

export function pageMode(path: string): string {
  const route = path.replace(/\/+$/, '') || '/';
  if (route === '/404' || route === '/404.html') return '404';
  if (route === '/friends') return 'FRIENDS';
  if (route === '/login') return 'ACCESS';
  if (route === '/now') return 'NOW';
  if (route === '/other') return 'OTHER';
  return (
    PRIMARY_NAVIGATION.find((item) => item.href === activeNavigation(route))?.title.toUpperCase() ??
    'READ'
  );
}

export type SearchNavigationCommand = {
  type: 'cmd';
  label: 'NAV';
  title: string;
  desc: string;
  href: string;
  alias?: readonly string[];
};

export const SEARCH_NAVIGATION_INDEX: readonly SearchNavigationCommand[] = [
  ...PRIMARY_NAVIGATION.map((item) => ({
    ...item,
    type: 'cmd' as const,
    label: 'NAV' as const,
    alias: [item.href, ...item.alias],
  })),
  ...['blogroll', 'carry', 'defaults', 'colophon', 'ai', 'ideas', 'canon'].map((name) => ({
    type: 'cmd' as const,
    label: 'NAV' as const,
    title: name,
    desc: name,
    href: '/' + name,
    alias: ['/' + name],
  })),
  {
    type: 'cmd',
    label: 'NAV',
    title: 'Library / Blog',
    desc: '博客文章与工程记录',
    href: '/blog',
    alias: ['/blog', 'blog', '博客', '文章'],
  },
  {
    type: 'cmd',
    label: 'NAV',
    title: 'Friends',
    desc: '朋友的站点与独立写作',
    href: '/friends',
    alias: ['/friends', 'friends', '友链'],
  },
  {
    type: 'cmd',
    label: 'NAV',
    title: 'Infrastructure',
    desc: '当前主机与服务设施',
    href: '/infrastructure',
    alias: ['/infrastructure', 'infra'],
  },
];
