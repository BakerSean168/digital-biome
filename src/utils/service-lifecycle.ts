import type { InfrastructureResourceStatus } from '../domain/infrastructure/infra-public-v2';

export type ServiceLifecycleFilter = 'active' | 'planned' | 'retired' | 'all';
export type ServiceLifecycleGroup = Exclude<ServiceLifecycleFilter, 'all'>;

export const SERVICE_LIFECYCLE_FILTERS: ReadonlyArray<{
  id: ServiceLifecycleFilter;
  label: string;
}> = [
  { id: 'active', label: '运行中' },
  { id: 'planned', label: '规划中' },
  { id: 'retired', label: '已退役' },
  { id: 'all', label: '全部' },
];

/** A catalog lifecycle, not a real-time service health signal. */
export function serviceLifecycleGroup(status: InfrastructureResourceStatus): ServiceLifecycleGroup {
  if (status === 'active') return 'active';
  if (status === 'planned') return 'planned';
  return 'retired'; // retired, archived, decommissioning are not active targets.
}

export function serviceLifecycleLabel(status: InfrastructureResourceStatus): string {
  switch (status) {
    case 'active':
      return '运行中';
    case 'planned':
      return '规划中';
    case 'retired':
      return '已退役';
    case 'archived':
      return '已归档';
    case 'decommissioning':
      return '退役中';
  }
}

export function matchesServiceLifecycle(
  status: InfrastructureResourceStatus,
  filter: ServiceLifecycleFilter,
): boolean {
  return filter === 'all' || serviceLifecycleGroup(status) === filter;
}
