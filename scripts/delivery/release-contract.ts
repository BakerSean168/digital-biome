#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

function git(...args: string[]) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

export function validateReleaseFiles(options: {
  packageVersion: string;
  manifestVersion: string;
  changelog: string;
  subjects: string[];
}) {
  const errors: string[] = [];
  if (!SEMVER_RE.test(options.packageVersion)) {
    errors.push('package.json version is not a supported semantic version');
  }
  if (options.manifestVersion !== options.packageVersion) {
    errors.push(
      `release-please manifest version ${options.manifestVersion || 'missing'} != package version ${options.packageVersion || 'missing'}`,
    );
  }
  const hasHeading = options.changelog
    .split(/\r?\n/)
    .some((line) => line.startsWith(`## [${options.packageVersion}]`));
  if (!hasHeading) {
    errors.push(`CHANGELOG is missing release heading for ${options.packageVersion}`);
  }

  const expected = `chore(main): release ${options.packageVersion}`;
  const releaseShaped = options.subjects.some(
    (subject) => subject === expected || subject.startsWith(`${expected} (#`),
  );
  return { errors, releaseShaped };
}

export function extractReleaseNotes(changelog: string, version: string) {
  const lines = changelog.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`## [${version}]`));
  if (start < 0) throw new Error(`CHANGELOG release section not found for ${version}`);

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## [')) {
      end = index;
      break;
    }
  }
  return `${lines.slice(start, end).join('\n').trim()}\n`;
}

export function resolveReleaseContract(options: { requireRelease?: boolean } = {}) {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version?: string };
  const releaseManifest = JSON.parse(fs.readFileSync('.release-please-manifest.json', 'utf8')) as {
    '.'?: string;
  };
  const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');

  const sha = git('rev-parse', 'HEAD');
  const headSubject = git('show', '-s', '--format=%s', 'HEAD');
  const parents = git('rev-list', '--parents', '-n', '1', 'HEAD').split(/\s+/).slice(1);
  const subjects = [headSubject];
  if (parents.length >= 2) {
    subjects.push(git('show', '-s', '--format=%s', parents[1]));
  }

  const version = String(packageJson.version ?? '');
  const validation = validateReleaseFiles({
    packageVersion: version,
    manifestVersion: String(releaseManifest['.'] ?? ''),
    changelog,
    subjects,
  });
  if (validation.errors.length) throw new Error(validation.errors.join('; '));
  if (options.requireRelease && !validation.releaseShaped) {
    throw new Error(`HEAD ${sha} is not the merge/squash of chore(main): release ${version}`);
  }

  return {
    eligible: validation.releaseShaped,
    sha,
    version,
    tag: `v${version}`,
  };
}

function main() {
  const args = process.argv.slice(2);
  const requireRelease = args.includes('--require-release');
  const notesIndex = args.indexOf('--write-notes');
  const notesPath = notesIndex >= 0 ? args[notesIndex + 1] : undefined;
  const unknown = args.filter(
    (arg, index) =>
      arg !== '--require-release' &&
      arg !== '--github-output' &&
      arg !== '--write-notes' &&
      !(index > 0 && args[index - 1] === '--write-notes'),
  );

  if (unknown.length) throw new Error(`unknown argument: ${unknown[0]}`);
  if (notesIndex >= 0 && !notesPath) throw new Error('--write-notes requires a path');

  const contract = resolveReleaseContract({ requireRelease });

  if (notesPath) {
    const changelog = fs.readFileSync('CHANGELOG.md', 'utf8');
    fs.writeFileSync(notesPath, extractReleaseNotes(changelog, contract.version));
  }

  if (args.includes('--github-output')) {
    if (!process.env.GITHUB_OUTPUT)
      throw new Error('GITHUB_OUTPUT is required with --github-output');
    fs.appendFileSync(
      process.env.GITHUB_OUTPUT,
      `eligible=${contract.eligible}\nsha=${contract.sha}\nversion=${contract.version}\ntag=${contract.tag}\n`,
    );
  }

  console.log(
    `RELEASE_CONTRACT=${contract.eligible ? 'ELIGIBLE' : 'NOOP'} version=${contract.version} sha=${contract.sha}`,
  );
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(
      `release contract failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
