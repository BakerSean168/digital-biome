/**
 * Hand-edited, public-facing About copy.
 * Long-lived identity and interests only; short-lived updates belong in now-profile.ts.
 */ export const COMPUTER_INTERESTS = [
  {
    number: '01',
    title: '编程与自动化',
    detail: '喜欢把重复的事情交给程序，也喜欢从一个想法开始，慢慢做出能实际使用的工具。',
  },
  {
    number: '02',
    title: '云服务器与自托管',
    detail: '租用云服务器、部署服务、维护自己的小系统。折腾的过程本身就很有意思。',
  },
  {
    number: '03',
    title: '家庭网络与 Homelab',
    detail: '对路由、网络、家庭服务器和设备之间的连接很感兴趣，享受把它们一点点组织起来。',
  },
] as const;

export const ABOUT_AREAS = [
  {
    title: 'Notes',
    href: '/notes',
    description: '零散的知识笔记、概念和学习过程。',
  },
  { title: 'Blog', href: '/blog', description: '比较完整的文章、经历与思考。' },
  { title: 'Projects', href: '/dev', description: '做过和正在做的项目。' },
  { title: 'Tools', href: '/tools', description: '收集的工具、服务与资源。' },
] as const;

export const ABOUT_SYSTEMS = [
  {
    title: 'Thought Forest',
    href: '/notes',
    description: '记笔记、写东西，也整理思考。',
  },
  {
    title: 'Personal Digital System',
    href: '/systems',
    description: '把日常使用的项目和系统连接起来。',
  },
  {
    title: 'Personal Infrastructure',
    href: '/infrastructure',
    description: '承载这些服务的设备与网络。',
  },
] as const;
