# Digital-Biome Delivery Lifecycle

Digital-Biome adopts the same three-lifecycle delivery contract used by MemoFlow and BodySense, adapted for Cloudflare Pages.

## Contract

```text
Integration
PR
  -> CI
  -> merge main
  -> exact-SHA main CI
  -> Publish Main Candidate
  -> immutable Pages artifact
  -> optional staging preview

Release
explicit Prepare Release
  -> Release PR
  -> CI
  -> merge main
  -> exact-SHA main CI
  -> exact-SHA Candidate
  -> Release Publish
  -> Published GitHub Release

Production promotion
select Published vX.Y.Z
  -> verify Release provenance
  -> verify immutable artifact digest
  -> production Environment gate
  -> upload the already-built Pages artifact
  -> smoke/contract checks
```

The invariants are:

- **Merge is not Release.**
- **Release is not Production deployment.**
- **Production deployment does not rebuild application code.**
- A Published Release points to one exact main SHA and one exact candidate artifact digest, and an annotated Git tag binds the Release manifest digest to that artifact identity.
- Production consumes only a non-draft, non-prerelease GitHub Release that passed exact-SHA main CI.
- Pages Functions are compiled during Candidate creation. Staging and Production upload the compiled `dist/_worker.js` with `--no-bundle`.
- Candidate/Release provenance binds the immutable `knowledge-public-v1` producer Release (source revision + artifact/manifest SHA-256) separately from the Pages artifact.
- Private deployment inputs are regenerated from an ephemeral private Thought Forest checkout pinned to the same producer revision; the private source is not part of the Digital Biome repository lifecycle and does not rebuild the public application artifact.

## 1. Integration and Candidate

Workflow: `.github/workflows/check.yml`

`CI` runs on PRs and main pushes. The protected status context remains the `check` job.

Workflow: `.github/workflows/candidate-publish.yml`

A successful main `CI` run is resolved through the GitHub Actions API and must satisfy:

- workflow name is `CI`;
- event is `push`;
- branch is `main`;
- conclusion is `success`;
- the candidate revision equals the source CI `head_sha`.

The candidate workflow then:

1. checks out that exact application SHA; Digital Biome contains no private Vault gitlink;
2. reads `data-products/knowledge-public-v1.lock.json`, downloads the exact private-producer GitHub prerelease through a short-lived read-only App token, and verifies source revision plus artifact/manifest SHA-256;
3. materializes the validated producer projection into `.pds-runtime/knowledge-public-v1/source/` and runs the existing synchronization pipeline;
4. builds `dist/`;
5. compiles Pages Functions into `dist/_worker.js` and the deployment routes file;
6. archives `dist/` as `digital-biome-pages.tar.gz`;
7. records a `digital-biome.candidate/v2` manifest containing application SHA, CI run ID, immutable knowledge projection identity, and Pages artifact SHA-256/size;
8. retains the candidate artifact for 90 days.

The v2 knowledge identity contains producer repository, exact source revision, immutable `knowledge-public-v1-<SHA>` Release tag, producer artifact SHA-256 and producer manifest SHA-256. Legacy v1 Candidate/Release manifests remain accepted only so an already-published rollback Release can still be deployed.

If `STAGING_DEPLOY_ENABLED=true`, the latest main candidate can be promoted to the Cloudflare `staging` preview branch. A freshness check prevents an older concurrent candidate from overwriting a newer staging channel.

Staging uploads the candidate with `--no-bundle`; it does not rebuild application code.

## 2. Release

Workflow: `.github/workflows/release-please.yml`

`Prepare Release` is manual. Normal main integration does not create or update a Release PR.

Release Please owns only version/changelog preparation. It is configured with `skip-github-release=true`, so it never publishes the product Release itself.

Because the workflow intentionally uses the repository-scoped `GITHUB_TOKEN` instead of a long-lived PAT, it explicitly dispatches `CI` for the generated Release PR branch. This keeps Release preparation credential-light while preserving protected-branch CI.

Workflow: `.github/workflows/release-publish.yml`

Every successful main Candidate run wakes the workflow, but ordinary main commits are a safe no-op. Publication occurs only when the exact candidate commit satisfies the Release PR merge contract:

