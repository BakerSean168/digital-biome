export type TopologyNodeKind =
  'external' | 'network' | 'host' | 'hypervisor' | 'vm' | 'service' | 'tool';

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

/**
 * Legacy presentation types are retained for old reusable components only.
 * Infrastructure facts moved to producer-owned infra-public-v2.
 */
export const familyTopology: TopologyFlow[] = [];
export const familyTopologyLinkedAssetIds: string[] = [];
