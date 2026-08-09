export interface AiToolUsageItem {
  id: string;
  name: string;
  vendor: string;
  tokens7d: number;
  sharePct: number;
  status: 'running' | 'idle' | 'offline';
  costMode: 'subscription' | 'api';
}

export interface AiUsageSummaryResponse {
  totalTokens7d: number;
  estimatedCost7d: number;
  estimatedCostRmb7d: number;
  currency: string;
  updatedAt: string;
  tools: AiToolUsageItem[];
  byMachine: {
    local: { tokens7d: number; pct: number };
    hermes: { tokens7d: number; pct: number };
  };
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

function machineUsage(value: unknown): { tokens7d: number; pct: number } | null {
  if (!isRecord(value)) return null;
  const tokens7d = finiteNumber(value.tokens7d);
  const pct = finiteNumber(value.pct);
  return tokens7d === null || pct === null ? null : { tokens7d, pct };
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

  if (
    totalTokens7d === null
    || estimatedCost7d === null
    || estimatedCostRmb7d === null
    || !sourceTools
    || !sourceMachines
  ) return null;

  const tools = sourceTools.map(normalizeTool);
  const local = machineUsage(sourceMachines.local);
  const hermes = machineUsage(sourceMachines.hermes);
  if (tools.some((tool) => tool === null) || !local || !hermes) return null;

  return {
    totalTokens7d,
    estimatedCost7d,
    estimatedCostRmb7d,
    currency: typeof value.currency === 'string' ? value.currency : 'USD',
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : new Date().toISOString(),
    tools: tools as AiToolUsageItem[],
    byMachine: { local, hermes },
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
