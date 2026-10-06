# ADR-0005：统一 Data Product 消费与 Data-only Content Delivery

- 状态：Accepted（实施待完成）
- 日期：2026-10-06
- 决策范围：Digital Biome 上游数据同步、build-time materialization、自动锁更新、静态内容发布、应用 Release 边界
- 上位协议：Personal Digital System `architecture/adr/0006-unified-data-product-publication-protocol.md`
- 规范：Personal Digital System `architecture/data-product-protocol-v1.md`
- 保留：ADR-0002 的私有 RuntimeBinding 安全边界、ADR-0003 的 Personal Infrastructure 事实归属

## 背景

Digital Biome 已经完成从“直接依赖上游仓库内部结构”向 producer-owned projection 的核心架构迁移，但三条公共数据链仍采用不同的同步机制：

1. `knowledge-public-v1`：Digital Biome 已按 immutable Release + lock 消费，但 Thought Forest 当前 producer workflow 与 consumer 监听事件存在协议漂移；
2. `pds-catalog-v1`：producer 已能创建 immutable Release，但 Digital Biome 仍会 checkout PDS `main`、重新执行 producer exporter，并把 `src/data/system/pds-catalog-v1.json` 提交进消费者仓库；
3. `infra-public-v2`：producer 已有 semantic no-op、immutable Release 和 dispatch，最接近目标模型，但 Digital Biome 同步仍会 checkout producer source 并重新执行 exporter，而不是只消费发布物。

此外，Digital Biome 当前交付模型主要针对“应用代码发布”：

```text
main CI
 -> Candidate
 -> semver Release
 -> manual Production promotion
```

这个模型适合应用代码，但对“新增 100 篇公开笔记”“PDS 新增一个 repository entry”“公开基础设施目录更新”过重。

这些数据变化仍需要 Astro/Pagefind 重新构建，因为静态 route、内容索引和搜索索引确实发生变化；但它们不应该被伪装成一个新的应用软件版本。

## 决策

### 1. Digital Biome 全面采用 PDS Data Product Protocol v1

活动的公共 build-time 产品统一为：

- `knowledge-public-v1`;
- `pds-catalog-v1`;
- `infra-public-v2`.

Digital Biome 只提交它们的 immutable consumer lock，不提交 producer projection 副本。

### 2. Git 中的公共上游状态收敛为 lock

目标状态：

```text
data-products/
  knowledge-public-v1.lock.json
  pds-catalog-v1.lock.json
  infra-public-v2.lock.json
  digital-biome-private-infrastructure-v1.lock.json
```

其中前三个遵循统一 public Data Product lock contract；第四个继续属于 private RuntimeBinding contract。

以下内容均为 ignored materialization/generated data：

```text
.pds-runtime/
src/data/obsidian/
src/data/indexes/
src/data/infrastructure/
src/data/system/
public/vault-assets/
public/pagefind/
dist/
```

`src/data/system/pds-catalog-v1.json` 在迁移完成后不再 tracked。

### 3. 一个 generic public-product consumer 取代三套 bespoke sync

Digital Biome 使用一个 allowlisted registry 描述：

- product ID；
- producer repository；
- artifact/manifest file name；
- lock path；
- parser/verifier；
- materializer；
- build-time classification。

正常事件统一监听：

`data-product-published`

generic consumer：

1. 校验 product/producer allowlist；
2. 下载 exact immutable Release；
3. 校验 source revision、release tag、artifact/manifest SHA-256；
4. 重新计算 semantic digest；
5. 若与当前 lock 相同则 no-op；
6. 否则只改对应 lock；
7. 创建/刷新 automation PR；
8. 等待 protected CI。

### 4. 公共产品读取凭据统一

公共 Data Product Release 尽量统一使用一个短期 GitHub App token：

- Contents Read；
- 仅安装在 Digital Biome 与三个 allowlisted producer repository；
- 不具备 producer 写权限；
- 不授予 private RuntimeBinding 读取能力。

