# Data Product / Content Delivery 运维与故障恢复 Runbook

> 状态：实现已进入 PR 栈，自动开关当前关闭；生产激活证据见 `data-product-takeover-status.md`。下列恢复操作应按已启用的阶段执行。
> 对应：ADR-0005、PDS Data Product Protocol v1

## 1. 运行模型

正常传播：

```text
producer semantic change
 -> immutable product Release
 -> data-product-published
 -> Digital Biome verified lock PR
 -> protected CI
 -> auto-merge
 -> main CI
 -> immutable Candidate
 -> automatic content promotion
```

恢复传播：

```text
dispatch missing
 -> scheduled reconciliation
 -> same Release verifier
 -> same lock-only PR
```

应用代码发布仍走 semver Release + manual Production promotion。

## 2. 关键原则

排障时必须区分：

1. producer source 是否改变；
2. public projection semantic digest 是否改变；
3. immutable Release 是否创建成功；
4. Digital Biome lock 是否更新；
5. main Candidate 是否构建；
6. content production 是否 promotion；
7. private RuntimeBinding 是否独立更新。

不要用“producer main 最新 SHA”和“站点是否应该更新”直接画等号。

## 3. Kill switches

实现后维护两个 repository variables：

### `DATA_PRODUCT_AUTO_MERGE_ENABLED`

- `true`：verified lock-only PR 可自动合并；
- `false`：sync/reconciliation 仍创建 PR，但必须人工 merge。

适合：

- consumer verifier 怀疑有 bug；
- GitHub branch protection 异常；
- producer contract 大迁移；
- 需要观察一段时间。

### `CONTENT_AUTO_DEPLOY_ENABLED`

- `true`：data-only Candidate 可自动 promotion；
- `false`：Candidate 仍生成，但生产不自动改变。

适合：

- Cloudflare 故障；
- leakage/smoke gate 可疑；
- 大批知识迁移希望先验收 staging/Candidate；
- production-content credential rotation。

关闭 kill switch 不应停止 producer immutable publication，也不应删除 lock PR。

## 4. Product status checklist

对任一产品按顺序检查：

```text
A. producer main SHA
B. exporter/validator
C. semantic digest
D. latest immutable Release
E. publication event
F. Digital Biome current lock
G. lock PR
H. PR CI
I. main CI
J. Candidate
K. content deployment
L. production smoke
```

只有前一步正确，才继续追后一步。

## 5. Scenario A — Producer merge 后 Digital Biome 完全没动

### 判断

先确认 public semantic 是否真的变化。

如果 semantic digest unchanged：

**这是正常 no-op。**

例如：

- README；
- tests；
- workflow；
- private/non-projected content；
- exporter refactor 但 public payload 相同。

### 若 semantic digest changed

检查 producer：

1. Release 是否存在；
2. tag 是否为 `<product>-<sourceSHA>`；
3. artifact/manifest 是否存在；
4. publication summary 的 dispatch 是否成功。

如果 Release 不存在：

- 修 producer publication；
- 重新运行 exact SHA publication；
- 不手工伪造 Digital Biome lock。

如果 Release 存在但 dispatch 失败：

- 不需要重发 source commit；
- 可重跑 publication 的 notify step，或等待/手动触发 reconciliation；
- reconciliation 应读取现有 Release。

## 6. Scenario B — Dispatch 成功，但没有 lock PR

检查 Digital Biome `sync-data-products`：

- payload schema；
- product allowlist；
- producer repository allowlist；
- release tag/source consistency；
- GitHub App read token；
- artifact/manifest digest；
- semantic digest。

### 常见结论

**Event malformed / forged**

动作：拒绝 event，producer 修 publication payload。

**Release verification failed**

动作：不更新 lock。检查 producer Release 是否被错误发布；immutable Release 不允许修改覆盖，应修 producer 后从新的 source revision 发布 corrected product。

**Current lock semantic identity already equal**

动作：正常 no-op。

**Automation branch/PR conflict**

动作：刷新固定 product automation branch，保留一个 open PR，不创建多个竞争 PR。

## 7. Scenario C — Scheduled reconciliation 失败

