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

  const fallbackPayload: AiUsageSummaryResponse = {
    totalTokens7d: 8300000,
    estimatedCost7d: 3.21,
    estimatedCostRmb7d: 21.93,
    currency: 'USD',
    updatedAt: new Date().toISOString(),
    tools: [
      {
        id: 'chatgpt-codex',
        name: 'ChatGPT Codex',
        vendor: 'openai',
        tokens7d: 8300000,
        sharePct: 87,
        status: 'running',
        costMode: 'subscription',
      },
      {
        id: 'codex-cli',
        name: 'Codex CLI',
        vendor: 'openai',
        tokens7d: 1200000,
        sharePct: 13,
        status: 'idle',
        costMode: 'api',
      },
    ],
    byMachine: {
      local: { tokens7d: 6800000, pct: 72 },
      oracle2: { tokens7d: 2700000, pct: 28 },
    },
  };

  let payload = fallbackPayload;

  if (hubUrl && hubKey) {
    try {
      const response = await fetch(`${hubUrl.replace(/\/$/, '')}/api/v1/usage/summary?period=7d`, {
        headers: {
          'Authorization': `Bearer ${hubKey}`,
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = (await response.json()) as any;
        if (data && typeof data.totalTokens7d === 'number') {
          payload = data;
        }
      }
    } catch {
      // Keep fallback on error
    }
  }

  return Response.json(payload, {
    status: 200,
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
};
