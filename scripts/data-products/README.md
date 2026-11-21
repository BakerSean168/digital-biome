# Public Protocol-v1 consumer — knowledge + infra

Generic event/manual/reconciliation and prepare now enable `knowledge-public-v1`,
and `infra-public-v2`. Only their Protocol-v1 locks are tracked;
producer projections are generated from verified immutable Releases.
Delivery v6 binds both complete public locks and the independent protected RuntimeBinding. Merge and production deployment remain separate actions.

## Owners and trust boundaries

- `registry.ts` owns public product/repository/asset policy. Existing product
  parsers still own domain validation.
- `lock-v1.ts` validates decoded, untrusted lock/event JSON. Events are notifications,
  not authority. `consumerMetadata` is excluded from producer identity comparison.
- `verify-publication.ts` verifies raw hashes, manifest contract, domain payload,
  source binding and semantic digest. Its existing exported entrypoint is
  `verifyPublication()`.
- `fetch-release.ts` independently resolves an exact published, non-draft Release
  and dereferences its Git tag to a commit. It never trusts `target_commitish`,
  reads producer main, checks out source, or regenerates an artifact. Prereleases
  are valid publications. Exactly the registered artifact and manifest must exist.
  Assets must be fully uploaded. GitHub asset sizes and optional digests are checked too.
- `github-release-transport.ts` supplies injectable GET-only transport. Responses
  are bounded (4 MiB metadata, 64 MiB artifact, 1 MiB manifest; 120 seconds/request).
  Tag dereference is capped at 8 objects; reconciliation at 20 pages of 100 Releases.
  Hitting a bound fails closed rather than accepting incomplete enumeration.
  Credentials are not forwarded by native fetch across GitHub's asset redirect.
- Reconciliation sorts by publication time, not GitHub's list order or producer
  main. A malformed/tampered newest product publication fails the run; it does not
  silently fall back to an older Release. Ambiguous latest timestamps fail closed.
- Downloads use an isolated temporary directory removed on success and failure.
  `update-lock.ts` is the single event/manual/reconciliation serialization path.
  It can change only the selected enabled product lock, with atomic single-file rename;
  identity equality is a no-op (including annotations/formatting differences).
  Foreign-owned locks at that path and identity drift under the same immutable tag
  fail closed rather than being silently repinned.

## Knowledge prepare

```sh
pnpm sync  # alias to sync:data-products: both public products + consumer indexes
pnpm sync:data-products
scripts/data-products/prepare-knowledge-public-v1.sh  # product-specific recovery
```

The knowledge lock delegates identity validation to `lock-v1.ts`, retaining its
knowledge-specific type, manifest and domain checks. Prepare verifies the exact
locked Release, then materializes notes/indexes/media into a sibling staging
folder using the unchanged `materializeKnowledgePublicV1Source()` implementation.
Embedded media digest/frontmatter failures cannot touch the accepted runtime.
Only after all verification succeeds does prepare replace `.pds-runtime/knowledge-public-v1`.
It then runs the existing consumer sync/subscription pipeline against that source.
Application imports, public routes and materializer semantics are unchanged.

Replacement assumes one writer. Same-filesystem synchronous renames restore the
previous directory if installation fails; a failed restore retains the backup
path for recovery. This is failure atomicity for verification/ordinary exceptions,
not a filesystem transaction across process death or the subsequent generated
consumer indexes. Generated outputs remain ignored and are not committed.
`--dry-run` retains the prior meaning: materialize the source, dry-run consumer sync.

`fetch-knowledge-public-v1.sh` remains a fetch-only compatibility wrapper around
the same Release reader. It does not perform downstream source/index generation.

## Workflows and activation

- `sync-data-products.yml` alone listens to `data-product-published`. Manual recovery
  requires `product` and exact `release_tag`. Unknown products/producers and private
  bindings are rejected; both public products use the same route/verifier.
- `reconcile-data-products.yml` runs at `17 */6 * * *` and manually. Its knowledge + infra matrix calls the same reusable sync workflow. Each product shares the same
  concurrency group across event/manual/reconcile, lock generator, fixed branch
  `automation/data-product-<product>`, and PR flow. One product's failure does not
  cancel the other's run.
- A credential-free route step validates the request and emits registry-owned
  repository, branch and lock path. Producer reads use the existing short-lived
  `VAULT_APP_CLIENT_ID` / `VAULT_APP_PRIVATE_KEY` App with Contents Read on only the
  selected producer. CI/Candidate read tokens need Thought Forest, Personal
  Infrastructure. The App installation must authorize
  these repositories before activation. This is not the private binding credential.
- Consumer writes use `GITHUB_TOKEN` rather than expanding the read-only Vault
  App or retaining a broad PAT. GitHub places the resulting `pull_request` CI in
  `action_required`; the sync job verifies the exact bot-authored, single-lock,
  fixed-branch PR, associated head SHA, run author and `check.yml` provenance
  before attempting narrowly scoped Actions approval. It then waits for the
  actual required `pull_request` check and revalidates the PR head. A passing
  `workflow_dispatch` run is **not** a substitute for branch protection.
  Missing permission, unapproved CI, failure, timeout, or head movement fail
  closed. Opt-in auto-merge additionally verifies the immutable Release and
  performs an expected-SHA merge only after GitHub required checks pass.
- Only `sync-data-products.yml` accepts active `data-product-published` producer notifications; `reconcile-data-products.yml` recovers missed events. Deprecated per-product workflows are removed.
- Current lock-only updates verify immutable producer Releases and protected exact-head CI. Repository variables control automated PR merge and content deployment; inspect their current values rather than assuming an activation state.
- Delivery v6 is deployed in Release `v0.17.1`. It pins two public data products and one independent private RuntimeBinding. See `docs/data-product-delivery-v6.md`.

## Infra prepare and scope boundary

`prepare-infra-public-v2.sh` and the fetch-only compatibility wrapper now call
`prepare-infra-public-v2.ts`: parse the Protocol-v1 lock, read and verify the exact
Release through the common reader, stage its original bytes, then invoke the
existing infra domain parser/JSON materializer. The consumer output remains
`src/data/infrastructure/infra-public-v2.json` (ignored); `privateRef` identities
are preserved, never resolved to private values. `sync:data-products:infra` uses
this verified prepare path too, not a bare unverified JSON writer.

Verification failures leave both the accepted runtime and output untouched.
Output replacement is a same-filesystem atomic rename; ordinary install failures
restore the previous runtime. A failed restore retains the backup for recovery.
As with knowledge, this assumes one writer and is not a cross-file transaction
across process death; retry from the committed lock converges.

Check/Candidate public preparation no longer checks out producer source or runs
its exporter. New Candidate/Release v6 manifests include the two complete public
locks and a separate private binding identity. Production revalidates these exact
inputs and private reference coverage, then promotes the existing archive without
an application rebuild. Only v6 is accepted; historical Releases are manual recovery material. See `docs/data-product-delivery-v6.md`.
