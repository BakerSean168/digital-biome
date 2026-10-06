# 公开笔记 404：Candidate 路由规则覆盖

日期：2026-10-06。发现于 v0.8.0 生产浏览器验收。

## 现象与根因

生产首页、对象目录与服务正常，公开笔记详情返回纯文本 `Not Found`。例如 `/notes/obsidian/typescript-utility-types/`：对应 HTML 和 catalog 入口都存在于发布 archive；本地 Astro 静态预览可正常阅读。

`postbuild.ts` 根据公开/受保护笔记边界生成 `dist/_routes.json`，仅使 API 和受保护笔记调用 Pages Functions。Candidate 随后编译 Functions，并把 Wrangler 按文件结构生成的路由表复制到同一个路径。该表包含 `/notes/obsidian/*`，把所有公开笔记送入只负责返回 404 的保护处理器。

错误发生在前端构建之后、不可变 archive 打包之前。Production 忠实部署了错误 archive，没有重新构建或篡改它。只有 Astro 预览的 E2E 不能覆盖这层部署语义。

## 修复与回归

- 保留 postbuild 生成的规则，Wrangler 仅提供 Worker module。编译前后以 SHA-256 校验规则没有变化；缺少规则即失败。
- `scripts/pages-artifact.test.ts` 在隔离目录运行真实 Candidate shell step 和真实 Wrangler，包含公开静态笔记与受保护路径规则。修复前它观察到规则被替换而失败，修复后通过，不使用模拟编译器。
- Staging 和 Production smoke 从该次 archive 的公开 Notes catalog 取真实详情链接，要求详情成功响应。
- Search E2E 兼容 Cloudflare 的末尾斜杠规范化，继续严格要求原有模式参数和服务锚点。
- 不修改受保护笔记处理器、Access 策略或公开投影；不通过开放所有 Functions 路由解决问题。

## 交付要求

必须重新构建修复后的 Candidate，发布补丁 Release，并部署该不可变 archive。不可原地改写 v0.8.0 release asset。部署后验证公开详情、完整浏览器回归和匿名私有 API 边界；source SHA、archive digest、workflow 与 Cloudflare deployment 另行记录。

待合并的数据发布 v5 和自动内容通道必须保留本修复。合并工作流冲突时以本规则为约束，自动内容部署也应加入真实公开详情 smoke。
