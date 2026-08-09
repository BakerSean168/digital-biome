export interface RecurringCost {
  cost: number;
  annualCost?: number;
  cycle: string;
}

export function monthlyEquivalentCost(item: RecurringCost): number {
  if (item.cycle === 'yearly') {
    return (item.annualCost ?? item.cost) / 12;
  }
  return item.cost;
}
