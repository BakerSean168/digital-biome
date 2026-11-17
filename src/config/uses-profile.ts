/**
 * Curated public /uses snapshot. Only non-sensitive, user-confirmed hardware and
 * software belong here. Service inventory and bookmarks remain owned by their
 * existing public projections; /uses must not duplicate private endpoints.
 */
export const USES_UPDATED_AT = '2026-11-17';

export const USES_HARDWARE = [
  {
    group: 'COMPUTING',
    name: 'Acer SH16-74 笔记本',
    detail: 'Windows 开发主机 · i7-14650HX / 32 GB / RTX 5060 Laptop',
  },
  {
    group: 'HOMELAB',
    name: 'Intel N100 迷你主机',
    detail: '家里的 PVE / Debian 与自托管服务实验环境',
  },
  { group: 'MOBILE', name: 'OPPO Find X8 Ultra', detail: '日常使用的手机' },
  { group: 'INPUT', name: 'ATK F1 V3', detail: '鼠标' },
  { group: 'INPUT', name: 'VGN V87', detail: '机械键盘' },
  { group: 'AUDIO', name: 'SteelSeries Arctis Nova 5', detail: '游戏与日常使用的耳机' },
  { group: 'READING', name: '海信墨水屏设备', detail: '电子阅读 · KOReader' },
] as const;

export const USES_SOFTWARE = [
  {
    group: 'SYSTEMS & TERMINAL',
    items: [
      { name: 'Windows 11 + WSL', detail: '日常开发环境' },
      { name: 'Neovim / AstroNvim', detail: '代码编辑' },
      { name: 'Zsh · tmux · lazygit', detail: '终端与版本控制工作流' },
      { name: 'Git · Docker Compose', detail: '代码管理与服务部署' },
    ],
  },
  {
    group: 'MAKING THINGS',
    items: [
      { name: 'T3 Code · Codex CLI', detail: '项目开发与 AI 协作' },
      { name: 'Obsidian', detail: '知识笔记与写作' },
      { name: 'Figma', detail: '界面与组件设计' },
    ],
  },
  {
    group: 'SELF-HOSTING',
    items: [
      { name: 'Proxmox VE · Debian', detail: '家庭服务器与虚拟化' },
      { name: 'Tailscale · Cloudflare Tunnel', detail: '设备连接与受控访问' },
      { name: 'Caddy · LiteLLM', detail: '服务入口与模型网关' },
    ],
  },
] as const;

/**
 * Picks from the published Thought Forest bookmark projection, not handwritten
 * outbound URLs. Missing entries are simply omitted.
 */
export const USES_FEATURED_BOOKMARK_IDS = [
  'obsidian/chatgpt',
  'obsidian/bilibili',
  'obsidian/linux-do',
  'obsidian/youtube',
] as const;