- `package.json` version is valid semantic version;
- `.release-please-manifest.json` matches it;
- `CHANGELOG.md` contains the release heading;
- the merge/squash commit contains the Release Please subject `chore(main): release X.Y.Z`.

For an eligible release commit, Release Publish:

1. revalidates the unique, unexpired `candidate-<SHA>` artifact and source-CI provenance;
2. creates/verifies annotated tag `vX.Y.Z`; its canonical message binds the Release manifest digest, Pages artifact SHA-256 and Candidate manifest digest;
3. creates a Draft GitHub Release idempotently;
4. creates `release-manifest.json` from the existing Candidate manifest;
5. attaches:
   - `release-manifest.json`;
   - `candidate-manifest.json`;
   - the exact existing `digital-biome-pages.tar.gz`;
6. publishes the GitHub Release.

No application rebuild occurs across the Candidate -> Release boundary.

## 3. Production promotion

Workflow: `.github/workflows/deploy-production.yml`

Production has only a manual `workflow_dispatch` entry point and requires an explicit Published Release tag such as `v0.6.0`.

Before the production Environment is mutated, the workflow verifies:

- tag syntax and GitHub Published Release state;
- Release is neither Draft nor prerelease;
- the tag is an annotated provenance tag and resolves to the manifest's exact Git SHA;
- the canonical tag message matches the Release manifest digest and artifact identity;
- SHA remains reachable from `main`;
- source CI is a successful main push for the same SHA;
- the recorded Candidate run completed successfully;
- Release manifest schema/digest;
- release artifact SHA-256.

Inside the `production` Environment gate it then:

1. checks out the exact release source; for legacy v1 rollback only, Actions initializes the historical gitlink that still exists in that old source commit;
2. for v2 Releases, separately checks out private Thought Forest at the exact source revision recorded in the Release manifest, re-fetches the matching `knowledge-public-v1` Release, and verifies both identities agree;
3. for legacy v1 Releases only, preserves the previous Vault SHA + private asset-index hash verification path;
4. regenerates only private deployment inputs and encrypted Pages bindings from the exact private source and runs infrastructure contracts;
5. unpacks the already-built Release artifact;
6. uploads it with Wrangler `pages deploy ... --no-bundle`;
7. records the Cloudflare deployment identity;
8. runs public, telemetry and protected-API smoke contracts.

The public application artifact is never rebuilt in this phase. Candidate Actions artifacts are retained for 90 days, but a Published Release remains deployable after that window because long-lived integrity is anchored by the annotated Release tag plus the attached Release manifest and artifact digest.

## 4. GitHub configuration

Required repository configuration:

| Scope                             | Name                     | Purpose                                   |
| --------------------------------- | ------------------------ | ----------------------------------------- |
| Repository variable               | `VAULT_APP_CLIENT_ID`    | Create short-lived producer/Vault read token |
| Repository secret                 | `VAULT_APP_PRIVATE_KEY`  | GitHub App private key                       |
| Repository variable               | `STAGING_DEPLOY_ENABLED` | Enables optional staging promotion        |
| `staging` Environment secret      | `CLOUDFLARE_ACCOUNT_ID`  | Cloudflare account for staging preview    |
| `staging` Environment secret      | `CLOUDFLARE_API_TOKEN`   | Pages Edit credential for staging preview |
| `production` Environment secret   | `CLOUDFLARE_ACCOUNT_ID`  | Cloudflare account for production         |
| `production` Environment secret   | `CLOUDFLARE_API_TOKEN`   | Pages Edit credential for production      |
| `production` Environment variable | `PRODUCTION_URL`         | Custom-domain smoke target                |

The `staging` Environment is intentionally disabled by default until its Cloudflare credentials are provisioned. Candidate creation does not depend on staging being enabled.

## 5. Operational commands

Normal product delivery must use GitHub Actions.

Local Wrangler production deployment is reserved for break-glass recovery. A break-glass deployment must use a previously verified artifact whenever possible and must be followed by an auditable deployment record.

For rollback, prefer Cloudflare Pages deployment rollback to a known successful production deployment. After rollback, separately verify encrypted Secrets and Cloudflare Access because they are external control-plane state and are not part of the static Pages artifact.
