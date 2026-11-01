import assert from 'node:assert/strict';
import test from 'node:test';
import {
  infrastructureKindLabel,
  infrastructureStatusCode,
  infrastructureStatusTone,
  registeredStatus,
} from './infrastructure-labels';
import type {
  InfrastructureResourceKind,
  InfrastructureResourceStatus,
} from '../domain/infrastructure/infra-public-v2';

test('all infrastructure statuses retain existing registry code, semantic tone and Chinese detail label', () => {
  const statuses: Record<InfrastructureResourceStatus, readonly [string, string, string]> = {
    active: ['ACTIVE', 'text-emerald-300', '登记状态：使用中'],
    planned: ['PLANNED', 'text-amber-300', '登记状态：计划中'],
    retired: ['RETIRED', 'text-muted-foreground', '登记状态：已退役'],
    archived: ['ARCHIVED', 'text-muted-foreground', '登记状态：已归档'],
    decommissioning: ['DECOMMISSIONING', 'text-muted-foreground', '登记状态：退役中'],
  };
  for (const [status, [code, tone, detail]] of Object.entries(statuses)) {
    assert.equal(infrastructureStatusCode(status as InfrastructureResourceStatus), code);
    assert.equal(infrastructureStatusTone(status as InfrastructureResourceStatus), tone);
    assert.equal(registeredStatus(status as InfrastructureResourceStatus), detail);
  }
});

test('infrastructure kind labels stay in published inventory order without retyping kind logic', () => {
  const labels: Record<InfrastructureResourceKind, string> = {
    host: 'Hosts',
    service: 'Services',
    network: 'Network',
    platform: 'Platforms',
  };
  for (const [kind, label] of Object.entries(labels)) {
    assert.equal(infrastructureKindLabel(kind as InfrastructureResourceKind), label);
  }
});
