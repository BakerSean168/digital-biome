import fs from 'node:fs';
import path from 'node:path';
import { notesConfig } from '../../notes.config.js';

export interface SubscriptionYamlData {
  asset_id?: string;
  id?: string;
  name: string;
  vendor: string;
  cost: number;
  currency: string;
  exchangeRateUsd?: number;
  cycle: 'monthly' | 'yearly';
  annualCost?: number;
  nextBillingDate?: string;
  status?: string;
  icon?: string;
  notes?: string;
}

export function parseYamlFrontmatter(content: string): Record<string, any> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const lines = match[1].split(/\r?\n/);
  const result: Record<string, any> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let valStr = trimmed.slice(colonIdx + 1).trim();

    // Clean quotes
    if ((valStr.startsWith('"') && valStr.endsWith('"')) || (valStr.startsWith("'") && valStr.endsWith("'"))) {
      valStr = valStr.slice(1, -1);
    }

    // Number conversion
    if (!isNaN(Number(valStr)) && valStr !== '') {
      result[key] = Number(valStr);
    } else if (valStr === 'true') {
      result[key] = true;
    } else if (valStr === 'false') {
      result[key] = false;
    } else {
      result[key] = valStr;
    }
  }

  return result;
}

export function generateSubscriptionsJson() {
  const assetNotesPath = notesConfig.vault.assetNotesPath || 'thought-forest/assets';
  let subsDir = path.resolve(process.cwd(), assetNotesPath, 'subscriptions');
  if (!fs.existsSync(subsDir)) {
    subsDir = path.resolve(process.cwd(), '..', 'thought-forest', 'assets', 'subscriptions');
  }

  const exchangeRateRmb = 6.83;
  const currencyToUsdRate: Record<string, number> = {
    USD: 1.0,
    AUD: 0.65,
    CNY: 1 / 6.83,
    RMB: 1 / 6.83,
  };

  let subscriptions: any[] = [];

  if (fs.existsSync(subsDir)) {
    const files = fs.readdirSync(subsDir).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      const filePath = path.join(subsDir, file);
      const raw = fs.readFileSync(filePath, 'utf8');
      const data = parseYamlFrontmatter(raw) as SubscriptionYamlData;

      const subId = data.asset_id || data.id;

      if (subId && data.name) {
        const rateToUsd = data.exchangeRateUsd || currencyToUsdRate[data.currency?.toUpperCase() || 'USD'] || 1.0;
        const costUsd = Math.round((data.cost || 0) * rateToUsd * 100) / 100;
        const annualCostUsd = data.annualCost ? Math.round(data.annualCost * rateToUsd * 100) / 100 : undefined;

        subscriptions.push({
          id: subId,
          name: data.name,
          vendor: data.vendor || 'Service',
          cost: costUsd,
          annualCost: annualCostUsd,
          originalCost: data.cost || 0,
          originalCurrency: data.currency || 'USD',
          currency: 'USD',
          cycle: data.cycle || 'monthly',
          nextBillingDate: data.nextBillingDate || '2026-12-31',
          status: data.status || 'active',
          icon: data.icon || 'service',
          notes: data.notes || '',
        });
      }
    }
  }

  // Sort by nextBillingDate ascending
  subscriptions.sort((a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime());

  const payload = {
    currency: 'USD',
    exchangeRateRmb,
    updatedAt: new Date().toISOString(),
    subscriptions,
  };

  const targetPath = path.resolve(process.cwd(), 'src/data/subscriptions.json');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`[sync-subscriptions] Synced ${subscriptions.length} subscriptions from ${subsDir} to src/data/subscriptions.json`);
}

generateSubscriptionsJson();
