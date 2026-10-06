# Unified Data Product + Content Delivery 实施方案

> 状态：Approved plan，尚未开始代码迁移
> 日期：2026-10-06
> 关联决策：ADR-0005、PDS ADR-0006、PDS Data Product Protocol v1

## 1. 目标

将 Digital Biome 当前三条公共 build-time 数据链：

- Thought Forest → `knowledge-public-v1`;
- Personal Digital System → `pds-catalog-v1`;
- Personal Infrastructure → `infra-public-v2`;

统一成：

```text
producer main
 -> export/validate
 -> semantic digest
 -> no-op OR immutable Release
 -> data-product-published
 -> generic Digital Biome verifier
 -> lock-only PR
 -> protected CI
 -> trusted auto-merge
 -> one static Candidate build
 -> data-only automatic content promotion
```

同时保留：

- application semver Release；
- manual application Production promotion；
- private RuntimeBinding 独立安全边界；
- v4/v3 已发布 rollback 兼容窗口。

## 2. 非目标

本批次不做：

- Knowledge/PDS/Infra runtime API 化；
- Digital Biome UI 重构；
- 新增 Personal Twin public projection；
- 修改知识内容本身；
- 将 private RuntimeBinding 变为公共 Data Product；
- 改变 Cloudflare Access 用户授权模型；
- 为减少构建次数而引入增量 SSR/数据库。

## 3. 当前系统基线

| 链路 | Producer 当前状态 | Consumer 当前状态 | Gap |
| --- | --- | --- | --- |
| Knowledge | exporter/verify 存在；当前 workflow/event 与 consumer contract 漂移 | immutable knowledge lock + build-time materializer | notification/publication tail 不一致 |
| PDS catalog | immutable prerelease 已存在 | checkout producer main、重跑 exporter、commit projection copy + lock | source coupling + duplicate artifact |
| Infra public | semantic no-op + immutable release + dispatch 最成熟 | checkout producer revision、重跑 exporter，scheduled reconciliation 当前有失败 | consumer 未真正 release-only |
| Private infra | exact revision + digest RuntimeBinding | production encrypted binding | 保持现状，仅增强与 public ref coverage |

已观察到的 2026-10-06 运行证据：

- Digital Biome `knowledge-public-v1.lock.json` 仍锁在 `d2e3b97...`;
- PDS 新 projection 已产生 automation PR #120；
- `sync-infra-public-v2.yml` 最近多次 scheduled run 在 `Resolve immutable producer identity` 失败；
- Digital Biome main 当前有其他 UI/设计工作进行，因此本迁移必须使用独立 branch/worktree。

## 4. North-star 文件与 workflow 形态

### 4.1 PDS protocol authority

```text
personal-digital-system/
  architecture/
    adr/0006-unified-data-product-publication-protocol.md
    data-product-protocol-v1.md
    data-product-delivery-model.md
  contracts/
    data-product-publication-v1.schema.json        # implementation phase
    data-product-consumer-lock-v1.schema.json      # implementation phase
```

### 4.2 Producer

Producer 保留 domain-specific exporter，但 publication tail 一致：

```text
validate domain
export product
verify product
compute semantic hash
compare latest release
publish immutable release if changed
dispatch data-product-published
```

不要求把 exporter 抽成跨仓共享 package；统一的是 contract，不是业务实现。

### 4.3 Digital Biome

目标：

```text
.github/workflows/
  sync-data-products.yml
  reconcile-data-products.yml
  deploy-content.yml

scripts/data-products/
  registry.ts
  lock-v1.ts
  fetch-release.ts
  verify-publication.ts
  prepare-all.ts
  adapters/
    knowledge-public-v1.ts
    pds-catalog-v1.ts
    infra-public-v2.ts

data-products/
  knowledge-public-v1.lock.json
  pds-catalog-v1.lock.json
  infra-public-v2.lock.json
  digital-biome-private-infrastructure-v1.lock.json
```

现有 product-specific scripts 可先包进 adapter，确认 parity 后再删除。

## 5. Protected contracts

整个迁移必须持续满足：

| Contract | 处理 |
| --- | --- |
| public routes/deep links | Preserve |
| knowledge note IDs | Preserve |
| Pagefind public search | Preserve |
| private/draft/config filters | Preserve |
| postbuild leakage gate | Preserve / extend |
| `privateRef` identity | Preserve |
| `/api/private/*` auth | Preserve |
| current Cloudflare Pages project/custom domain | Preserve |
| Production no-rebuild invariant | Preserve |
| app semver Release/manual promotion | Preserve |
| v4/v3 published rollback window | Preserve until v5 production proof |
| producer fact ownership | Strengthen |
| consumer source-layout coupling | Retire |
| committed PDS projection copy | Retire after parity |

