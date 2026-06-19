import { familyTopology, familyTopologyLinkedAssetIds, type TopologyFlow, type TopologyNode } from '../data/infrastructure/family-topology';
import type { AssetCard, NoteCollectionEntry } from '../types/notes';
import { getAssetsByAssetIds, toAssetCard } from './notes';

export interface ResolvedTopologyNode extends TopologyNode {
  href?: string;
  primaryUrl?: string;
  monitorUrl?: string;
}

export interface HomelabLayer {
  id: string;
  level: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  nodeIds: string[];
  accentClass: string;
  spotlight: string;
  spotlightEn: string;
}

export interface FleetRegionCard {
  id: string;
  region: string;
  regionEn: string;
  provider: string;
  providerEn: string;
  role: string;
  roleEn: string;
  description: string;
  descriptionEn: string;
  hostNodeIds: string[];
  serviceNodeIds: string[];
  accentClass: string;
  providerClass: string;
  roleClass: string;
}

export const publicFleetFlowIds = [
  'public-edge',
  'public-dailyuse',
  'proxy-japan',
  'proxy-korea',
  'proxy-hk',
  'public-site-digital-biome',
  'public-site-github',
] as const;

export const homelabFlowIds = [
  'homelab-core',
  'home-network-edge',
  'home-power-resilience',
  'home-storage',
  'home-nas-services',
  'future-expansion',
] as const;

export const featuredInfrastructureAssetIds = [
  'net-bakersean-top-domain',
  'host-azure-hk-vps',
  'host-aliyun-chengdu-dailyuse-vps',
  'host-n100-pve',
  'host-fnos-nas-vm',
  'svc-homepage-dashboard',
] as const;

export const homelabLayers: HomelabLayer[] = [
  {
    id: 'power',
    level: '01',
    title: '供电层',
    titleEn: 'Power Layer',
    description: '把市电和 UPS 视为整套实验室的生命线，先保证关键节点不断电，后面的虚拟化和服务才有意义。',
    descriptionEn: 'Treat utility power and UPS as the lifeline of the lab. Without power continuity, every higher layer collapses.',
    nodeIds: ['utility-power', 'home-ups'],
    accentClass: 'from-amber-500/24 via-amber-500/8 to-transparent',
    spotlight: '目标：优先保护光猫、交换层和 N100 主机，让闪断不至于直接打穿整套家用服务。',
    spotlightEn: 'Goal: protect the modem, switch fabric, and N100 host first so a short outage does not take down the whole lab.',
  },
  {
    id: 'network',
    level: '02',
    title: '网络层',
    titleEn: 'Network Layer',
    description: '这里表达入户链路、主路由、旁路由、交换层、TP-Link 和无线 AP 的接入秩序，是整个家庭网络的骨架。',
    descriptionEn: 'This layer captures the order of ingress, main routing, side routing, switching, TP-Link distribution, and wireless access.',
    nodeIds: ['home-optical-modem', 'router-vm', 'istoreos-vm', 'home-lan', 'home-switch', 'tplink-router', 'home-ap'],
    accentClass: 'from-cyan-500/24 via-cyan-500/8 to-transparent',
    spotlight: '目标：把 WAN 入口、LAN 分发和无线覆盖拆清楚，让网络结构像真正的拓扑而不是一团设备名。',
    spotlightEn: 'Goal: make WAN ingress, LAN distribution, and wireless coverage read as a real topology instead of a loose device list.',
  },
  {
    id: 'compute',
    level: '03',
    title: '计算层',
    titleEn: 'Compute Layer',
    description: 'N100 与 PVE 构成真正的算力底座，既承接路由虚拟机，也承接后续服务与 NAS 虚拟机。',
    descriptionEn: 'The N100 host and PVE form the compute substrate that carries both routing VMs and service workloads.',
    nodeIds: ['n100-host', 'pve-hypervisor'],
    accentClass: 'from-emerald-500/24 via-emerald-500/8 to-transparent',
    spotlight: '目标：突出宿主机与虚拟化底座的中枢地位，而不是把它们埋在服务列表里。',
    spotlightEn: 'Goal: elevate the host and hypervisor as the central substrate instead of burying them inside service cards.',
  },
  {
    id: 'virtualization',
    level: '04',
    title: '虚拟化层',
    titleEn: 'Virtualization Layer',
    description: 'RouterOS、iStoreOS、Debian 服务 VM 与 fnOS NAS VM 共同构成你当前的主运行面。',
    descriptionEn: 'RouterOS, iStoreOS, the Debian services VM, and the fnOS NAS VM form the current virtual workload surface.',
    nodeIds: ['router-vm', 'istoreos-vm', 'services-vm', 'fnos-vm'],
    accentClass: 'from-violet-500/24 via-violet-500/8 to-transparent',
    spotlight: '目标：让访客能一眼分辨“哪台是主路由 VM、哪台是服务 VM、哪台是 NAS VM”。',
    spotlightEn: 'Goal: make it obvious which VM is the main router, which runs services, and which carries the NAS role.',
  },
  {
    id: 'service',
    level: '05',
    title: '服务层',
    titleEn: 'Service Layer',
    description: 'Homepage、Vaultwarden、Jellyfin、Alist 和 qBittorrent 把这套底座变成真正可消费的个人基础设施。',
    descriptionEn: 'Homepage, Vaultwarden, Jellyfin, Alist, and qBittorrent turn the substrate into a usable personal infrastructure.',
    nodeIds: ['homepage-dashboard', 'vaultwarden', 'jellyfin-media-center', 'alist-media-gateway', 'qbittorrent-downloader'],
    accentClass: 'from-lime-500/24 via-lime-500/8 to-transparent',
    spotlight: '目标：从“设备可用”升级到“服务可用”，让家庭实验室真正对日常生活有入口价值。',
    spotlightEn: 'Goal: move from device availability to service availability so the lab becomes useful in everyday life.',
  },
];