Reconciliation 的职责是恢复 missed event，不是第二套 producer build system。

必须确认它没有：

- checkout producer `main`；
- 运行 producer exporter；
- 从 mutable generated file 判断 latest。

### `Resolve immutable producer identity` 类失败

检查：

1. latest matching Release 是否存在；
2. Release tag 是否符合 product/source contract；
3. Release target 是否 exact source revision；
4. artifact/manifest asset 是否齐全；
5. read-only GitHub App 是否安装到 producer；
6. pagination/filter 是否错误选到无关 Release。

修复后重新运行 reconciliation；不直接修改 lock 绕过 verifier。

## 8. Scenario D — Lock PR CI 失败

自动合并必须停止。

按层定位：

### Lock verifier fail

- identity/digest 不一致；
- wrong producer；
- product schema drift。

动作：修 producer publication 或 consumer contract，禁止 bypass。

### Materializer fail

- adapter compatibility；
- generated path；
- consumer-specific transform。

动作：在独立 worktree 复现 exact lock，先跑 focused adapter test，再跑 full build。

### `pnpm verify:full` fail

按现有 Digital Biome gate 处理：

- lint/format；
- Astro check；
- unit/infrastructure tests；
- static build；
- Pagefind；
- leakage scan；
- performance budget。

只有全部 green 才允许 merge。

## 9. Scenario E — 自动合并没有发生

确认：

- `DATA_PRODUCT_AUTO_MERGE_ENABLED=true`;
- PR head 是 automation branch；
- changed paths 仅 public lock allowlist；
- private RuntimeBinding lock 未变化；
- protected CI green；
- live Release verification green。

若 PR 还包含 docs、workflow、source code：

**预期行为是 fail closed。**

人工 review，而不是扩大 allowlist 来迁就异常 PR。

## 10. Scenario F — main 已 merge，但 Candidate 没生成

检查 exact main CI：

- event 必须是 main push；
- conclusion success；
- Candidate resolver 的 exact head SHA 必须一致。

不要手工从另一个 SHA 生成 Candidate。

修 CI 后可用现有 workflow 的 exact-run resume/manual entry 恢复。

## 11. Scenario G — Candidate green，但没有自动生产内容更新

检查：

- exact main commit 是否被 data-only classifier 接受；
- `CONTENT_AUTO_DEPLOY_ENABLED`;
- `production-content` Environment；
- Candidate artifact/digest；
- candidate manifest 是否含三个 public dataProducts；
- Cloudflare credential。

如果 classifier 返回 false：

这是正常 safe no-op，该 commit 属于 application lane。

不要为了自动上线而手工标记为 data-only。

## 12. Scenario H — Content deployment 上传失败

Production 不 rebuild。

动作：

1. 保留 exact Candidate；
2. 检查 Cloudflare API/credential/rate limit；
3. 修控制面后重新 promotion 同一 Candidate；
4. 再次校验 digest；
5. `--no-bundle` 上传；
6. smoke。

禁止重新 build “一个看起来一样”的 artifact 代替原 Candidate，除非原 Candidate 本身被明确废弃并走新的 main CI。

## 13. Scenario I — 上传成功但 smoke 失败

将 deployment 视为失败。

### 优先动作

1. 获取前一个 known-good Cloudflare deployment ID；
2. rollback/re-promote 前一个 deployment；
3. 验证公开首页；
4. 验证关键 knowledge/system/infrastructure route；
5. 验证 `/api/private/*` 未登录边界；
6. 记录 failed deployment ID 与 Candidate identity。

之后再判断根因：

- public content defect；
- build/index defect；
- Cloudflare propagation；
- private secret/binding mismatch；
- Access policy/control-plane 问题。

## 14. Scenario J — 新知识投影包含不应公开的数据

这是 P0。

立即：

1. `CONTENT_AUTO_DEPLOY_ENABLED=false`;
2. rollback 到 previous known-good production deployment；
3. 如 Release artifact 本身泄漏，标记该 producer publication 为 unsafe；
4. 修 producer privacy/export policy；
5. 从新的 source revision 发布 corrected immutable product；
6. consumer lock forward-fix；
7. 重新 build/leak scan/deploy；
8. 审查搜索 index/Pagefind 与缓存。

