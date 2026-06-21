# Basalt & Moss: Design System Guidelines

## 1. 审美哲学 (Design Philosophy)
- **Geek Wabi-Sabi (极客侘寂)**: 摒弃过度装饰、大圆角、弥散阴影和高亮赛博霓虹。追求一种像终端界面般冰冷、硬核、充满代码气息，但同时又像数字生态群落般天然有机的“纯粹技术乌托邦”质感。
- **冷峻与克制**: UI 组件的边界不使用阴影（Shadows）和毛玻璃，而是大量采用单色细线框（1px solid border）甚至无边框。

## 2. 色彩系统 (Color Palette)
使用极简且高对比度的色彩体系（CSS Variables 映射到 Tailwind v4）：
- **Basalt (玄武岩 / 背景)**: `--bg` (如 `#151614`) 及其衍生暗灰 `--card`, `--pane`。代表底层的冷峻感。
- **Moss (青苔 / 主色点缀)**: 低饱和度、高亮度（如 `hsl(71, 40%, 60%)`）的暗绿/灰绿色体系。避免使用刺眼的纯绿色（如 `#10B981`）。
- **Text (文本对比度)**:
  - `--text-main`: `#E2E1DD` (极高对比度的冷白/米白，映射为 Tailwind 的 `text-foreground`)
  - `--text-muted`: `#A8A9A4` (辅助阅读文本，映射为 `text-muted-foreground`)
  - `--text-tertiary`: `#8B8C86` (极度弱化的边角文本)

## 3. UI 元素与排版 (UI & Typography)
- **去圆角化**: 严禁使用 `rounded-2xl`、`rounded-3xl` 或巨大的圆角设计。使用直角 (`rounded-none`) 或极小圆角 (`rounded-sm`) 凸显工业感。
- **终端化视觉 (Terminal-like)**:
  - 按钮文案采用括号包裹的大写指令形式：例如 `[ VIEW_ALL ]`、`[ REBOOT_SYSTEM ]`。
  - 大量应用等宽字体配合宽字距 (`font-mono tracking-widest text-[10px]`)，作为装饰性 UI 元素。
  - 告别苹果风格 UI（如红黄绿控制点），使用极客感更强的系统错误码（如 `SYS.ERR`）或方形闪烁光标 (`animate-pulse`)。
- **字体降级策略**: 网站大量框架、搜索框、时间戳、标签一律使用等宽字体 (`font-mono`) 强化终端特性；只有在用户需要进行长阅读的正文区（如博客文章）才恢复使用衬线或无衬线字体 (`font-serif`, `font-sans`) 以保证可读性。

## 4. 动效反馈 (Micro-Interactions)
动效必须为了反馈服务，干脆利落，避免过度冗长的渐变：
- **信号解码特效**: 对重要的主标题（H1 或区块大标题），使用 `<SignalTitle>` 字符乱码解码组件呈现。
- **克制的悬停响应**: 悬停（Hover）只提供基础的边框亮起 (`border-primary/50`) 或单行文本色彩变更 (`text-primary`)，绝不使用 `shadow-lg` 等 Z 轴悬浮表现。
