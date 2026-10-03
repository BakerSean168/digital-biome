export const HEADER_CONTROLS = ['search', 'access'] as const;

export type HeaderControl = (typeof HEADER_CONTROLS)[number];

export type SearchNavigationCommand = {
  type: 'cmd';
  label: 'NAV';
  title: string;
  desc: string;
  href: string;
  alias?: readonly string[];
};

/**
 * Primary destination navigation belongs to Search, not the floating header.
 * Keep this index explicit so adding a destination never implies adding chrome.
 */
export const SEARCH_NAVIGATION_INDEX: readonly SearchNavigationCommand[] = [
  {
    type: 'cmd',
    label: 'NAV',
    title: '首页 / Home',
    desc: 'Return to Digital Biome root',
    href: '/',
  },
  {
    type: 'cmd',
    label: 'NAV',
    title: '博客文章 / Blog',
    desc: 'Blog posts and engineering logs',
    href: '/blog',
    alias: ['/blog', 'blog', 'posts'],
  },
  {
    type: 'cmd',
    label: 'NAV',
    title: '友链网络 / Friends',
    desc: 'Friend links and community nodes',
    href: '/friends',
    alias: ['/friends', 'friends', 'links'],
  },
  {
    type: 'cmd',
    label: 'NAV',
    title: '工具导航 / Tools',
    desc: 'External bookmarks and tools',
    href: '/tools',
    alias: ['/tools', 'tools', 'nav'],
  },
  {
    type: 'cmd',
    label: 'NAV',
    title: '我的项目 / Dev',
    desc: 'Development showcase and apps',
    href: '/dev',
    alias: ['/dev', 'dev', 'projects'],
  },
  {
    type: 'cmd',
    label: 'NAV',
    title: '个人系统 / Personal Systems',
    desc: 'Services, projects, assets and infrastructure',
    href: '/systems',
    alias: ['/systems', '/infrastructure', 'systems', 'infra', 'lab', 'ops', 'services'],
  },
  {
    type: 'cmd',
    label: 'NAV',
    title: '资产发现 / Discover',
    desc: 'Global index search',
    href: '/discover',
    alias: ['/discover', 'search'],
  },
  {
    type: 'cmd',
    label: 'NAV',
    title: '知识笔记 / Notes',
    desc: 'Obsidian vault notes',
    href: '/notes',
    alias: ['/notes', 'mind'],
  },
  {
    type: 'cmd',
    label: 'NAV',
    title: '关于宿主 / About',
    desc: 'Author profile',
    href: '/about',
    alias: ['/about', 'user'],
  },
];