## 6. Phase 0 — Baseline 与 characterization

目标：先把协议漂移和现有行为固定成可验证证据，避免迁移过程中“修了一半但不知道哪个 contract 断了”。

### DPP-001 — 建立四仓 baseline ledger

**Goal:** 记录三个 producer + Digital Biome 当前 HEAD、workflow、Release、lock、运行状态。

**Scope:**

- Thought Forest；
- Personal Digital System；
- Personal Infrastructure；
- Digital Biome。

**Implementation:**

1. 记录每个仓库 `main` SHA；
2. 记录当前 latest product Release；
3. 记录 Digital Biome 三个 public lock identity；
4. 记录 producer publication workflow trigger/event；
5. 记录 consumer sync workflow trigger/event；
6. 记录当前失败 run 与失败 step；
7. 保存到 implementation PR 描述或迁移 ledger，不把临时 run ID 写进长期 architecture contract。

**Acceptance:** 能从 ledger 清楚回答“每个产品当前发布到哪里、consumer 锁在哪里、最后一次成功传播是什么”。

### DPP-002 — 加 characterization contract tests

**Goal:** 在改 workflow 前先让现状差异可测试。

**Digital Biome focused check:**

```bash
pnpm exec tsx --test scripts/verification-contract.test.ts
```

新增测试应明确 target contract，而不是永久断言旧实现。

Producer focused checks：

Thought Forest：

```bash
npm run kb:public:test
npm run kb:public:export
npm run kb:public:verify
```

PDS：

```bash
python -m unittest -v scripts/test_export_pds_catalog.py
python scripts/export_pds_catalog.py
python scripts/verify_pds_catalog.py
```

Personal Infrastructure：

```bash
python3 scripts/deployment_registry.py validate
python3 -m unittest -v scripts/test_export_infra_public_v2.py
python3 scripts/export_infra_public_v2.py
python3 scripts/verify_infra_public_v2.py
```

**Acceptance:** 迁移前每个 producer 的 exporter/validator green；Digital Biome 当前 CI baseline green。

## 7. Phase 1 — PDS protocol contract foundation

### DPP-101 — 增加 Publication Event schema

**Goal:** 将 `data-product-published` payload 变成机器可验证 contract。

**Repository:** `personal-digital-system`

**Deliverables:**

- `contracts/data-product-publication-v1.schema.json`;
- valid/invalid examples；
- validation tests；
- protocol doc 与 schema 字段完全一致。

**Required fields:**

- `protocol_version=1`;
- `product`;
- `producer_repository`;
- `source_revision`;
- `release_tag`;
- artifact name/SHA-256；
- manifest name/SHA-256；
- `semantic_sha256`.

**Acceptance:** malformed SHA、wrong release tag、missing digest、unknown required identity 均 fail closed。

### DPP-102 — 增加统一 Consumer Lock schema

**Goal:** 三个 public lock 使用同一 envelope。

**Repository:** `personal-digital-system`

**Deliverables:**

- `contracts/data-product-consumer-lock-v1.schema.json`;
- examples；
- conformance tests。

**Acceptance:** Digital Biome 可用同一个 generic parser 验证三份 lock，只把 product-specific payload parsing 留给 adapter。

### DPP-103 — Semantic digest conformance fixtures

**Goal:** 四仓对同一 canonical semantic object 产生完全相同的 digest。

**Implementation:**

1. 在 PDS 定义 canonical fixture；
2. 明确 semantic selector 为 `{schemaVersion,product,producer,payload}`；
3. producer tests 使用 fixture；
4. Digital Biome verifier 使用同一规则重新计算。

**Acceptance:** 所有实现对 fixture 返回同一 `sha256:...`；source revision 变化不改变 digest。

## 8. Phase 2 — Producer publication convergence

每个 producer 独立迁移，先发布新协议事件，同时保留短 compatibility window；不要一次性同时切三仓。

### DPP-201 — Thought Forest publication 修复并标准化

**Goal:** 恢复完整 immutable publication，并解决当前 producer/consumer event mismatch。

**Repository:** `thought-forest`

**Implementation:**

1. 保留现有 public test/export/verify；
2. 计算 semantic digest；
3. 查询最近成功的 `knowledge-public-v1-*` Release；
4. semantic no-op 时跳过 Release/dispatch；
5. changed 时创建/验证 exact `knowledge-public-v1-<GITHUB_SHA>` Release；
6. 计算 artifact/manifest digest；
7. Release 成功后 dispatch `data-product-published`；
8. 暂时可双发旧事件仅用于兼容，但旧事件不得触发另一套 source-based consumer；
9. publication summary 输出 changed/no-op/release/dispatch。

