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

function periodDateKeys(dayCount, now = new Date()) {
  return new Set(Array.from({ length: dayCount }, (_, index) => (
    shanghaiDateKey(new Date(now.getTime() - (index * 86_400_000)))
  )));
}

function numeric(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function pct(value, total) {
  return total > 0 ? Math.round((value / total) * 1000) / 10 : 0;
}

function roundCost(value) {
  return Math.round(value * 100) / 100;
}

function usageValue(value) {
  return {
    tokens: numeric(typeof value === 'number' ? value : value?.tokens),
    costUsd: numeric(typeof value === 'number' ? 0 : value?.cost),
  };
}

function addBreakdown(target, values) {
  if (!values || typeof values !== 'object') return;
  for (const [id, rawUsage] of Object.entries(values)) {
    const usage = usageValue(rawUsage);
    const current = target.get(id) || { tokens: 0, costUsd: 0 };
    current.tokens += usage.tokens;
    current.costUsd += usage.costUsd;
    target.set(id, current);
  }
}

function addSnapshotBreakdown(target, tokenValues, costValues) {
  const ids = new Set([
    ...Object.keys(tokenValues && typeof tokenValues === 'object' ? tokenValues : {}),
    ...Object.keys(costValues && typeof costValues === 'object' ? costValues : {}),
  ]);
  for (const id of ids) {
    const current = target.get(id) || { tokens: 0, costUsd: 0 };
    current.tokens += numeric(tokenValues?.[id]);
    current.costUsd += numeric(costValues?.[id]);
    target.set(id, current);
  }
}

function rankedBreakdown(values, totalTokens, labels = {}) {
  return [...values.entries()]
    .map(([id, usage]) => ({
      id,
      name: labels[id] || id,
      tokens: usage.tokens,
      costUsd: roundCost(usage.costUsd),
      sharePct: pct(usage.tokens, totalTokens),
    }))
    .sort((left, right) => right.tokens - left.tokens);
}

function calculatePeriod(records, dayCount, now) {
  const acceptedDates = periodDateKeys(dayCount, now);
  const machines = {
    local: { id: 'local', name: 'Local · forest', tokens: 0, costUsd: 0, agents: new Map(), models: new Map() },
    hermes: { id: 'hermes', name: 'Hermes · Oracle 2', tokens: 0, costUsd: 0, agents: new Map(), models: new Map() },
  };

  for (const record of records) {
    const deviceId = String(record?.deviceId || '').toLowerCase();
    const machine = deviceId === 'hermes' ? 'hermes' : 'local';
    const days = Array.isArray(record?.history?.daily) ? record.history.daily : [];

    for (const day of days) {
      if (!acceptedDates.has(String(day?.date || ''))) continue;
      const tokens = numeric(day.tokens);
      machines[machine].tokens += tokens;
      machines[machine].costUsd += numeric(day.cost);
      addBreakdown(machines[machine].agents, day.perClient);
      addBreakdown(machines[machine].models, day.perModel);
    }
  }

  const totalTokens = machines.local.tokens + machines.hermes.tokens;
  const totalCostUsd = machines.local.costUsd + machines.hermes.costUsd;
  const normalizeMachine = (machine) => ({
    id: machine.id,
    name: machine.name,
    tokens: machine.tokens,
    costUsd: roundCost(machine.costUsd),
    sharePct: pct(machine.tokens, totalTokens),
    agents: rankedBreakdown(machine.agents, machine.tokens, TOOL_LABELS),
    models: rankedBreakdown(machine.models, machine.tokens),
  });

  return {
    days: dayCount,
    totalTokens,
    totalCostUsd: roundCost(totalCostUsd),
    totalCostRmb: roundCost(totalCostUsd * 6.83),
    machines: {
      local: normalizeMachine(machines.local),
      hermes: normalizeMachine(machines.hermes),
    },
  };
}

function calculateAllTime(records) {
  const machines = {
    local: { id: 'local', name: 'Local · forest', tokens: 0, costUsd: 0, agents: new Map(), models: new Map() },
    hermes: { id: 'hermes', name: 'Hermes · Oracle 2', tokens: 0, costUsd: 0, agents: new Map(), models: new Map() },
  };
  const observedDates = new Set();
  const activeDates = new Set();

  for (const record of records) {
    const deviceId = String(record?.deviceId || '').toLowerCase();
    const machine = deviceId === 'hermes' ? 'hermes' : 'local';
    const days = Array.isArray(record?.history?.daily) ? record.history.daily : [];
    for (const day of days) {
      const date = String(day?.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      observedDates.add(date);
      if (numeric(day.tokens) > 0) activeDates.add(date);
    }

    const allTime = record?.periods?.allTime;
    if (allTime && typeof allTime === 'object') {
      machines[machine].tokens += numeric(allTime.totalTokens);
      machines[machine].costUsd += numeric(allTime.costUsd);
      addSnapshotBreakdown(machines[machine].agents, allTime.clients, allTime.clientCosts);
      addSnapshotBreakdown(machines[machine].models, allTime.models, allTime.modelCosts);
      continue;
    }

    for (const day of days) {
      machines[machine].tokens += numeric(day?.tokens);
      machines[machine].costUsd += numeric(day?.cost);
      addBreakdown(machines[machine].agents, day?.perClient);
      addBreakdown(machines[machine].models, day?.perModel);
    }
  }

  const dates = [...observedDates].sort();
  const startDate = dates[0] || null;
  const endDate = dates.at(-1) || null;
  const calendarDays = startDate && endDate
    ? Math.floor((Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)) / 86_400_000) + 1
    : 0;
  const totalTokens = machines.local.tokens + machines.hermes.tokens;
  const totalCostUsd = machines.local.costUsd + machines.hermes.costUsd;
  const normalizeMachine = (machine) => ({
    id: machine.id,
    name: machine.name,
    tokens: machine.tokens,
    costUsd: roundCost(machine.costUsd),
    sharePct: pct(machine.tokens, totalTokens),
    agents: rankedBreakdown(machine.agents, machine.tokens, TOOL_LABELS),
    models: rankedBreakdown(machine.models, machine.tokens),
  });

  return {
    days: calendarDays,
    totalTokens,
    totalCostUsd: roundCost(totalCostUsd),
    totalCostRmb: roundCost(totalCostUsd * 6.83),
    coverage: { startDate, endDate, calendarDays, activeDays: activeDates.size },
    machines: {
      local: normalizeMachine(machines.local),
      hermes: normalizeMachine(machines.hermes),
    },
  };
}

function calculateSummary(database, now = new Date()) {
  const records = database && typeof database.devices === 'object'
    ? Object.values(database.devices)
    : [];
  const periods = {
    '1d': calculatePeriod(records, 1, now),
    '7d': calculatePeriod(records, 7, now),
    '30d': calculatePeriod(records, 30, now),
    all: calculateAllTime(records),
  };
  const current = periods['7d'];
  const toolTotals = new Map();
  for (const machine of Object.values(current.machines)) {
    for (const item of machine.agents) {
      const usage = toolTotals.get(item.id) || { tokens: 0, costUsd: 0 };
      usage.tokens += item.tokens;
      usage.costUsd += item.costUsd;
      toolTotals.set(item.id, usage);
    }
  }
  const tools = rankedBreakdown(toolTotals, current.totalTokens, TOOL_LABELS).map((item) => ({
    id: item.id,
    name: item.name,
    vendor: item.id,
    tokens7d: item.tokens,
    sharePct: item.sharePct,
    status: 'running',
    costMode: 'api',
  }));

  return {
    totalTokens7d: current.totalTokens,
    estimatedCost7d: current.totalCostUsd,
    estimatedCostRmb7d: current.totalCostRmb,
    currency: 'USD',
    updatedAt: database.savedAt || new Date().toISOString(),
    source: 'official-token-monitor',
    deviceCount: records.length,
    tools,
    byMachine: {
      local: {
        tokens7d: current.machines.local.tokens,
        costUsd7d: current.machines.local.costUsd,
        pct: current.machines.local.sharePct,
      },
      hermes: {
        tokens7d: current.machines.hermes.tokens,
        costUsd7d: current.machines.hermes.costUsd,
        pct: current.machines.hermes.sharePct,
      },
    },
    periods,
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

module.exports = { calculateSummary, createServer, periodDateKeys };

if (require.main === module) {
  const port = Number(process.env.PORT || 8900);
  createServer({
    readKey: process.env.AI_USAGE_HUB_READ_KEY,
    dataFile: process.env.TOKEN_MONITOR_DATA_FILE,
  }).listen(port, '0.0.0.0', () => {
    console.log(`[Token Monitor Read Bridge] listening on 0.0.0.0:${port}`);
  });
}
