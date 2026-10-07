import type { InfrastructureResourceStatus } from '../domain/infrastructure/infra-public-v2';

const statusLabels: Record<InfrastructureResourceStatus, string> = {
  active: '使用中',
  planned: '计划中',
  retired: '已退役',
  archived: '已归档',
  decommissioning: '退役中',
};

export function registeredStatus(status: InfrastructureResourceStatus): string {
  return `登记状态：${statusLabels[status]}`;
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