Personal Infrastructure private RuntimeBinding 保留独立 production-scoped read credential。

### 5. Event-driven 是主路径，scheduled reconciliation 是恢复路径

正常：

```text
producer semantic publication
 -> data-product-published
 -> lock PR
```

恢复：

```text
scheduled reconciliation
 -> 查询各 product 最新 immutable semantic Release
 -> 使用同一 verifier
 -> 发现 lock 落后则创建相同 lock PR
```

reconciliation 不 checkout producer `main`，不重新生成 producer artifact。

### 6. Trusted lock-only PR 可以自动合并

自动合并仅在严格满足以下条件时启用：

- automation branch；
- diff 仅包含 public data-product lock allowlist；
- 新 lock 能从 immutable producer Release 完整验证；
- protected CI 成功；
- 不含 private RuntimeBinding lock；
- 不含 application、workflow、依赖、配置或 presentation policy 修改。

任意条件不满足均转人工 review。

### 7. 保留一次静态重建

对三个 public build-time product，semantic change 都会触发一次新的 Astro/Pagefind Candidate。

这不是待消除的浪费，而是静态站点正确的 materialization boundary。

例如 Thought Forest 一次 merge 新增 100 篇公开笔记：

```text
100 notes
 -> 1 semantic knowledge publication
 -> 1 lock update
 -> 1 Digital Biome main merge
 -> 1 Candidate build
 -> 100 routes + indexes + Pagefind
 -> 1 production content promotion
```

producer source 变更但 projection semantic digest 不变时，Digital Biome 完全不动。

### 8. Data-only content promotion 与 Application Release 分离

#### Application lane

应用/工作流/依赖/展示逻辑发生变化时继续：

```text
PR -> main CI -> Candidate -> semver Release -> manual Production promotion
```

#### Content lane

严格 lock-only 的可信数据更新使用：

```text
producer Release
 -> verified lock-only PR
 -> protected CI
 -> auto merge
 -> exact main CI
 -> immutable Candidate
 -> data-only classifier
 -> automatic content production promotion
```

Content lane 不创建虚假的 semver application Release。

Production 只上传已经构建并校验的 Candidate artifact，仍然禁止 production rebuild。

### 9. Candidate provenance 升级为通用 dataProducts

当前 delivery manifest 对 knowledge/publicInfrastructure 使用专用字段。迁移后应升级到新的 delivery schema（计划命名 v5），显式包含所有 build-time public products：

```text
dataProducts:
  knowledge-public-v1
  pds-catalog-v1
  infra-public-v2

privateBindings:
  digital-biome-private-infrastructure-v1
```

新增合法 public product 时不应再次扩充固定 top-level schema。

### 10. 自动内容生产使用独立 Environment

新增建议 Environment：

`production-content`

用途：

- 仅供 data-only content promotion workflow；
- 不要求人工审批；
- 使用 least-privilege Cloudflare Pages Edit credential；
- workflow 本身必须先通过 data-only classifier 和 provenance gate。

现有 `production` Environment 保持人工审批，用于 application Release promotion。

### 11. Private RuntimeBinding 不进入 content rebuild lane

仅 private URL/IP/endpoint value 改变、且 public `privateRef` 不变时：

- 更新 private RuntimeBinding；
- 更新 Cloudflare encrypted binding；
- 跑 authenticated boundary smoke；
- 不重新构建 public site。

public reference contract 发生变化时，由 `infra-public-v2` 单独产生 semantic publication。

## 受保护契约

实施不得破坏：

- 当前公开 route 与 deep link；
- Astro Content Collection 行为；
- Pagefind public search 行为；
- private/draft/config 内容过滤；
- postbuild leakage gate；
- `/api/private/*` Cloudflare Access + JWT 二次校验；
- stable `privateRef`；
- Production 不 rebuild application artifact；
- application Release 的 semver/manual-promotion 纪律；
- v4/v3 真实 rollback Release 在迁移窗口内仍可部署。

Delivery schema 升级必须显式定义 v5 与 v4/v3 的兼容窗口，不允许直接删掉真实 rollback target。