不要修改已有 immutable Release asset 来掩盖泄漏。

如果 secret/credential 真正暴露，按对应系统执行 rotate；仅删除页面不够。

## 15. Scenario K — PDS/Infra/Knowledge 需要紧急回退

优先区分：

### 只是 production presentation 错

Cloudflare rollback previous deployment。

### Producer semantic publication 本身错误

推荐 forward fix：

```text
producer corrected main
 -> new immutable semantic Release
 -> new lock
 -> new Candidate
 -> new content promotion
```

### 必须 pin 回旧 product

通过正常 reviewed PR revert consumer lock，然后完整 CI/Candidate/promotion。

禁止 mutable tag/asset replacement。

## 16. Scenario L — Private RuntimeBinding value-only 更新

如果 public `privateRef` 集合不变：

- 不触发 public Data Product；
- 不触发 static Candidate；
- 验证 exact private binding revision/digest；
- 更新 encrypted Pages binding；
- authenticated smoke。

若 public ref coverage 变化：

- Personal Infrastructure 同时产生新的 `infra-public-v2` semantic publication；
- public projection 跟正常 content lane 走；
- private binding 仍独立验证。

## 17. 手工 reconciliation

正常不应手写 lock。

手工恢复入口应调用 `reconcile-data-products.yml` 或 `sync-data-products.yml` 的 workflow_dispatch，并指定：

- product；
- exact release tag（可选，未指定则解析 latest valid semantic release）。

workflow 仍必须经过同一 verifier。

手工 workflow 不是 bypass。

## 18. 观察指标

建议在 Actions summary/未来 dashboard 维护：

| 指标 | 目的 |
| --- | --- |
| latest producer semantic release | producer publication health |
| current consumer lock source revision | consumer freshness |
| semantic lag | 是否 missed event |
| last dispatch result | event health |
| last reconciliation result | recovery health |
| open automation PR | blocked consumer update |
| last data-only Candidate | build health |
| last content deployment | production freshness |
| last smoke result | serving health |

对于正常 event-driven path，producer publication 到 lock PR 应接近 GitHub Actions 启动延迟；6 小时 reconciliation 只是最大恢复窗口，不是正常 freshness SLA。

## 19. 变更窗口与大批量知识更新

例如一次导入/整理数百篇公开笔记：

推荐：

1. 在 Thought Forest 一个有边界的 merge 中完成；
2. producer 只发布一次 semantic product；
3. 如需人工观察，临时设置 `CONTENT_AUTO_DEPLOY_ENABLED=false`;
4. 等 lock PR + Candidate 全绿；
5. 检查 Candidate/preview 的：
   - note count；
   - tag/link graph；
   - Pagefind；
   - leakage；
   - performance；
6. 再开启 content promotion 或手工运行 exact Candidate promotion。

不要拆成大量无意义的小 merge 只为了“让同步更安全”；真正安全边界是 immutable product + gates。

## 20. 故障优先级

### P0

- private data/secret 泄漏；
-错误 producer identity 被消费；
- arbitrary code diff 进入 trusted auto-deploy lane；
- production content 无法可靠 rollback。

### P1

- semantic changed 但 event/reconciliation 都无法推进；
- verifier 错误接受 digest mismatch；
- static build 与 lock provenance 不一致；
- private/public ref coverage 破坏。

### P2

- direct dispatch 失败但 reconciliation 可恢复；
- automation PR 冲突；
- observability 缺字段；
- reconciliation latency 过高。

### P3

- summary/log 命名；
-非阻断性文档/展示优化。

## 21. 关闭故障的证据

“重新跑绿了”不足以关闭数据供应链故障。

至少记录：

- affected product；
- source revision；
- semantic digest；
- immutable Release；
- consumer lock；
- PR/main SHA；
- Candidate digest；
- deployment ID（若到 production）；
- smoke result；
- root cause；
- regression test 或 contract gate。

这样后续才能判断是 producer、transport、consumer、build 还是 deployment 问题。
