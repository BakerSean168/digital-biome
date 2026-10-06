export const HEADER_CONTROLS = ['search', 'access'] as const;
export type HeaderControl = (typeof HEADER_CONTROLS)[number];

/** Shared product names and destinations for the dock and search. */
export const PRIMARY_NAVIGATION = [
  { title: 'Home', href: '/', desc: '个人数字生态入口', alias: ['home', '首页'] },
  {
    title: 'Library',
    href: '/notes',
    desc: 'Notes 知识笔记 · Blog 博客文章',
    alias: ['library', 'notes', '知识', '笔记'],
  },
  { title: 'Projects', href: '/dev', desc: '项目、作品与代码', alias: ['projects', 'dev', '项目'] },
  {
    title: 'Tools',
    href: '/tools',
    desc: '服务、外部资源、主机与网络',
    alias: ['tools', 'services', '工具', '服务'],
  },
  {
    title: 'About',
    href: '/about',
    desc: '关于 BakerSean 与这片数字生态',
    alias: ['about', '关于'],
  },
] as const;

export function activeNavigation(path: string): string | undefined {
  const route = path.replace(/\/+$/, '') || '/';
  if (route === '/') return '/';
  if (/^\/(notes|blog)(\/|$)/.test(route) || route === '/about/tags') return '/notes';
  if (/^\/(dev|projects)(\/|$)/.test(route)) return '/dev';
  if (/^\/(tools|systems|infrastructure)(\/|$)/.test(route)) return '/tools';
  if (route === '/about') return '/about';
  return undefined;
}

export function pageMode(path: string): string {
  const route = path.replace(/\/+$/, '') || '/';
  if (route === '/404' || route === '/404.html') return '404';
  if (route === '/friends') return 'FRIENDS';
  if (route === '/login') return 'ACCESS';
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
    title: 'Personal System',
    desc: '个人系统与基础设施',
    href: '/systems',
    alias: ['/systems', '/infrastructure', 'systems', 'infra'],
  },
];
