import type {
  InfrastructureResourceKind,
  InfrastructureResourceStatus,
} from '../domain/infrastructure/infra-public-v2';

const statusPresentation: Record<
  InfrastructureResourceStatus,
  { label: string; code: string; tone: string }
> = {
  active: { label: '使用中', code: 'ACTIVE', tone: 'text-emerald-300' },
  planned: { label: '计划中', code: 'PLANNED', tone: 'text-amber-300' },
  retired: { label: '已退役', code: 'RETIRED', tone: 'text-muted-foreground' },
  archived: { label: '已归档', code: 'ARCHIVED', tone: 'text-muted-foreground' },
  decommissioning: { label: '退役中', code: 'DECOMMISSIONING', tone: 'text-muted-foreground' },
};

const kindLabels: Record<InfrastructureResourceKind, string> = {
  host: 'Hosts',
  service: 'Services',
  network: 'Network',
  platform: 'Platforms',
};

export function registeredStatus(status: InfrastructureResourceStatus): string {
  return `登记状态：${statusPresentation[status].label}`;
}

export function infrastructureStatusCode(status: InfrastructureResourceStatus): string {
  return statusPresentation[status].code;
}

export function infrastructureStatusTone(status: InfrastructureResourceStatus): string {
  return statusPresentation[status].tone;
}

export function infrastructureKindLabel(kind: InfrastructureResourceKind): string {
  return kindLabels[kind];
}

const portalLabels: Record<string, string> = {
  'portal-apps': '应用',
  'portal-ai': 'AI',
  'portal-ops': '运维',
  'portal-homelab': '家庭网络',
};

export function publicResourceGroups(groups: readonly string[]): string[] {
  return [
    ...new Set(
      groups.flatMap((group) =>
        group.startsWith('portal-') ? (portalLabels[group] ? [portalLabels[group]] : []) : [group],
      ),
    ),
  ];
}
