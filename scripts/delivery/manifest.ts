#!/usr/bin/env node
// Delivery manifest CLI used by candidate-publish, release-publish and
// deploy-production workflows. This file owns only argument parsing and file I/O;
// schema identities/digest, validation and construction live in pure modules and
// are re-exported here so existing import paths stay stable.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createCandidate,
  createReleaseManifest,
  releaseProvenanceMessage,
} from './manifest-create';
import type { JsonRecord } from './manifest-schema';
import { validateCandidate, validateReleaseManifest } from './manifest-validate';

export {
  CANDIDATE_SCHEMA,
  PREVIOUS_CANDIDATE_SCHEMA,
  PREVIOUS_RELEASE_SCHEMA,
  RELEASE_SCHEMA,
  V4_CANDIDATE_SCHEMA,
  V4_RELEASE_SCHEMA,
} from './manifest-schema';
export {
  createCandidate,
  createReleaseManifest,
  releaseProvenanceMessage,
  validateCandidate,
  validateReleaseManifest,
};

function parseFlags(tokens: string[]) {
  const flags: Record<string, string> = {};
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (!token.startsWith('--')) throw new Error(`unexpected argument: ${token}`);
    const value = tokens[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`missing value for ${token}`);
    flags[token.slice(2)] = value;
    index += 1;
  }
  return flags;
}

function readJson(file: string) {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
}

function writeJson(file: string, value: unknown) {
  const resolved = path.resolve(file);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, `${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parseFlags(rest);

  if (command === 'candidate') {
    if (!flags.input || !flags.output) throw new Error('candidate requires --input and --output');
    const candidate = createCandidate(readJson(flags.input));
    const errors = validateCandidate(candidate);
    if (errors.length) throw new Error(errors.join('; '));
    writeJson(flags.output, candidate);
    console.log(`CANDIDATE_MANIFEST=PASS digest=${candidate.digest}`);
    return;
  }

  if (command === 'release') {
    for (const key of ['candidate', 'version', 'tag', 'candidate-run-id', 'output']) {
      if (!flags[key]) throw new Error(`release requires --${key}`);
    }
    const release = createReleaseManifest(
      readJson(flags.candidate),
      flags.version,
      flags.tag,
      flags['candidate-run-id'],
    );
    const errors = validateReleaseManifest(release);
    if (errors.length) throw new Error(errors.join('; '));
    writeJson(flags.output, release);
    console.log(`RELEASE_MANIFEST=PASS digest=${release.digest}`);
    return;
  }

  if (command === 'validate') {
    if (!flags.file) throw new Error('validate requires --file');
    const value = readJson(flags.file) as JsonRecord;
    const errors = String(value.schema).startsWith('digital-biome.candidate/')
      ? validateCandidate(value)
      : validateReleaseManifest(value);
    if (errors.length) throw new Error(errors.join('; '));
    console.log(`DELIVERY_MANIFEST=PASS schema=${String(value.schema)}`);
    return;
  }

  if (command === 'provenance') {
    if (!flags.file) throw new Error('provenance requires --file');
    process.stdout.write(`${releaseProvenanceMessage(readJson(flags.file))}\n`);
    return;
  }

  throw new Error('usage: manifest.ts <candidate|release|validate|provenance> [flags]');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(
      `delivery manifest failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
