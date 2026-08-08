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
    oracle2: { tokens7d: number; pct: number };
  };
}

export interface AiUsageEnv extends Env {
  AI_USAGE_HUB_URL?: string;
  AI_USAGE_HUB_KEY?: string;
}

export const onRequest: PagesFunction<AiUsageEnv> = async (context) => {
  const hubUrl = context.env.AI_USAGE_HUB_URL;
  const hubKey = context.env.AI_USAGE_HUB_KEY;

  if (!hubUrl || !hubKey) {
    return Response.json({ error: 'AI usage telemetry is not configured.' }, { status: 503 });
  }

  try {
    const cleanUrl = hubUrl.replace(/\/$/, '');
    const response = await fetch(`${cleanUrl}/api/usage/summary`, {
      headers: {
        'Authorization': `Bearer ${hubKey}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return Response.json({ error: 'AI usage hub rejected the request.' }, { status: 502 });
    }

    const data = (await response.json()) as any;
    if (data && typeof data.todayTokens === 'number') {
        const totalTokens = data.monthlyTokens || data.totalTokens || data.todayTokens || 0;
        const totalCostUsd = data.monthlyCostUsd || data.totalCostUsd || data.todayCostUsd || 0;
        const totalCostRmb = Math.round(totalCostUsd * 6.83 * 100) / 100;

        const tools: AiToolUsageItem[] = (data.models || []).map((m: any, idx: number) => ({
          id: m.name || `model_${idx}`,
          name: m.name || 'AI Model',
          vendor: m.name?.includes('claude') ? 'anthropic' : m.name?.includes('gpt') ? 'openai' : 'google',
          tokens7d: m.tokens || 0,
          sharePct: m.percentage || 0,
          status: 'running',
          costMode: 'api',
        }));

        const locTokens = data.machines?.local?.monthlyTokens || data.machines?.local?.todayTokens || 0;
        const oraTokens = data.machines?.oracle2?.monthlyTokens || data.machines?.oracle2?.todayTokens || 0;
        const sumM = locTokens + oraTokens || 1;

        const payload = {
          totalTokens7d: totalTokens,
          estimatedCost7d: totalCostUsd,
          estimatedCostRmb7d: totalCostRmb,
          currency: 'USD',
          updatedAt: data.updatedAt || new Date().toISOString(),
          tools,
          byMachine: {
            local: { tokens7d: locTokens, pct: Math.round((locTokens / sumM) * 100) },
            oracle2: { tokens7d: oraTokens, pct: Math.round((oraTokens / sumM) * 100) },
          },
        } satisfies AiUsageSummaryResponse;

      return Response.json(payload, {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=300',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }
  } catch {
    return Response.json({ error: 'AI usage hub is unreachable.' }, { status: 502 });
  }

  return Response.json({ error: 'AI usage hub returned an unsupported payload.' }, { status: 502 });
};
