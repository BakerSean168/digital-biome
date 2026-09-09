import fs from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

type PageBudget = {
  route: string;
  file: string;
  rawKiB: number;
  gzipKiB: number;
};

const DIST_DIR = path.resolve('dist');
const KIB = 1024;
const PAGE_BUDGETS: readonly PageBudget[] = [
  { route: '/notes', file: 'notes/index.html', rawKiB: 200, gzipKiB: 60 },
  { route: '/about', file: 'about/index.html', rawKiB: 400, gzipKiB: 50 },
  { route: '/discover', file: 'discover/index.html', rawKiB: 64, gzipKiB: 20 },
  { route: '/tools', file: 'tools/index.html', rawKiB: 700, gzipKiB: 48 },
];

function collectFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filePath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(filePath) : [filePath];
  });
}

function formatKiB(bytes: number): string {
  return `${(bytes / KIB).toFixed(1)} KiB`;
}

function assertPageBudgets(): void {
  const failures: string[] = [];

  for (const budget of PAGE_BUDGETS) {
    const filePath = path.join(DIST_DIR, budget.file);
    if (!fs.existsSync(filePath)) {
      failures.push(`${budget.route}: missing ${budget.file}`);
      continue;
    }

    const content = fs.readFileSync(filePath);
    const rawBytes = content.byteLength;
    const gzipBytes = gzipSync(content).byteLength;
    const rawLimit = budget.rawKiB * KIB;
    const gzipLimit = budget.gzipKiB * KIB;
    const rawStatus = rawBytes <= rawLimit ? 'PASS' : 'FAIL';
    const gzipStatus = gzipBytes <= gzipLimit ? 'PASS' : 'FAIL';

    console.log(
      `${budget.route} HTML: raw ${formatKiB(rawBytes)} / ${budget.rawKiB} KiB [${rawStatus}], `
      + `gzip ${formatKiB(gzipBytes)} / ${budget.gzipKiB} KiB [${gzipStatus}]`,
    );

    if (rawBytes > rawLimit) failures.push(`${budget.route} raw HTML exceeds ${budget.rawKiB} KiB`);
    if (gzipBytes > gzipLimit) failures.push(`${budget.route} gzip HTML exceeds ${budget.gzipKiB} KiB`);
  }

  if (failures.length > 0) {
    throw new Error(`Performance budget check failed:\n- ${failures.join('\n- ')}`);
  }
}

function reportAssetTotals(): void {
  const files = collectFiles(DIST_DIR);
  const totals = new Map<string, number>([['.js', 0], ['.css', 0]]);

  for (const filePath of files) {
    const extension = path.extname(filePath);
    if (totals.has(extension)) totals.set(extension, totals.get(extension)! + fs.statSync(filePath).size);
  }

  console.log(`dist JS: ${formatKiB(totals.get('.js') || 0)}`);
  console.log(`dist CSS: ${formatKiB(totals.get('.css') || 0)}`);
}

function reportNotesCatalog(): void {
  const catalogPath = path.join(DIST_DIR, 'data', 'notes-catalog.json');
  const notesPath = path.join(DIST_DIR, 'notes', 'index.html');
  if (!fs.existsSync(catalogPath) || !fs.existsSync(notesPath)) {
    throw new Error('Notes catalog or /notes HTML is missing from dist.');
  }

  const notesHtml = fs.readFileSync(notesPath, 'utf8');
  if (notesHtml.includes('notes-catalog.json')) {
    throw new Error('The notes catalog is present in /notes HTML instead of being lazy-loaded.');
  }

  console.log(`notes catalog: ${formatKiB(fs.statSync(catalogPath).size)} (lazy-loaded; absent from /notes HTML)`);
}

if (!fs.existsSync(DIST_DIR)) {
  throw new Error('dist/ is missing. Run pnpm build:only before checking performance budgets.');
}

assertPageBudgets();
reportAssetTotals();
reportNotesCatalog();
console.log('Performance budget check passed.');
