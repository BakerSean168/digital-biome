export interface AiToolUsageItem {
  id: string;
  name: string;
  vendor: string;
  tokens7d: number;
  sharePct: number;
  status: 'running' | 'idle' | 'offline';
  costMode: 'subscription' | 'api';
}

export interface AiUsageBreakdownItem {
  id: string;
  name: string;
  tokens: number;
  costUsd: number;
  sharePct: number;
}

export interface AiMachineUsage {
  id: 'local' | 'hermes';
  name: string;
  tokens: number;
  costUsd: number;
  sharePct: number;
  agents: AiUsageBreakdownItem[];
  models: AiUsageBreakdownItem[];
}

export interface AiUsagePeriod {
  days: number;
  totalTokens: number;
  totalCostUsd: number;
  totalCostRmb: number;
  machines: {
    local: AiMachineUsage;
    hermes: AiMachineUsage;
  };
}

export interface AiUsageSummaryResponse {
  totalTokens7d: number;
  estimatedCost7d: number;
  estimatedCostRmb7d: number;
  currency: string;
  updatedAt: string;
  source: 'official-token-monitor';
  deviceCount: number;
  tools: AiToolUsageItem[];
  byMachine: {
    local: { tokens7d: number; costUsd7d: number; pct: number };
    hermes: { tokens7d: number; costUsd7d: number; pct: number };
  };
  periods: Record<'1d' | '7d' | '30d', AiUsagePeriod>;
}

export interface AiUsageEnv extends Env {
  AI_USAGE_HUB_URL?: string;
  AI_USAGE_HUB_READ_KEY?: string;
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function machineUsage(value: unknown): { tokens7d: number; costUsd7d: number; pct: number } | null {
  if (!isRecord(value)) return null;
  const tokens7d = finiteNumber(value.tokens7d);
  const costUsd7d = finiteNumber(value.costUsd7d);
  const pct = finiteNumber(value.pct);
  return tokens7d === null || costUsd7d === null || pct === null ? null : { tokens7d, costUsd7d, pct };
}

function normalizeBreakdown(value: unknown): AiUsageBreakdownItem[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.map((item, index): AiUsageBreakdownItem | null => {
    if (!isRecord(item)) return null;
    const tokens = finiteNumber(item.tokens);
    const costUsd = finiteNumber(item.costUsd);
    const sharePct = finiteNumber(item.sharePct);
    if (tokens === null || costUsd === null || sharePct === null) return null;
    const name = typeof item.name === 'string' && item.name.trim() ? item.name : `Usage ${index + 1}`;
    return {
      id: typeof item.id === 'string' && item.id ? item.id : name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name,
      tokens,
      costUsd,
      sharePct,
    };
  });
  return items.some((item) => item === null) ? null : items as AiUsageBreakdownItem[];
}

function normalizePeriodMachine(value: unknown, id: 'local' | 'hermes'): AiMachineUsage | null {
  if (!isRecord(value)) return null;
  const tokens = finiteNumber(value.tokens);
  const costUsd = finiteNumber(value.costUsd);
  const sharePct = finiteNumber(value.sharePct);
  const agents = normalizeBreakdown(value.agents);
  const models = normalizeBreakdown(value.models);
  if (tokens === null || costUsd === null || sharePct === null || !agents || !models) return null;
  return {
    id,
    name: typeof value.name === 'string' ? value.name : id,
    tokens,
    costUsd,
    sharePct,
    agents,
    models,
  };
}

function normalizePeriod(value: unknown): AiUsagePeriod | null {
  if (!isRecord(value) || !isRecord(value.machines)) return null;
  const days = finiteNumber(value.days);
  const totalTokens = finiteNumber(value.totalTokens);
  const totalCostUsd = finiteNumber(value.totalCostUsd);
  const totalCostRmb = finiteNumber(value.totalCostRmb);
  const local = normalizePeriodMachine(value.machines.local, 'local');
  const hermes = normalizePeriodMachine(value.machines.hermes, 'hermes');
  if (days === null || totalTokens === null || totalCostUsd === null || totalCostRmb === null || !local || !hermes) return null;
  return { days, totalTokens, totalCostUsd, totalCostRmb, machines: { local, hermes } };
}

function normalizeTool(value: unknown, index: number): AiToolUsageItem | null {
  if (!isRecord(value)) return null;
  const tokens7d = finiteNumber(value.tokens7d);
  const sharePct = finiteNumber(value.sharePct ?? value.percentage);
  if (tokens7d === null || sharePct === null) return null;

  const name = typeof value.name === 'string' && value.name.trim() ? value.name : `AI Tool ${index + 1}`;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    name,
    vendor: typeof value.vendor === 'string' ? value.vendor : 'unknown',
    tokens7d,
    sharePct,
    status: value.status === 'idle' || value.status === 'offline' ? value.status : 'running',
    costMode: value.costMode === 'subscription' ? 'subscription' : 'api',
  };
}

function normalizePayload(value: unknown): AiUsageSummaryResponse | null {
  if (!isRecord(value)) return null;

  const totalTokens7d = finiteNumber(value.totalTokens7d);
  const estimatedCost7d = finiteNumber(value.estimatedCost7d);
  const estimatedCostRmb7d = finiteNumber(value.estimatedCostRmb7d);
  const sourceTools = Array.isArray(value.tools)
    ? value.tools
    : Array.isArray(value.models)
      ? value.models
      : null;
  const sourceMachines = isRecord(value.byMachine)
    ? value.byMachine
    : isRecord(value.machines)
      ? value.machines
      : null;
  const sourcePeriods = isRecord(value.periods) ? value.periods : null;

  if (
    totalTokens7d === null
    || estimatedCost7d === null
    || estimatedCostRmb7d === null
    || !sourceTools
    || !sourceMachines
    || !sourcePeriods
  ) return null;

  const tools = sourceTools.map(normalizeTool);
  const local = machineUsage(sourceMachines.local);
  const hermes = machineUsage(sourceMachines.hermes);
  const period1d = normalizePeriod(sourcePeriods['1d']);
  const period7d = normalizePeriod(sourcePeriods['7d']);
  const period30d = normalizePeriod(sourcePeriods['30d']);
  if (tools.some((tool) => tool === null) || !local || !hermes || !period1d || !period7d || !period30d) return null;

  return {
    totalTokens7d,
    estimatedCost7d,
    estimatedCostRmb7d,
    currency: typeof value.currency === 'string' ? value.currency : 'USD',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    source: 'official-token-monitor',
    deviceCount: finiteNumber(value.deviceCount) ?? 2,
    tools: tools as AiToolUsageItem[],
    byMachine: { local, hermes },
    periods: { '1d': period1d, '7d': period7d, '30d': period30d },
  };
}

export const onRequest: PagesFunction<AiUsageEnv> = async (context) => {
  const hubUrl = context.env.AI_USAGE_HUB_URL;
  const readKey = context.env.AI_USAGE_HUB_READ_KEY;

  if (!hubUrl || !readKey) {
    return Response.json({ error: 'AI usage telemetry is not configured.' }, { status: 503 });
  }

  try {
    const response = await fetch(`${hubUrl.replace(/\/$/, '')}/api/usage/summary`, {
      headers: {
        'Authorization': `Bearer ${readKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return Response.json({ error: 'AI usage hub rejected the request.' }, { status: 502 });
    }

    const payload = normalizePayload(await response.json());
    if (!payload) {
      return Response.json({ error: 'AI usage hub returned an unsupported payload.' }, { status: 502 });
    }

    return Response.json(payload, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch {
    return Response.json({ error: 'AI usage hub is unreachable.' }, { status: 502 });
  }
};
