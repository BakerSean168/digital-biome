# Digital Biome 资产架构设计

## 文档目标

本文档定义 Digital Biome 下一阶段的资产体系设计，目标是把站点从“知识笔记 + 收藏导航”扩展为“知识站 + 资产入口 + 服务状态视图”。

这里的“资产”指可被站点识别、聚合、导航和监控映射的实体，例如：

- 自建服务
- 外部工具网站
- VPS / 物理机 / VM
- 家庭网络关键节点

本文档描述的是目标架构，而非当前代码中已全部落地的现状。

## 设计原则

### 1. Obsidian 仍然是主内容空间

- `thought-forest` 仍是唯一主内容空间
- 资产事实也以 Obsidian 笔记形式存在
- 不额外引入独立 CMS 或单独后台

### 2. 资产笔记是主入口，不是唯一真相

- 资产笔记负责稳定、低频变化的事实
- 运行状态、探活结果、资源指标来自外部系统
- 站点以资产笔记为主键，再吸收外部运行态

### 3. 一资产一笔记

- 一台物理机一篇
- 一个 VPS 一篇
- 一个 VM 一篇
- 一个服务一篇
- 一个工具网站一篇
- 一个关键网络节点一篇

### 4. frontmatter 为真，目录为辅助

- 目录用于组织
- 程序识别以 frontmatter 为准
- 目录和 frontmatter 不一致时，应视为数据异常

### 5. 首页是启动页，不是资产总表

首页第一屏只承担高频进入职责：

- 搜索框
- `My Services`
- `Tools`

完整资产目录和关系视图进入二级页面。

## 内容源分层

### 当前内容源

当前项目主要同步：

- `thought-forest/z`
- `thought-forest/config`

### 目标内容源

后续同步升级为多根目录：

- `thought-forest/z`
- `thought-forest/assets`
- `thought-forest/config`

含义如下：

- `z/`：知识笔记、教程、MOC、说明文档
- `assets/`：资产笔记
- `config/`：站点配置型笔记

## 资产目录结构

资产笔记单独存放在 vault 的 `assets/` 下，第一阶段目录结构如下：

```text
assets/
├── services/
├── tools/
├── hosts/
└── network/
```

目录语义：

- `services/`：自建服务、管理面板、可直接进入的服务入口
- `tools/`：外部工具网站、资源站、常用网页工具
- `hosts/`：物理机、VPS、VM 等宿主类节点
- `network/`：家庭网络中的主路由、交换机、AP、网络入口节点

## 资产类型系统

第一阶段只承认 4 类顶层资产：

| 资产类型 | 含义 |
|----------|------|
| `service` | 可直接使用或直接进入管理界面的目标 |
| `tool` | 外部工具网站、资源网站 |
| `host` | 物理机、VPS、宿主机、VM |
| `network` | 家庭网络关键节点 |

说明：

- `vm` 第一阶段不单独作为顶层类型
- VM 归入 `asset_type: host`
- 使用 `host_kind: vm` 进一步区分

## 资产主键与命名规范

### asset_id

每个资产必须有稳定的 `asset_id`，并带类型前缀：

- `svc-vaultwarden`
- `svc-sub-store`
- `tool-github`
- `host-n100-pve`
- `host-azure-vps-01`
- `net-home-main-router`

约束：

- `asset_id` 是资产主键
- 外部事实映射必须基于 `asset_id`
- 站点 URL slug 由 `asset_id` 派生

### 文件名

文件名机器化、稳定化；`title` 保持人类可读。

示例：

```text
assets/services/vaultwarden-service.md
assets/hosts/n100-pve-host.md
assets/network/home-main-router.md
```

示例 frontmatter：

```yaml
title: Vaultwarden
type: asset
asset_id: svc-vaultwarden
asset_type: service
```

## 资产与知识笔记的关系

资产笔记与知识说明默认同一篇承载：

- frontmatter 存结构化事实
- 正文存说明、经验、部署记录、踩坑

必要时再拆出附属知识笔记，但第一阶段不强制分离。

普通知识笔记和资产笔记仍然可以互相双链。

## 可见性策略

资产笔记采用保守可见性策略：

- 默认 `private`
- 手动公开

推荐字段：

```yaml
visibility: public | private | internal
```

语义：

- `public`：可进入公开站点
- `private`：只留在源笔记，不进入公开构建
- `internal`：预留给未来私有视图

## frontmatter 约定

### 资产笔记公共字段

第一阶段的高约束公共字段如下：

```yaml
title:
type: asset
asset_id:
asset_type:
visibility:
description:
tags:
links:
```

说明：

- 上述约束仅对 `type: asset` 生效
- 普通知识笔记不走这套强 schema

### links 结构

资产入口统一使用 `links` 数组，而不是大量平铺字段。

推荐结构：

```yaml
links:
  - label: app
    url: https://pass.example.com
    kind: primary
  - label: admin
    url: https://pass.example.com/admin
    kind: admin
  - label: docs
    url: /notes/obsidian/vaultwarden
    kind: docs
```

如果某类资产存在明显主入口，可额外保留一个快捷字段，但不作为长期主要入口模型。