export const fleetRegionCards: FleetRegionCard[] = [
  {
    id: 'global-edge',
    region: 'Global Edge',
    regionEn: 'Global Edge',
    provider: 'Cloudflare',
    providerEn: 'Cloudflare',
    role: 'Edge / DNS',
    roleEn: 'Edge / DNS',
    description: '域名入口、访问控制和统一回源边界层，是你所有公网资产的总闸门。',
    descriptionEn: 'Domain entry, access control, and unified proxy boundary for the entire public surface.',
    hostNodeIds: ['bakersean-top-domain', 'cloudflare-edge'],
    serviceNodeIds: [],
    accentClass: 'from-cyan-500/24 via-sky-500/10 to-transparent',
    providerClass: 'border-orange-400/25 bg-orange-500/10 text-orange-300',
    roleClass: 'border-cyan-400/25 bg-cyan-500/10 text-cyan-300',
  },
  {
    id: 'hong-kong-control',
    region: 'Hong Kong',
    regionEn: 'Hong Kong',
    provider: 'Azure',
    providerEn: 'Azure',
    role: 'Control Plane',
    roleEn: 'Control Plane',
    description: '控制平面节点，负责 Nezha 面板、Sub-Store 和公网运维入口。',
    descriptionEn: 'Control-plane node hosting Nezha, Sub-Store, and public operations entrypoints.',
    hostNodeIds: ['azure-hk-vps'],
    serviceNodeIds: ['sub-store', 'nezha-panel'],
    accentClass: 'from-sky-500/24 via-cyan-500/10 to-transparent',
    providerClass: 'border-sky-400/25 bg-sky-500/10 text-sky-300',
    roleClass: 'border-sky-400/25 bg-sky-500/10 text-sky-300',
  },
  {
    id: 'chengdu-workload',
    region: 'Chengdu',
    regionEn: 'Chengdu',
    provider: 'Aliyun',
    providerEn: 'Aliyun',
    role: 'Workload',
    roleEn: 'Workload',
    description: '国内业务主机，承接 DailyUse / Memoflow 的真实生产负载。',
    descriptionEn: 'Domestic workload host carrying the real DailyUse / Memoflow production workload.',
    hostNodeIds: ['aliyun-chengdu-dailyuse-vps'],
    serviceNodeIds: ['memoflow-dailyuse'],
    accentClass: 'from-emerald-500/24 via-lime-500/10 to-transparent',
    providerClass: 'border-amber-400/25 bg-amber-500/10 text-amber-300',
    roleClass: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-300',
  },
  {
    id: 'japan-proxy',
    region: 'Japan',
    regionEn: 'Japan',
    provider: 'Azure',
    providerEn: 'Azure',
    role: 'Proxy Node',
    roleEn: 'Proxy Node',
    description: '东亚区域落点之一，用于 sing-box 代理和区域分流。',
    descriptionEn: 'One of the East Asia proxy points for sing-box and regional traffic routing.',
    hostNodeIds: ['azure-japan-singbox-vps'],
    serviceNodeIds: ['sing-box-japan'],
    accentClass: 'from-fuchsia-500/24 via-violet-500/10 to-transparent',
    providerClass: 'border-sky-400/25 bg-sky-500/10 text-sky-300',
    roleClass: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-300',
  },
  {
    id: 'korea-proxy',
    region: 'Korea',
    regionEn: 'Korea',
    provider: 'Azure',
    providerEn: 'Azure',
    role: 'Proxy Node',
    roleEn: 'Proxy Node',
    description: '备用区域节点，同时也是运行状态监控和链路测试的重要样本。',
    descriptionEn: 'A backup regional proxy and an important monitoring target for runtime and routing health.',
    hostNodeIds: ['azure-korea-singbox-vps'],
    serviceNodeIds: ['sing-box-korea'],
    accentClass: 'from-fuchsia-500/24 via-violet-500/10 to-transparent',
    providerClass: 'border-sky-400/25 bg-sky-500/10 text-sky-300',
    roleClass: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-300',
  },
  {
    id: 'hong-kong-proxy',
    region: 'Hong Kong',
    regionEn: 'Hong Kong',
    provider: 'Azure',
    providerEn: 'Azure',
    role: 'Proxy Node',
    roleEn: 'Proxy Node',
    description: '与控制平面分工独立的香港代理节点，承担单独的代理角色。',
    descriptionEn: 'A Hong Kong proxy node separated from the control plane so the role stays isolated.',
    hostNodeIds: ['azure-hk-singbox-vps'],
    serviceNodeIds: ['sing-box-hk'],
    accentClass: 'from-fuchsia-500/24 via-violet-500/10 to-transparent',
    providerClass: 'border-sky-400/25 bg-sky-500/10 text-sky-300',
    roleClass: 'border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-300',
  },
  {
    id: 'showcase-surface',
    region: 'Global',
    regionEn: 'Global',
    provider: 'Cloudflare / GitHub',
    providerEn: 'Cloudflare / GitHub',
    role: 'Showcase',
    roleEn: 'Showcase',
    description: '对外展示你的知识、身份和数字资产的公开站点表面。',
    descriptionEn: 'The public-facing surface where your knowledge, identity, and digital assets are presented.',
    hostNodeIds: ['cloudflare-pages-host', 'github-pages-host'],
    serviceNodeIds: ['digital-biome-site', 'github-profile-site'],
    accentClass: 'from-amber-500/24 via-rose-500/10 to-transparent',
    providerClass: 'border-amber-400/25 bg-amber-500/10 text-amber-300',
    roleClass: 'border-rose-400/25 bg-rose-500/10 text-rose-300',
  },
];