**Tests:**

- source-only workflow change => no Release；
- public note change => exactly one Release + event；
- re-run same SHA => idempotent；
- event never precedes Release。

**Acceptance:** 用一个真实但最小的 public semantic change 证明完整链路。

### DPP-202 — PDS catalog 增加 semantic no-op 与 standard dispatch

**Repository:** `personal-digital-system`

**Implementation:**

1. 保留 current immutable Release publishing；
2. 在 publish 前比较 latest semantic digest；
3. no-op 不创建新 Release；
4. changed Release 成功后 dispatch standard event；
5. 事件携带 artifact/manifest/semantic digest。

**Acceptance:** catalog semantic no-op 不创建 release；真实 repository/domain 变化产生单次 event。

### DPP-203 — Personal Infrastructure 对齐 standard event

**Repository:** `personal-infrastructure`

**Goal:** 复用现有成熟 semantic publication，主要替换 contract/event shape。

**Implementation:**

1. 保留 semantic digest/no-op；
2. 保留 exact immutable Release；
3. 将 `infra-public-v2-published` 迁到 `data-product-published`；
4. payload 对齐 PDS schema；
5. 保留短 compatibility window；
6. dispatch 失败仍明确记录“reconciliation will recover”。

**Acceptance:** existing semantic no-op behavior不回退；changed publication 被 generic test fixture 接受。

## 9. Phase 3 — Digital Biome generic consumer

### DPP-301 — 建立 product registry 与 generic lock parser

**Goal:** Digital Biome 有一个公共产品 registry，而不是三套 workflow hard-code。

建议类型：

```ts
interface PublicDataProductDefinition {
  product: string;
  producerRepository: string;
  artifactName: string;
  manifestName: string;
  lockPath: string;
  buildTime: true;
  materializer: string;
}
```

Registry 初始只包含三个 active product。

**Acceptance:** unknown product/producer fail closed。

### DPP-302 — Generic Release fetch + verify

**Goal:** Consumer 永远只读 immutable producer Release。

**Implementation:**

1. 使用统一 read-only GitHub App；
2. 按 lock/event exact release tag 下载 artifact + manifest；
3. 校验 SHA；
4. 校验 manifest source/repository/product；
5. parse product envelope；
6. recompute semantic digest；
7. 输出 canonical verified identity。

**Out of scope:** private RuntimeBinding。

**Acceptance:** forged event、wrong repo、wrong digest、wrong tag、wrong source 全部拒绝。

### DPP-303 — 统一三份 public lock

**Goal:** knowledge/PDS/infra lock 都符合 protocol-v1。

**Migration:**

- 保留当前 source/release digest；
- 补 `protocolVersion`；
- 补 `semanticSha256`；
- PDS lock 补 manifest identity；
- 转换必须通过真实 Release 验证生成，禁止手填未知 digest。

**Acceptance:** generic lock parser 通过三份真实 lock。

### DPP-304 — PDS catalog build-time materialization

**Goal:** 删除 Digital Biome tracked upstream projection copy。

**Implementation:**

1. 新增 `pds-catalog-v1` adapter/materializer；
2. build 从 lock 下载 exact Release；
3. materialize 到 `.pds-runtime/pds-catalog-v1/`；
4. consumer output 写 `src/data/system/pds-catalog-v1.json`；
5. 将该 output gitignore；
6. 保持 `src/utils/personal-systems.ts` import contract 不变，优先减少应用代码 diff；
7. parity test 比较迁移前后 semantic JSON。

**Acceptance:** 删除 tracked projection 后 `pnpm build:only` 在 prepare 后仍产生相同 `/systems` read model。

### DPP-305 — Generic prepare-all

**Goal:** `pnpm sync`/CI/Candidate 使用一个入口准备三个 public products。

Target：

```bash
pnpm sync:data-products
```

内部：

```text
verify locks
 -> fetch exact releases
 -> materialize knowledge
 -> materialize pds catalog
 -> materialize infra
 -> generate consumer indexes/read models
```

允许 product-specific adapter，但 release identity/fetch/verify 必须 generic。

**Acceptance:** local、PR CI、main CI、Candidate 使用同一 prepare contract。

### DPP-306 — Generic event consumer workflow

**Goal:** 删除三份不同的 producer update consumer workflow。

新 workflow：

`.github/workflows/sync-data-products.yml`

触发：

- `repository_dispatch: data-product-published`;
- manual dispatch for exact product/release recovery。

流程：