## 当前已知迁移缺口（2026-10-06 基线）

### Knowledge

当前 producer 侧可观察到：

- `publish-knowledge-public-v1.yml` 运行 export/verify 并上传 Actions artifact；
- `sync-digital-biome.yml` 仍发送旧事件 `thought-forest-updated`；
- Digital Biome consumer 监听 `knowledge-public-v1-published`。

因此 producer 与 consumer notification contract 已漂移，需要作为迁移第一优先级修复。

### PDS catalog

当前 producer 已创建 `pds-catalog-v1-<sha>` immutable prerelease。

Digital Biome consumer 仍：

- 定时 checkout `personal-digital-system`；
- 重新运行 `export_pds_catalog.py`；
- commit `src/data/system/pds-catalog-v1.json` 与 lock。

2026-10-06 可观察到 automation PR #120 正在更新该 projection，说明当前仍属于“projection copy + lock”模式。

### Infrastructure

producer 已具备：

- semantic digest；
- semantic no-op；
- immutable Release；
- direct dispatch；
- scheduled fallback。

Digital Biome consumer 仍 checkout producer source 并重跑 exporter。

2026-10-04 到 2026-10-06 的多次 scheduled reconciliation 失败于 `Resolve immutable producer identity`，说明 recovery path 当前还不稳定，迁移时必须先建立统一 verifier/reconciliation contract。

## 正面影响

- 三条公共数据链只有一种心智模型；
- Digital Biome 不再复制 PDS projection；
- producer source layout 从同步路径中消失；
- semantic no-op 大幅减少无意义 CI/build；
- data-only 更新可在严格门禁后自动上线；
- 应用代码 Release 仍保持人工、语义版本和审计纪律；
- 所有 Candidate 能明确记录完整上游数据身份；
- dropped event 可通过 reconciliation 自动恢复。

## 负面影响

- 需要跨 Thought Forest / PDS / Personal Infrastructure / Digital Biome 四仓迁移；
- Candidate/Release schema 需要一次 v5 升级；
- 增加 `production-content` Environment 与自动生产 workflow；
- auto-merge/auto-deploy 的安全分类器需要高强度 contract tests；
- 短期需要保留旧事件/workflow 兼容窗口。

## 拒绝方案

### 不重建，改为运行时动态读取全部知识/PDS/Infra JSON

拒绝。Digital Biome 是 read-mostly 静态 presentation；动态化会引入 API availability、cache invalidation、loading state、runtime search、版本一致性与额外安全面。

### 每次 producer main push 都直接重建 Digital Biome

拒绝。source revision 不是 public semantic change。

### 继续三套独立同步 workflow

拒绝。它扩大协议漂移、凭据和恢复逻辑差异。

### 让 Consumer 继续执行 Producer exporter

拒绝。违反 producer-owned projection 与 ADR-0003。

### 把所有 projection JSON 都 commit 到 Digital Biome

拒绝。它复制事实并扩大 public repository data surface。

### Data-only 更新也强制创建 semver Digital Biome Release

拒绝。知识/目录数据变化不是应用软件版本变化。

## 验收条件

ADR 视为完成实施，仅当：

1. 三个 producer 都使用 semantic no-op + immutable Release + `data-product-published`;
2. Digital Biome generic consumer 只修改 lock；
3. reconciliation 不读取 producer source；
4. `pds-catalog-v1.json` 不再 tracked；
5. `pnpm sync`/CI/Candidate 从三个 committed lock 完整物化；
6. Candidate provenance 显式记录三个 public product；
7. trusted lock-only PR 可经 protected CI 自动 merge；
8. exact data-only Candidate 可自动生产部署且不 rebuild；
9. application Release lane 仍保持手动生产提升；
10. private RuntimeBinding value-only update 不触发 static rebuild；
11. missed dispatch、digest mismatch、build failure、deploy failure 均有自动/手工恢复测试；
12. `pnpm verify:full` 与生产 smoke 全绿。