### homepage 结构

首页展示规则采用显式对象，不使用简单布尔值。

推荐结构：

```yaml
homepage:
  enabled: true
  section: services | tools
  order: 10
```

规则：

- 不是所有资产都必须填写 `homepage`
- 只有“要上首页”的资产才必须完整填写该对象
- 首页展示完全由 `homepage` 控制

## 关系模型

第一阶段关系字段尽量少，但语义必须清楚。

### service -> host

服务必须显式声明运行宿主：

```yaml
host_asset_id: host-debian-docker-vm
```

规则：

- `host_asset_id` 只给 `service` 使用
- 不用 `depends_on` 代替宿主归属

### host / network 层级

宿主与网络类资产使用 `parent_asset_id` 表达层级归属：

```yaml
parent_asset_id: host-n100-pve
```

或：

```yaml
parent_asset_id: net-home-lan
```

规则：

- `service` 用 `host_asset_id`
- `host/network` 用 `parent_asset_id`

### 其他关系

可保留以下补充字段：

- `depends_on`
- `related_notes`

但它们不承担核心层级归属语义。

## 运行态与监控集成

### 边界

Obsidian 不负责频繁变化的运行态，例如：

- 在线 / 离线
- CPU / 内存
- 心跳时间
- 响应时间
- 告警状态

这些数据来自外部系统。

### 来源分工

- `service` 状态主来源：`Uptime Kuma`
- `host` 状态主来源：`哪吒`

原因：

- 服务页和首页服务圆点关注的是“服务能不能用”
- 宿主页关注的是“节点是不是活着、资源是否异常”

### monitor 结构

监控映射采用统一 `monitor` 对象：

```yaml
monitor:
  uptime_kuma:
    monitor_id: vaultwarden
  nezha:
    server_id: host-azure-vps-01
```

规则：

- `monitor` 字段本身可选
- 一旦存在，子结构应遵守约定
- `service` 推荐优先接 `monitor.uptime_kuma`
- `host` 推荐优先接 `monitor.nezha`

## 页面信息架构

### 首页 `/`

首页定位为启动页，第一屏只放：

- 搜索框
- `My Services`
- `Tools`

说明：

- `My Services` 与 `Tools` 分区展示
- 首页只展示精选项
- 不承担全量资产目录职责

### 服务页 `/services`

规则：

- 自动收纳所有 `asset_type: service`
- 不依赖 `homepage`
- 展示状态圆点、宿主、入口链接、说明摘要

### 工具页 `/tools`

规则：

- 自动收纳所有 `asset_type: tool`
- 不依赖 `homepage`

### 基础设施页 `/infrastructure` 或 `/atlas`

职责：

- 展示家庭网络
- 展示 PVE / VPS / VM / 服务关系
- 作为宿主与网络资产的关系图入口

第一阶段说明：

- 以手工维护的资产笔记关系为准
- 不从 infra 仓库自动生成拓扑

### 知识笔记页 `/notes`

规则：

- 默认不列出资产笔记
- 只承载普通知识阅读与导航

### 站内搜索

站内搜索统一搜索：

- 知识笔记
- 资产笔记

但结果必须显式标注类型，例如：

- `Service · Vaultwarden`
- `Host · N100 PVE`
- `Note · Vaultwarden 部署实践`

## 资产详情页

资产笔记在站点中应采用特殊详情体验，而不是完全复用普通 notes 阅读页。

推荐结构：

1. 顶部结构化事实卡
2. 入口链接区
3. 状态与宿主关系区
4. 正文说明区
5. 相关笔记与反向链接区

也就是说：

- `type: asset` -> 资产增强详情页
- 其他笔记 -> 普通 `NotesLayout`

## URL 设计

知识笔记继续走：

- `/notes/...`

资产采用独立 URL 空间：

- `/services/...`
- `/tools/...`
- `/hosts/...`
- `/network/...`

规则：

- URL slug 以 `asset_id` 为源派生
- 不依赖标题生成 URL

## 当前实现与目标实现的差异

当前项目主要还是：

- 知识笔记系统
- 收藏/书签型首页
- 普通 notes 阅读体验

本设计引入的新增能力包括：

- 统一资产笔记体系
- 多根目录同步
- 资产专属 schema
- 资产聚合页
- 资产详情页
- 服务状态与宿主关系展示

## 第一阶段实现顺序

建议按以下顺序落地：

1. 扩展同步逻辑，支持 `z/ + assets/ + config/`
2. 扩展 Content Collections schema，支持资产字段
3. 增加 asset 查询层
4. 改造首页，读取 `homepage.section`
5. 实现 `/services` 与 `/tools`
6. 实现资产详情页
7. 实现 `/infrastructure` 或 `/atlas`
8. 接入 `Uptime Kuma` / `哪吒` 状态映射

## 暂不纳入第一阶段的功能

以下能力明确排除在第一阶段外：

- 版本快照 / 架构演进时间线
- 从 infra 仓库自动生成家庭网络拓扑
- 完整实时监控聚合控制台
- 独立后台 CMS
