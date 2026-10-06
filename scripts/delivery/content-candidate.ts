import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { assertRecord } from '../data-products/lock-v1';
import { CANDIDATE_SCHEMA, validateCandidate } from './manifest';
import { assertCommittedInputs } from './revalidate';
import { classifyGitContentChange } from './content-policy';

const repository = 'BakerSean168/digital-biome';
function gh(args: string[]) {
  return execFileSync('gh', args, {
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 2 * 1024 * 1024,
  });
}
function api(route: string) {
  return JSON.parse(gh(['api', `repos/${repository}/${route}`])) as unknown;
}
function output(value: Record<string, string>) {
  const file = process.env.GITHUB_OUTPUT;
  if (!file) throw new Error('GITHUB_OUTPUT is required');
  fs.appendFileSync(
    file,
    Object.entries(value)
      .map(([key, value]) => `${key}=${value}\n`)
      .join(''),
  );
}
function candidate(file: string) {
  const value: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  assertRecord(value, 'Candidate');
  const errors = validateCandidate(value);
  if (errors.length) throw new Error(errors.join('; '));
  if (value.schema !== CANDIDATE_SCHEMA) throw new Error('Content promotion requires v5');
  return value;
}
function resolve() {
  const runId = process.env.CANDIDATE_RUN_ID;
  if (!runId || !/^\d+$/.test(runId)) throw new Error('Invalid Candidate run ID');
  const run = api(`actions/runs/${runId}`);
  assertRecord(run, 'Candidate run');
  assertRecord(run.repository, 'Candidate repository');
  if (
    run.repository.full_name !== repository ||
    run.name !== 'Publish Main Candidate' ||
    run.path !== '.github/workflows/candidate-publish.yml' ||
    run.head_branch !== 'main' ||
    !['workflow_run', 'workflow_dispatch'].includes(String(run.event)) ||
    run.conclusion !== 'success'
  )
    throw new Error('Untrusted Candidate workflow evidence');
  const artifacts = api(`actions/runs/${runId}/artifacts?per_page=100`);
  assertRecord(artifacts, 'artifacts');
  if (!Array.isArray(artifacts.artifacts) || artifacts.total_count !== artifacts.artifacts.length)
    throw new Error('Incomplete Candidate artifact enumeration');
  const matches = artifacts.artifacts.filter((value: unknown) => {
    assertRecord(value, 'artifact');
    return (
      typeof value.name === 'string' &&
      /^candidate-[a-f0-9]{40}$/.test(value.name) &&
      value.expired === false
    );
  });
  if (matches.length !== 1) throw new Error('Missing or ambiguous Candidate artifact');
  const artifact = matches[0];
  assertRecord(artifact, 'artifact');
  gh([
    'run',
    'download',
    runId,
    '--repo',
    repository,
    '--name',
    String(artifact.name),
    '--dir',
    'reports/content',
  ]);
  const value = candidate('reports/content/reports/candidate/candidate-manifest.json');
  const sha = String(value.gitSha);
  if (artifact.name !== `candidate-${sha}`) throw new Error('Candidate artifact/source mismatch');
  const ci = api(`actions/runs/${value.ciRunId}`);
  assertRecord(ci, 'CI');
  assertRecord(ci.repository, 'CI repository');
  if (
    ci.repository.full_name !== repository ||
    ci.path !== '.github/workflows/check.yml' ||
    ci.name !== 'CI' ||
    ci.head_sha !== sha ||
    ci.head_branch !== 'main' ||
    !['push', 'workflow_dispatch'].includes(String(ci.event)) ||
    ci.conclusion !== 'success'
  )
    throw new Error('Candidate lacks exact successful main CI');
  const current = api('git/ref/heads/main');
  assertRecord(current, 'main ref');
  assertRecord(current.object, 'main object');
  if (current.object.sha !== sha) {
    output({ eligible: 'false' });
    return;
  }
  const parent = execFileSync('git', ['rev-parse', `${sha}^1`], {
    encoding: 'utf8',
    timeout: 10_000,
  }).trim();
  if (!classifyGitContentChange(process.cwd(), parent, sha)) {
    output({ eligible: 'false' });
    return;
  }
  const archive = fs.readFileSync('reports/content/digital-biome-pages.tar.gz');
  assertRecord(value.artifact, 'Pages artifact');
  if (
    archive.length !== value.artifact.bytes ||
    `sha256:${createHash('sha256').update(archive).digest('hex')}` !== value.artifact.sha256
  )
    throw new Error('Pages artifact identity mismatch');
  // Compare source-bound inputs from the actual source tree, not current mutable main.
  execFileSync('git', ['checkout', '--detach', sha], { stdio: 'inherit', timeout: 30_000 });
  const binding = assertCommittedInputs(value, process.cwd());
  output({
    eligible: 'true',
    revision: sha,
    artifact_name: String(artifact.name),
    private_revision: binding.sourceRevision,
  });
}
function baseline(file: string) {
  const value = candidate('reports/content/reports/candidate/candidate-manifest.json');
  const data: unknown = JSON.parse(fs.readFileSync(file, 'utf8'));
  assertRecord(data, 'Cloudflare response');
  assertRecord(data.result, 'project');
  if (data.success !== true) throw new Error('Cloudflare baseline read failed');
  const deployed = data.result.canonical_deployment;
  assertRecord(deployed, 'canonical deployment');
  assertRecord(deployed.deployment_trigger, 'deployment trigger');
  assertRecord(deployed.deployment_trigger.metadata, 'deployment metadata');
  assertRecord(deployed.latest_stage, 'deployment status');
  if (deployed.environment !== 'production' || deployed.latest_stage.status !== 'success')
    throw new Error('No verified current production baseline');
  const base = deployed.deployment_trigger.metadata.commit_hash;
  if (typeof base !== 'string' || !/^[a-f0-9]{40}$/.test(base))
    throw new Error('Production baseline has no full source SHA');
  output({ eligible: String(classifyGitContentChange(process.cwd(), base, String(value.gitSha))) });
}
try {
  const [command, file, ...extra] = process.argv.slice(2);
  if (command === 'resolve' && !file) resolve();
  else if (command === 'baseline' && file && !extra.length) baseline(path.resolve(file));
  else throw new Error('usage: content-candidate.ts resolve | baseline <Cloudflare project JSON>');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Content verification failed');
  process.exitCode = 1;
}
