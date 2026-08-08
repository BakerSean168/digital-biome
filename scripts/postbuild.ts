import fs from 'node:fs';
import path from 'node:path';
import { notesConfig } from '../notes.config';
import { buildSourceLayout } from './sync/config';
import { redactIPv4Addresses } from './sync/markdown-transform';
import { loadProtectedInfrastructureUrls } from './sync/privacy';

const FULL_IPV4 = /(?<![\d.])(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?![\d.])/g;
const EXACT_IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function collectFiles(directory: string): string[] {
  if (!fs.existsSync(directory)) return [];

  const files: string[] = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }
  return files;
}

function collectProtectedLinksFromUpstream(sensitiveValues: Set<string>): void {
  for (const url of loadProtectedInfrastructureUrls(notesConfig.upstream.generatedPath)) {
    sensitiveValues.add(url);
  }
}

function collectSensitiveValues(): Set<string> {
  const sensitiveValues = new Set<string>();
  const layout = buildSourceLayout(notesConfig);

  const markdownSourceRoots = [
    layout.notesSource,
    layout.assetNotesSource,
    layout.configSource,
  ].filter((directory): directory is string => Boolean(directory));

  for (const sourceRoot of new Set(markdownSourceRoots)) {
    for (const sourceFile of collectFiles(sourceRoot).filter(file => file.endsWith('.md'))) {
      const content = fs.readFileSync(sourceFile, 'utf-8');
      for (const match of content.matchAll(FULL_IPV4)) {
        if (redactIPv4Addresses(match[0]) !== match[0]) {
          sensitiveValues.add(match[0]);
        }
      }
    }
  }

  collectProtectedLinksFromUpstream(sensitiveValues);

  const privateConfig = process.env.PRIVATE_INFRASTRUCTURE_JSON;
  if (privateConfig) {
    const parsed: unknown = JSON.parse(privateConfig);
    if (typeof parsed === 'object' && parsed !== null) {
      const config = parsed as Record<string, unknown>;
      for (const collectionName of ['values', 'links'] as const) {
        if (collectionName in config) {
          const collection = config[collectionName];
          if (typeof collection === 'object' && collection !== null && !Array.isArray(collection)) {
            for (const value of Object.values(collection)) {
              if (typeof value === 'string') sensitiveValues.add(value);
            }
          }
        }
      }
    }
  }

  return sensitiveValues;
}

function assertNoPrivateDataInBuild(): void {
  const distDirectory = path.join(process.cwd(), 'dist');
  const sensitiveValues = [...collectSensitiveValues()].filter(value => value.length >= 4);
  if (sensitiveValues.length === 0 || !fs.existsSync(distDirectory)) return;

  const sensitiveIpv4 = new Set(sensitiveValues.filter(value => EXACT_IPV4.test(value)));
  const otherSensitiveValues = sensitiveValues.filter(value => !EXACT_IPV4.test(value));
  const otherSensitivePattern = otherSensitiveValues.length > 0
    ? new RegExp(otherSensitiveValues.map(escapeRegExp).join('|'), 'u')
    : null;
  const leakedFiles: string[] = [];
  for (const buildFile of collectFiles(distDirectory)) {
    const content = fs.readFileSync(buildFile, 'utf8');
    const containsSensitiveIpv4 = sensitiveIpv4.size > 0 &&
      [...content.matchAll(FULL_IPV4)].some(match => sensitiveIpv4.has(match[0]));
    const containsOtherSensitiveValue = otherSensitivePattern?.test(content) ?? false;
    if (containsSensitiveIpv4 || containsOtherSensitiveValue) {
      leakedFiles.push(path.relative(process.cwd(), buildFile));
    }
  }

  if (leakedFiles.length > 0) {
    throw new Error(
      `Private infrastructure data reached the static build (${leakedFiles.slice(0, 20).join(', ')}).`,
    );
  }

  console.log(`Private infrastructure leakage check passed (${sensitiveValues.length} values checked).`);
}

function copyDirectory(source: string, destination: string): void {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(destination, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      copyDirectory(sourcePath, destinationPath);
    } else {
      fs.copyFileSync(sourcePath, destinationPath);
    }
  }
}

try {
  assertNoPrivateDataInBuild();

  const source = path.join(process.cwd(), 'dist', 'pagefind');
  const destination = path.join(process.cwd(), 'public', 'pagefind');
  if (fs.existsSync(source)) {
    console.log('Copying Pagefind production index to public/pagefind for local dev mode...');
    fs.rmSync(destination, { recursive: true, force: true });
    copyDirectory(source, destination);
    console.log('Pagefind index synced successfully to public/pagefind.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Postbuild validation failed.');
  process.exitCode = 1;
}