const topologyFlowMap = new Map(familyTopology.map(flow => [flow.id, flow]));

export function getTopologyFlows(flowIds: readonly string[]): TopologyFlow[] {
  return flowIds
    .map(flowId => topologyFlowMap.get(flowId))
    .filter((flow): flow is TopologyFlow => Boolean(flow));
}

export function getAssetCardsForFlows(flows: TopologyFlow[], assetCards: AssetCard[]): AssetCard[] {
  const assetIds = new Set(
    flows.flatMap(flow =>
      flow.steps
        .map(step => step.assetId)
        .filter((assetId): assetId is string => Boolean(assetId))
    )
  );

  return assetCards.filter(asset => assetIds.has(asset.assetId));
}

export function pickAssetCardsByIds(assetCards: AssetCard[], assetIds: readonly string[]): AssetCard[] {
  const wanted = new Set(assetIds);
  return assetCards.filter(asset => wanted.has(asset.assetId));
}

export function getTopologyFactCounts(flows: TopologyFlow[]): {
  flowCount: number;
  nodeCount: number;
  activeCount: number;
} {
  const nodes = flows.flatMap(flow => flow.steps);

  return {
    flowCount: flows.length,
    nodeCount: nodes.length,
    activeCount: nodes.filter(node => node.status === 'active').length,
  };
}

export async function getInfrastructureDataset(localePrefix = ''): Promise<{
  assetEntries: NoteCollectionEntry[];
  assetCards: AssetCard[];
  resolvedNodes: Record<string, ResolvedTopologyNode>;
}> {
  const assetEntries = await getAssetsByAssetIds(familyTopologyLinkedAssetIds);
  const assetMap = new Map(assetEntries.map(entry => [entry.data.asset_id, entry]));

  const assetCards = assetEntries
    .map(toAssetCard)
    .map(asset => ({
      ...asset,
      href: localePrefix ? `${localePrefix}${asset.href}` : asset.href,
    }));

  const resolvedNodes = Object.fromEntries(
    familyTopology.flatMap(flow => flow.steps.map(step => {
      const asset = step.assetId ? assetMap.get(step.assetId) : undefined;
      const primaryUrl = asset?.data.links?.find(link => link.kind === 'app' || link.kind === 'admin')?.url;
      const monitorUrl = asset?.data.links?.find(link => link.kind === 'monitor')?.url ?? asset?.data.monitor?.url;
      const href = asset
        ? `${localePrefix}${toAssetCard(asset).href}`
        : step.href
          ? `${localePrefix}${step.href}`
          : undefined;

      return [step.id, {
        ...step,
        href,
        primaryUrl: primaryUrl ?? step.primaryUrl,
        monitorUrl: monitorUrl ?? step.monitorUrl,
      }];
    }))
  );

  return {
    assetEntries,
    assetCards,
    resolvedNodes,
  };
}