1. validate payload；
2. allowlist；
3. fetch exact Release；
4. verify；
5. compare current lock；
6. no-op or write lock only；
7. branch `automation/data-product-<product>`；
8. create/refresh PR；
9. wait protected CI。

**Acceptance:** 三个 product 走同一 workflow path。

### DPP-307 — Generic scheduled reconciliation

新 workflow：

`.github/workflows/reconcile-data-products.yml`

推荐 cadence：

```cron
17 */6 * * *
```

流程逐个 product 查询 latest valid immutable semantic Release，复用 DPP-302 verifier。

**Acceptance:** 模拟丢掉 dispatch 后，reconciliation 能生成与 event path 完全相同的 lock diff。

### DPP-308 — Trusted lock-only auto-merge

**Goal:** 数据同步不需要人工点 merge，但不能扩大为任意 bot auto-merge。

**Required classifier:**

- branch prefix；
- author/workflow provenance；
- changed files subset of three public lock paths；
- no private binding lock；
- CI success；
- live release verification success。

建议 repository variable kill switch：

`DATA_PRODUCT_AUTO_MERGE_ENABLED=true|false`

**Acceptance:** 加一个 README 或 workflow 文件到 PR 时 auto-merge 必须 fail closed。

## 10. Phase 4 — Candidate/Release provenance v5

### DPP-401 — Generic `dataProducts` manifest

**Goal:** Candidate 显式记录全部 public build inputs。

建议 schema：

- `digital-biome.candidate/v5`;
- `digital-biome.release/v5`.

字段：

- exact application SHA/CI；
- `dataProducts` map；
- `privateBindings` map；
- Pages artifact identity。

**Acceptance:** 三个 public product 缺任意一个时 Candidate build fail。

### DPP-402 — v4/v3 rollback 兼容窗口

**Goal:** v5 上线时不破坏真实 rollback Release。

规则：

- new Candidate/Release 只写 v5；
- Production verifier 在窗口期读 v5/v4/v3；
- v4/v3 不新增功能，只用于已发布 rollback；
- 至少一次 v5 real production proof + rollback drill 后再另立 ADR 决定是否退休 v3/v4。

## 11. Phase 5 — Data-only Content Delivery

### DPP-501 — Exact main data-only classifier

**Goal:** 判断 Candidate 是否可进入自动 content lane。

比较 exact main commit 与 first parent，允许路径初始仅：

```text
data-products/knowledge-public-v1.lock.json
data-products/pds-catalog-v1.lock.json
data-products/infra-public-v2.lock.json
```

必须拒绝：

- workflow；
- package/lockfile；
- source code；
- docs + lock 混合；
- private binding lock；
- generated projection；
- presentation policy。

**Acceptance:** positive/negative matrix contract tests。

### DPP-502 — `production-content` Environment

配置：

- Cloudflare account/token；
- no required reviewer；
- workflow 限制；
- branch policy 仅 main；
- 与 application `production` 环境隔离。

若未来使用短期/OIDC credential，可再去重 secret；本阶段不阻塞。

### DPP-503 — `deploy-content.yml`

触发：successful exact main Candidate。

执行：

1. resolve Candidate；
2. run data-only classifier；
3. classifier false => safe no-op；
4. download exact Candidate artifact；
5. verify candidate digest/provenance；
6. verify all data product locks；
7. deploy same artifact `--no-bundle`；
8. public smoke；
9. protected API boundary smoke；
10. record Cloudflare deployment ID/URL；
11. write GitHub deployment/environment record。

建议 kill switch：

`CONTENT_AUTO_DEPLOY_ENABLED=true|false`

**Acceptance:** 一次真实 knowledge lock-only change 自动完成生产内容更新，不产生 semver application Release。

### DPP-504 — Private binding lane 明确隔离

**Goal:** private value-only update 不触发 static content build。

检查：

- public `privateRef` coverage；
- private binding update workflow；
- Cloudflare secret mutation；
- authenticated smoke。

**Acceptance:** 修改 private endpoint、public projection unchanged 时 Digital Biome public Candidate count 不增加。

## 12. Phase 6 — Cleanup 与 hardening

### DPP-601 — 删除 legacy events/workflows

在新协议稳定后退休：

- `thought-forest-updated`;
- `knowledge-public-v1-published`;
- `infra-public-v2-published`;
- `pds-catalog-v1-published`；
- Digital Biome 三个 bespoke sync workflow；
- consumer producer-source export paths。

删除前要求 direct event + reconciliation 各自对三个 product 都有成功证据。

### DPP-602 — 凭据收敛

公共 release reader 收敛到一个 GitHub App：

