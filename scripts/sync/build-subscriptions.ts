import fs from 'node:fs';
import path from 'node:path';
import { notesConfig } from '../../notes.config.js';
import {
  frontmatterNumber,
  frontmatterString,
  parseMarkdownFrontmatter,
} from '../../src/domain/markdown/frontmatter';

export interface SubscriptionYamlData {
  asset_id?: string;
  id?: string;
  name?: string;
  vendor?: string;
  cost?: number;
  currency?: string;
  exchangeRateUsd?: number;
  cycle?: 'monthly' | 'yearly';
  annualCost?: number;
  nextBillingDate?: string;
  status?: string;
  icon?: string;
  notes?: string;
}

interface SubscriptionRecord {
  id: string;
  name: string;
  vendor: string;
  cost: number;
  annualCost?: number;
  originalCost: number;
  originalCurrency: string;
  currency: 'USD';
  cycle: 'monthly' | 'yearly';
  nextBillingDate: string;
  status: string;
  icon: string;
  notes: string;
}

export function projectSubscriptionFrontmatter(
  content: string,
  sourceLabel = 'subscription',
): SubscriptionYamlData {
  const { data } = parseMarkdownFrontmatter(content, sourceLabel);
  const cycle = frontmatterString(data.cycle);
  return {
    asset_id: frontmatterString(data.asset_id),
    id: frontmatterString(data.id),
    name: frontmatterString(data.name),
    vendor: frontmatterString(data.vendor),
    cost: frontmatterNumber(data.cost),
    currency: frontmatterString(data.currency),
    exchangeRateUsd: frontmatterNumber(data.exchangeRateUsd),
    cycle: cycle === 'yearly' ? 'yearly' : cycle === 'monthly' ? 'monthly' : undefined,
    annualCost: frontmatterNumber(data.annualCost),
    nextBillingDate: frontmatterString(data.nextBillingDate),
    status: frontmatterString(data.status),
    icon: frontmatterString(data.icon),
    notes: frontmatterString(data.notes),
  };
}

export function generateSubscriptionsJson(): void {
  const assetNotesPath = notesConfig.vault.assetNotesPath || 'thought-forest/assets';
  const targetPath = path.resolve(process.cwd(), 'src/data/subscriptions.json');

  const preserveExistingSnapshot = (reason: string): void => {
    if (fs.existsSync(targetPath)) {
      const existing = JSON.parse(fs.readFileSync(targetPath, 'utf8')) as {
        subscriptions?: unknown[];
      };
      if (Array.isArray(existing.subscriptions) && existing.subscriptions.length > 0) {
        console.warn(
          `[sync-subscriptions] ${reason}; preserving ${existing.subscriptions.length} tracked subscriptions.`,
        );
        return;
      }
    }
    throw new Error(`[sync-subscriptions] ${reason}; no valid tracked snapshot is available.`);
  };

  let subsDir = path.resolve(process.cwd(), assetNotesPath, 'subscriptions');
  if (!fs.existsSync(subsDir)) {
    subsDir = path.resolve(process.cwd(), '..', 'thought-forest', 'assets', 'subscriptions');
  }

  if (!fs.existsSync(subsDir)) {
    preserveExistingSnapshot(`Missing subscription source directory: ${subsDir}`);
    return;
  }

  const exchangeRateRmb = 6.83;
  const currencyToUsdRate: Record<string, number> = {
    USD: 1.0,
    AUD: 0.65,
    CNY: 1 / 6.83,
    RMB: 1 / 6.83,
  };

  const subscriptions: SubscriptionRecord[] = [];
  const files = fs.readdirSync(subsDir).filter((file) => file.endsWith('.md'));
  if (files.length === 0) {
    preserveExistingSnapshot(`No subscription notes found in ${subsDir}`);
    return;
  }

  for (const file of files) {
    const filePath = path.join(subsDir, file);
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = projectSubscriptionFrontmatter(raw, filePath);
    const subId = data.asset_id || data.id;
    if (!subId || !data.name) continue;

    const currency = data.currency || 'USD';
    const originalCost = data.cost || 0;
    const rateToUsd = data.exchangeRateUsd || currencyToUsdRate[currency.toUpperCase()] || 1.0;
    const costUsd = Math.round(originalCost * rateToUsd * 100) / 100;
    const annualCostUsd = data.annualCost
      ? Math.round(data.annualCost * rateToUsd * 100) / 100
      : undefined;

    subscriptions.push({
      id: subId,
      name: data.name,
      vendor: data.vendor || 'Service',
      cost: costUsd,
      annualCost: annualCostUsd,
      originalCost,
      originalCurrency: currency,
      currency: 'USD',
      cycle: data.cycle || 'monthly',
      nextBillingDate: data.nextBillingDate || '2026-12-31',
      status: data.status || 'active',
      icon: data.icon || 'service',
      notes: data.notes || '',
    });
  }

  if (subscriptions.length === 0) {
    preserveExistingSnapshot('Subscription notes were present but none passed validation');
    return;
  }

  subscriptions.sort(
    (a, b) => new Date(a.nextBillingDate).getTime() - new Date(b.nextBillingDate).getTime(),
  );

  const payload = {
    currency: 'USD',
    exchangeRateRmb,
    updatedAt: new Date().toISOString(),
    subscriptions,
  };

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(
    `[sync-subscriptions] Synced ${subscriptions.length} subscriptions from ${subsDir} to src/data/subscriptions.json`,
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  generateSubscriptionsJson();
}
