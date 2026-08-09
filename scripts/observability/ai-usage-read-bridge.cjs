'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');

const TOOL_LABELS = {
  antigravity: 'Antigravity',
  claude: 'Claude Code',
  codex: 'Codex',
  grok: 'Grok',
  hermes: 'Hermes Agent',
  workbuddy: 'WorkBuddy',
};

function shanghaiDateKey(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function sevenDayKeys(now = new Date()) {
  return new Set(Array.from({ length: 7 }, (_, index) => (
    shanghaiDateKey(new Date(now.getTime() - (index * 86_400_000)))
  )));
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function pct(value, total) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

function calculateSummary(database, now = new Date()) {
  const records = database && typeof database.devices === 'object'
    ? Object.values(database.devices)
    : [];
  const acceptedDates = sevenDayKeys(now);
  const toolTotals = new Map();
  const machineTotals = { local: 0, hermes: 0 };
  let totalTokens7d = 0;
  let estimatedCost7d = 0;

  for (const record of records) {
    const deviceId = String(record?.deviceId || '').toLowerCase();
    const machine = deviceId === 'hermes' ? 'hermes' : 'local';
    const days = Array.isArray(record?.history?.daily) ? record.history.daily : [];

    for (const day of days) {
      if (!acceptedDates.has(String(day?.date || ''))) continue;
      const tokens = numeric(day.tokens);
      totalTokens7d += tokens;
      estimatedCost7d += numeric(day.cost);
      machineTotals[machine] += tokens;

      const clients = day?.perClient && typeof day.perClient === 'object' ? day.perClient : {};
      for (const [client, usage] of Object.entries(clients)) {
        const clientTokens = numeric(typeof usage === 'number' ? usage : usage?.tokens);
        toolTotals.set(client, (toolTotals.get(client) || 0) + clientTokens);
      }
    }
  }

  const tools = [...toolTotals.entries()]
    .map(([id, tokens]) => ({
      id,
      name: TOOL_LABELS[id] || id,
      vendor: id,
      tokens7d: tokens,
      sharePct: pct(tokens, totalTokens7d),
      status: 'running',
      costMode: 'api',
    }))
    .sort((left, right) => right.tokens7d - left.tokens7d);

  return {
    totalTokens7d,
    estimatedCost7d: Math.round(estimatedCost7d * 100) / 100,
    estimatedCostRmb7d: Math.round(estimatedCost7d * 6.83 * 100) / 100,
    currency: 'USD',
    updatedAt: database.savedAt || new Date().toISOString(),
    source: 'official-token-monitor',
    deviceCount: records.length,
    tools,
    byMachine: {
      local: { tokens7d: machineTotals.local, pct: pct(machineTotals.local, totalTokens7d) },
      hermes: { tokens7d: machineTotals.hermes, pct: pct(machineTotals.hermes, totalTokens7d) },
    },
  };
}

function secureEqual(actual, expected) {
  const actualBuffer = Buffer.from(actual || '');
  const expectedBuffer = Buffer.from(expected || '');
  return actualBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function createServer({ readKey, dataFile }) {
  if (!readKey || !dataFile) throw new Error('AI_USAGE_HUB_READ_KEY and TOKEN_MONITOR_DATA_FILE are required');

  return http.createServer((request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const send = (status, payload) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      response.end(JSON.stringify(payload));
    };

    if (request.method === 'GET' && url.pathname === '/health') {
      send(200, { status: 'ok', service: 'token-monitor-read-bridge' });
      return;
    }
    if (request.method !== 'GET' || url.pathname !== '/api/usage/summary') {
      send(404, { error: 'Not Found' });
      return;
    }

    const token = /^Bearer\s+(.+)$/i.exec(request.headers.authorization || '')?.[1] || '';
    if (!secureEqual(token, readKey)) {
      send(401, { error: 'Unauthorized' });
      return;
    }

    try {
      const database = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      send(200, calculateSummary(database));
    } catch (error) {
      console.error('Could not read Token Monitor data:', error.message);
      send(503, { error: 'Token Monitor data is unavailable.' });
    }
  });
}

module.exports = { calculateSummary, createServer, sevenDayKeys };

if (require.main === module) {
  const port = Number(process.env.PORT || 8900);
  createServer({
    readKey: process.env.AI_USAGE_HUB_READ_KEY,
    dataFile: process.env.TOKEN_MONITOR_DATA_FILE,
  }).listen(port, '0.0.0.0', () => {
    console.log(`[Token Monitor Read Bridge] listening on 0.0.0.0:${port}`);
  });
}