- Digital Biome；
- Thought Forest；
- PDS；
- Personal Infrastructure；
- Contents Read only。

删除不再需要的 public projection deploy keys。

Private RuntimeBinding credential 不合并。

### DPP-603 — Observability

每次 producer publication：

- source SHA；
- semantic digest；
- changed/no-op；
- Release；
- dispatch result。

每次 consumer sync：

- trigger；
- old/new identity；
- verification；
- PR/no-op。

每次 content production：

- Digital Biome SHA；
- Candidate digest；
- dataProducts identities；
- Pages artifact SHA；
- Cloudflare deployment；
- smoke。

### DPP-604 — Failure injection / recovery drill

至少验证：

1. drop dispatch；
2. bad event digest；
3. producer Release missing asset；
4. lock PR CI fail；
5. content Candidate fail；
6. Cloudflare deploy fail；
7. post-deploy smoke fail；
8. kill switch pause；
9. rollback previous deployment。

## 13. 依赖顺序

```text
DPP-001/002
   |
   v
DPP-101/102/103
   |
   +------> DPP-201
   +------> DPP-202
   +------> DPP-203
                |
                v
         DPP-301/302/303
                |
        +-------+-------+
        v               v
     DPP-304         DPP-306/307
        |               |
        +-------+-------+
                v
             DPP-305
                |
                v
             DPP-308
                |
                v
          DPP-401/402
                |
                v
        DPP-501/502/503
                |
                v
             DPP-504
                |
                v
        DPP-601..604
```

Producer migration可以并行，但 consumer cutover 在至少一个 producer 完成 standard publication proof 后开始。

## 14. Verification matrix

| Area | Focused | Wider |
| --- | --- | --- |
| Thought Forest exporter | `npm run kb:public:test/export/verify` | producer publish workflow |
| PDS exporter | Python unittest + export + verify | catalog workflow |
| Infra exporter | registry validate + unittest + export + verify | deployment/publication workflows |
| Generic lock/verifier | targeted TS tests | `pnpm test:infrastructure` |
| Digital Biome app | `pnpm check`, focused tests | `pnpm verify` |
| Build/materialization | adapter parity | `pnpm verify:full` |
| Delivery contract | workflow/manifest tests | protected GitHub CI |
| Content deploy | dry/no-op + staging/preview if available | one real production content update |
| Recovery | forced dropped event | scheduled reconciliation proof |

## 15. Rollout strategy

采用逐步双轨而非 big-bang：

1. protocol docs + schemas；
2. producers 能发布 standard event；
3. Digital Biome generic consumer 先支持 standard event，但旧 workflows 仍保留；
4. 每个 product 单独 shadow verify：old path identity == new path identity；
5. PDS projection copy 最后切到 materialization；
6. generic reconciliation green；
7. auto-merge 打开；
8. Candidate v5；
9. content deploy 先 kill-switch off 做 classifier/no-op 观察；
10. 打开 auto content promotion；
11. 最后删除 legacy path。

## 16. 回滚/containment

任一阶段异常：

- producer publication：停止 dispatch，不修改既有 immutable Release；
- consumer generic sync：关闭 `DATA_PRODUCT_AUTO_MERGE_ENABLED`；
- content deployment：关闭 `CONTENT_AUTO_DEPLOY_ENABLED`；
- build parity：保留旧 product-specific materializer 到该 product cutover 完成；
- Production：Cloudflare rollback 到 previous deployment；
- protocol bug：停止 producer standard dispatch，由 reconciliation 暂停而不是改 source；
- v5 delivery bug：application production 保留 v4/v3 rollback verifier。

禁止通过修改已发布 producer Release 内容“修复”问题。

## 17. 完成定义

只有以下全部成立才认为收敛完成：

- [ ] 三个 public producer 使用同一 publication event/schema；
- [ ] 三个 producer 都 semantic no-op；
- [ ] 三个产品 immutable Release 可由同一 consumer verifier 验证；
- [ ] Digital Biome 只 tracked public locks；
- [ ] PDS projection copy 已 untracked；
- [ ] generic event consumer 生效；
- [ ] generic reconciliation 生效且恢复过一次 dropped event；
- [ ] bespoke source-regeneration sync 已删除；
- [ ] trusted lock-only auto-merge 有 fail-closed tests；
- [ ] Candidate v5 显式记录三个 data products；
- [ ] data-only exact Candidate 自动生产发布 proof；
- [ ] app semver/manual production lane 未被弱化；
- [ ] private value-only change 无 static rebuild；
- [ ] `pnpm verify:full` green；
- [ ] Cloudflare production smoke green；
- [ ] architecture/operations docs 更新为 implemented state。
