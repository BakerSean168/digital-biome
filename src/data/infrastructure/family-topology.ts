export type TopologyNodeKind =
  | 'external'
  | 'network'
  | 'host'
  | 'hypervisor'
  | 'vm'
  | 'service'
  | 'tool';

export type TopologyNodeStatus = 'active' | 'planned' | 'internal';

export interface TopologyNode {
  id: string;
  title: string;
  kind: TopologyNodeKind;
  description: string;
  assetId?: string;
  status?: TopologyNodeStatus;
  chips?: string[];
  href?: string;
  primaryUrl?: string;
  monitorUrl?: string;
}

export interface TopologyFlow {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  steps: TopologyNode[];
}

export const familyTopology: TopologyFlow[] = [
  {
    id: 'public-edge',
    eyebrow: 'Public Edge',
    title: '公网控制平面与统一入口',
    description: '这条链路负责域名代理、控制平面 VPS、订阅分发与节点监控，是你公网资产的统一入口层。',
    steps: [
      {
        id: 'internet',
        title: 'Internet',
        kind: 'external',
        description: '外部访问入口',
        chips: ['入口'],
      },
      {
        id: 'bakersean-top-domain',
        title: 'bakersean.top 域名',
        kind: 'network',
        assetId: 'net-bakersean-top-domain',
        description: '阿里云注册、Cloudflare 托管的统一域名入口层',
        status: 'active',
        chips: ['DNS Zone'],
      },
      {
        id: 'cloudflare-edge',
        title: 'Cloudflare Edge',
        kind: 'external',
        description: '域名代理、访问控制与统一回源',
        chips: ['DNS', 'Access', 'Proxy'],
      },
      {
        id: 'public-edge-network',
        title: '公网边缘节点',
        kind: 'network',
        assetId: 'net-public-edge',
        description: '公网能力的网络边界层',
        status: 'active',
      },
      {
        id: 'azure-hk-vps',
        title: 'Azure 香港控制平面 VPS',
        kind: 'host',
        assetId: 'host-azure-hk-vps',
        description: '承载 Nezha、Sub-Store 和公网运维控制入口',
        status: 'active',
      },
      {
        id: 'sub-store',
        title: 'Sub-Store',
        kind: 'service',
        assetId: 'svc-sub-store',
        description: '订阅管理与分发入口',
        status: 'active',
      },
      {
        id: 'nezha-panel',
        title: 'Nezha Panel',
        kind: 'service',
        assetId: 'svc-nezha-panel',
        description: 'VPS 节点与探针状态总览',
        status: 'active',
      },
    ],
  },
  {
    id: 'public-dailyuse',
    eyebrow: 'Public Workload',
    title: '阿里云业务负载',
    description: '这条链路代表你真正承载业务应用的公网主机与服务，目前以 DailyUse / Memoflow 为核心。',
    steps: [
      {
        id: 'public-edge-network-dailyuse',
        title: '公网边缘节点',
        kind: 'network',
        assetId: 'net-public-edge',
        description: '公网能力的统一网络边界层',
        status: 'active',
      },
      {
        id: 'aliyun-chengdu-dailyuse-vps',
        title: '阿里云成都 DailyUse VPS',
        kind: 'host',
        assetId: 'host-aliyun-chengdu-dailyuse-vps',
        description: '国内业务主机，承载 DailyUse / Memoflow 单机生产环境',
        status: 'active',
        chips: ['Chengdu', 'Aliyun'],
      },
      {
        id: 'memoflow-dailyuse',
        title: 'DailyUse / Memoflow',
        kind: 'service',
        assetId: 'svc-memoflow-dailyuse',
        description: '个人产品与生产业务服务',
        status: 'active',
        chips: ['Docker', 'Caddy', 'PowerSync'],
      },
    ],
  },
  {
    id: 'proxy-japan',
    eyebrow: 'Proxy Node',
    title: '日本代理节点',
    description: '区域代理节点之一，用来承接 sing-box 运行与东亚区域落点。',
    steps: [
      {
        id: 'public-edge-network-japan',
        title: '公网边缘节点',
        kind: 'network',
        assetId: 'net-public-edge',
        description: '公网能力的统一网络边界层',
        status: 'active',
      },
      {
        id: 'azure-japan-singbox-vps',
        title: 'Azure 日本 sing-box VPS',
        kind: 'host',
        assetId: 'host-azure-japan-singbox-vps',
        description: '日本区域代理宿主机',
        status: 'active',
        chips: ['Japan', 'Azure'],
      },
      {
        id: 'sing-box-japan',
        title: 'sing-box 日本节点',
        kind: 'service',
        assetId: 'svc-sing-box-japan',
        description: '日本区域的代理服务节点',
        status: 'active',
      },
    ],
  },
  {
    id: 'proxy-korea',
    eyebrow: 'Proxy Node',
    title: '韩国代理节点',
    description: '区域代理节点之一，用来承接 sing-box 运行与备用区域落点。',
    steps: [
      {
        id: 'public-edge-network-korea',
        title: '公网边缘节点',
        kind: 'network',
        assetId: 'net-public-edge',
        description: '公网能力的统一网络边界层',
        status: 'active',
      },
      {
        id: 'azure-korea-singbox-vps',
        title: 'Azure 韩国 sing-box VPS',
        kind: 'host',
        assetId: 'host-azure-korea-singbox-vps',
        description: '韩国区域代理宿主机',
        status: 'active',
        chips: ['Korea', 'Azure'],
      },
      {
        id: 'sing-box-korea',
        title: 'sing-box 韩国节点',
        kind: 'service',
        assetId: 'svc-sing-box-korea',
        description: '韩国区域的代理服务节点',
        status: 'active',
      },
    ],
  },
  {
    id: 'proxy-hk',
    eyebrow: 'Proxy Node',
    title: '香港代理节点',
    description: '香港区域的代理运行节点，和控制平面 VPS 分工独立。',
    steps: [
      {
        id: 'public-edge-network-hk',
        title: '公网边缘节点',
        kind: 'network',
        assetId: 'net-public-edge',
        description: '公网能力的统一网络边界层',
        status: 'active',
      },
      {
        id: 'azure-hk-singbox-vps',
        title: 'Azure 香港 sing-box VPS',
        kind: 'host',
        assetId: 'host-azure-hk-singbox-vps',
        description: '香港区域代理宿主机',
        status: 'active',
        chips: ['Hong Kong', 'Azure'],
      },
      {
        id: 'sing-box-hk',
        title: 'sing-box 香港节点',
        kind: 'service',
        assetId: 'svc-sing-box-hk',
        description: '香港区域的代理服务节点',
        status: 'active',
      },
    ],
  },
  {
    id: 'public-site-digital-biome',
    eyebrow: 'Public Site',
    title: 'Cloudflare Pages 公开站点',
    description: '公开站点层代表你对外展示知识、资产与个人基础设施的静态站点入口。',
    steps: [
      {
        id: 'internet-digital-biome',
        title: 'Internet',
        kind: 'external',
        description: '外部用户访问入口',
        chips: ['Visitors'],
      },
      {
        id: 'cloudflare-pages-host',
        title: 'Cloudflare Pages',
        kind: 'host',
        assetId: 'host-cloudflare-pages',
        description: '静态站点托管平台',
        status: 'active',
        chips: ['Static Hosting'],
      },
      {
        id: 'digital-biome-site',
        title: 'digital-biome',
        kind: 'service',
        assetId: 'svc-digital-biome-site',
        description: '个人网站与数字资产门户',
        status: 'active',
      },
    ],
  },
  {
    id: 'public-site-github',
    eyebrow: 'Public Site',
    title: 'GitHub Pages 公开主页',
    description: '这一条链路承接你在 GitHub Pages 上的轻量公开主页。',
    steps: [
      {
        id: 'internet-github-pages',
        title: 'Internet',
        kind: 'external',
        description: '外部用户访问入口',
        chips: ['Visitors'],
      },
      {
        id: 'github-pages-host',
        title: 'GitHub Pages',
        kind: 'host',
        assetId: 'host-github-pages',
        description: 'GitHub 提供的静态托管平台',
        status: 'active',
        chips: ['Static Hosting'],
      },
      {
        id: 'github-profile-site',
        title: 'GitHub 个人主页',
        kind: 'service',
        assetId: 'svc-github-profile-site',
        description: '公开的个人静态主页',
        status: 'active',
      },
    ],
  },
  {
    id: 'homelab-core',
    eyebrow: 'Homelab Core',
    title: '家庭服务运行主干',
    description: '这条链路负责从 N100 宿主机进入 PVE 与 Debian 服务 VM，再进入家庭服务入口，是家庭服务运行层的主干。',
    steps: [
      {
        id: 'n100-host',
        title: 'N100 主机',
        kind: 'host',
        assetId: 'host-n100-pve',
        description: '低功耗宿主机，家庭服务主承载点',
        status: 'active',
      },
      {
        id: 'pve-hypervisor',
        title: 'PVE',
        kind: 'hypervisor',
        assetId: 'svc-pve-panel',
        description: '虚拟化底座，负责承载后续虚拟机和服务编排',
        status: 'active',
        chips: ['Hypervisor'],
      },
      {
        id: 'services-vm',
        title: 'Debian 服务 VM',
        kind: 'vm',
        assetId: 'host-debian-services-vm',
        description: '当前服务容器与导航入口所在虚拟机',
        status: 'internal',
        chips: ['Docker', 'Service Layer'],
      },
      {
        id: 'homepage-dashboard',
        title: 'Homepage',
        kind: 'service',
        assetId: 'svc-homepage-dashboard',
        description: '家庭服务导航页与统一入口',
        status: 'active',
        href: '/notes/obsidian/debian-docker-deploy-homepage-vaultwarden',
        primaryUrl: 'http://192.168.0.51:3000',
      },
      {
        id: 'vaultwarden',
        title: 'Vaultwarden',
        kind: 'service',
        assetId: 'svc-vaultwarden',
        description: '密码库服务',
        status: 'active',
      },
    ],
  },
  {
    id: 'home-network-edge',
    eyebrow: 'Home Edge',
    title: '家庭入口、路由与无线接入',
    description: '这条链路表达从入户光猫、主路由、旁路由到家庭局域网、交换节点、TP-Link 设备与无线 AP 的网络控制关系。',
    steps: [
      {
        id: 'home-optical-modem',
        title: '家庭光猫',
        kind: 'network',
        assetId: 'net-home-optical-modem',
        description: '入户链路与桥接入口',
        status: 'active',
        chips: ['Bridge'],
      },
      {
        id: 'router-vm',
        title: 'RouterOS 主路由 VM',
        kind: 'vm',
        assetId: 'host-routeros-main-vm',
        description: '负责 PPPoE、NAT 与主路由控制',
        status: 'active',
        chips: ['PPPoE', 'Gateway'],
      },
      {
        id: 'istoreos-vm',
        title: 'iStoreOS 旁路由 VM',
        kind: 'vm',
        assetId: 'host-istoreos-sidecar-vm',
        description: '负责轻量网络服务和策略分流',
        status: 'active',
        chips: ['Sidecar Router'],
      },
      {
        id: 'home-lan',
        title: '家庭局域网',
        kind: 'network',
        assetId: 'net-home-lan',
        description: '你的内网入口与设备连接层',
        status: 'active',
      },
      {
        id: 'home-switch',
        title: '家庭主交换机',
        kind: 'network',
        assetId: 'net-home-switch',
        description: '负责把 N100、维护设备和后续网络节点接入到同一个二层分发层',
        status: 'active',
        chips: ['LAN Fabric'],
      },
      {
        id: 'tplink-router',
        title: 'TP-Link 路由器',
        kind: 'network',
        assetId: 'net-tplink-router',
        description: '家庭网络中的 TP-Link 接入设备节点，可继续承接局域网分发或无线覆盖',
        status: 'active',
        chips: ['TP-Link'],
      },
      {
        id: 'home-ap',
        title: '家庭 AP',
        kind: 'network',
        assetId: 'net-home-ap',
        description: '把家庭局域网扩展成实际可用的无线接入面，承接手机、平板、电视盒子和 IoT 设备',
        status: 'active',
        chips: ['Wi-Fi', 'Access Point'],
      },
    ],
  },
  {
    id: 'home-power-resilience',
    eyebrow: 'Power Safety',
    title: '家庭供电韧性层',
    description: '这条链路不表达网络流量，而是表达核心家庭节点在停电或闪断场景下的供电保护关系。',
    steps: [
      {
        id: 'utility-power',
        title: '市电输入',
        kind: 'external',
        description: '家庭供电的上游来源',
        chips: ['AC Input'],
      },
      {
        id: 'home-ups',
        title: '家庭 UPS',
        kind: 'network',
        assetId: 'net-home-ups',
        description: '为 N100、光猫和关键网络设备提供断电缓冲与优雅关机预留能力',
        status: 'planned',
        chips: ['Power Backup'],
      },
      {
        id: 'n100-host-power',
        title: 'N100 主机',
        kind: 'host',
        assetId: 'host-n100-pve',
        description: '家庭虚拟化与服务底座，需要重点保障连续供电',
        status: 'active',
        chips: ['Homelab Core'],
      },
      {
        id: 'home-switch-power',
        title: '家庭主交换机',
        kind: 'network',
        assetId: 'net-home-switch',
        description: '交换层一旦掉电，家庭网络内部设备会同时失去互联',
        status: 'active',
        chips: ['LAN Fabric'],
      },
      {
        id: 'home-optical-modem-power',
        title: '家庭光猫',
        kind: 'network',
        assetId: 'net-home-optical-modem',
        description: '如果光猫失电，主路由与公网链路会一起中断',
        status: 'active',
        chips: ['WAN Edge'],
      },
    ],
  },
  {
    id: 'home-storage',
    eyebrow: 'Storage Layer',
    title: '家庭存储与 NAS 层',
    description: '这条链路负责表达 N100 / PVE 与 fnOS 存储层之间的关系。',
    steps: [
      {
        id: 'n100-host-storage',
        title: 'N100 主机',
        kind: 'host',
        assetId: 'host-n100-pve',
        description: '家庭存储层的物理宿主机',
        status: 'active',
      },
      {
        id: 'pve-hypervisor-storage',
        title: 'PVE',
        kind: 'hypervisor',
        assetId: 'svc-pve-panel',
        description: '负责承载存储虚拟机与硬盘直通',
        status: 'active',
        chips: ['Storage VM'],
      },
      {
        id: 'fnos-vm',
        title: 'fnOS NAS VM',
        kind: 'vm',
        assetId: 'host-fnos-nas-vm',
        description: '负责存储空间、NAS 与媒体服务底座',
        status: 'active',
        chips: ['Storage', 'Media'],
      },
    ],
  },
  {
    id: 'home-nas-services',
    eyebrow: 'NAS Services',
    title: '家庭媒体与资源服务展开',
    description: '这条链路把 fnOS 存储层继续展开成典型 NAS 服务路径，用来表达下载、桥接与媒体消费层的关系。',
    steps: [
      {
        id: 'fnos-vm-services',
        title: 'fnOS NAS VM',
        kind: 'vm',
        assetId: 'host-fnos-nas-vm',
        description: 'NAS 服务运行层与数据落盘底座',
        status: 'active',
        chips: ['NAS Base'],
      },
      {
        id: 'qbittorrent-downloader',
        title: 'qBittorrentEE',
        kind: 'service',
        assetId: 'svc-qbittorrent-downloader',
        description: '下载任务入口层，负责 BT / PT 资源获取',
        status: 'planned',
        chips: ['Downloader'],
      },
      {
        id: 'alist-media-gateway',
        title: 'Alist',
        kind: 'service',
        assetId: 'svc-alist-media-gateway',
        description: '网盘挂载与资源桥接层，为家庭影院提供在线挂载派入口',
        status: 'planned',
        chips: ['Cloud Drive Bridge'],
      },
      {
        id: 'jellyfin-media-center',
        title: 'Jellyfin',
        kind: 'service',
        assetId: 'svc-jellyfin-media-center',
        description: '媒体库与海报墙入口，面向电视盒子、浏览器和移动端消费',
        status: 'planned',
        chips: ['Media Library'],
      },
    ],
  },
  {
    id: 'future-expansion',
    eyebrow: 'Planned Expansion',
    title: '后续服务扩展方向',
    description: '在当前家庭网络、供电层与 NAS 服务层补齐后，这里继续保留未来新增服务资产的留白。',
    steps: [
      {
        id: 'more-service-assets',
        title: '更多服务资产',
        kind: 'service',
        description: '未来继续补充更多家庭服务、监控能力和新的公网 / 内网节点',
        status: 'planned',
        chips: ['Assetize Next'],
      },
    ],
  },
];

export const familyTopologyLinkedAssetIds = Array.from(
  new Set(
    familyTopology.flatMap(flow =>
      flow.steps
        .map(step => step.assetId)
        .filter((assetId): assetId is string => Boolean(assetId))
    )
  )
);
