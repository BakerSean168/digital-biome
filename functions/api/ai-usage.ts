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
  const hubUrl = context.env.AI_USAGE_HUB_URL || 'https://vps.bakersean.top';
  const hubKey = context.env.AI_USAGE_HUB_KEY || 'ai_usage_hub_secret_2026';

  const fallbackPayload: AiUsageSummaryResponse = {
    totalTokens7d: 8300000,
    estimatedCost7d: 3.21,
    estimatedCostRmb7d: 21.93,
    currency: 'USD',
    updatedAt: new Date().toISOString(),
    tools: [
      {
        id: 'claude-3-7-sonnet',
        name: 'Claude 3.7 Sonnet',
        vendor: 'anthropic',
        tokens7d: 6800000,
        sharePct: 82,
        status: 'running',
        costMode: 'api',
      },
      {
        id: 'gemini-2.0-flash',
        name: 'Gemini 2.0 Flash',
        vendor: 'google',
        tokens7d: 1500000,
        sharePct: 18,
        status: 'running',
        costMode: 'api',
      },
    ],
    byMachine: {
      local: { tokens7d: 6800000, pct: 82 },
      oracle2: { tokens7d: 1500000, pct: 18 },
    },
  };

  let payload = fallbackPayload;

  try {
    const cleanUrl = hubUrl.replace(/\/$/, '');
    const response = await fetch(`${cleanUrl}/api/usage/summary`, {
      headers: {
        'Authorization': `Bearer ${hubKey}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
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

        payload = {
          totalTokens7d: totalTokens,
          estimatedCost7d: totalCostUsd,
          estimatedCostRmb7d: totalCostRmb,
          currency: 'USD',
          updatedAt: data.updatedAt || new Date().toISOString(),
          tools: tools.length > 0 ? tools : fallbackPayload.tools,
          byMachine: {
            local: { tokens7d: locTokens, pct: Math.round((locTokens / sumM) * 100) },
            oracle2: { tokens7d: oraTokens, pct: Math.round((oraTokens / sumM) * 100) },
          },
        };
      }
    }
  } catch {
    // Keep fallback on error
  }

  return Response.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
