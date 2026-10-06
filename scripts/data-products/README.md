# Public Protocol-v1 consumer — knowledge rollout slice

The common protocol foundation supports three public products; **generic sync and
prepare rollout currently enables `knowledge-public-v1` only**. PDS, public infra,
private RuntimeBindings, Candidate provenance and production promotion are not
cut over by this slice. The old infra scheduled workflow and PR #120 are unchanged.

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
  GitHub asset sizes/digests, when supplied, are checked too.
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
  It can change only the enabled knowledge lock, with atomic single-file rename;
  identity equality is a no-op (including annotations/formatting differences).

## Knowledge prepare

```sh
pnpm sync  # existing knowledge + existing infra paths, not generic prepare-all
scripts/data-products/prepare-knowledge-public-v1.sh
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
  requires `product` and exact `release_tag`. Other standard products are rejected
  with a not-yet-enabled error.
- `reconcile-data-products.yml` runs at `17 */6 * * *` and manually. It calls the
  same reusable sync workflow, with the same concurrency group, lock generator,
  fixed branch `automation/data-product-knowledge-public-v1`, and PR flow.
- Producer reads use the existing short-lived `VAULT_APP_CLIENT_ID` /
  `VAULT_APP_PRIVATE_KEY` App, restricted to Thought Forest Contents Read.
- Consumer writes use `GITHUB_TOKEN`. Since its pushes may suppress PR-triggered
  Actions, the workflow explicitly dispatches the existing protected `check.yml`
  at the fixed branch, waits for successful exact-head CI, and rechecks live PR
  head identity. Timeouts, CI failure and head movement fail closed. No auto-merge.
- `sync-knowledge-public-v1.yml` retains its legacy event/manual inputs and branch
  for rollback. Its final lock generation now also verifies through the common
  reader so it cannot downgrade the Protocol-v1 lock. Avoid dual legacy/standard
  dispatch during activation; they intentionally remain separate PR lanes.

Before activation, this consumer must reach the default branch, the reviewed
Thought Forest `feat/data-product-protocol-v1` producer must be activated, and its
consumer dispatch credential must be valid. Verify a real standard dispatch and
reconciliation run, lock-only PR, and protected exact-head CI in GitHub. Local
shadow reads do not prove these hosted write/CI operations. Merge stays manual;
auto-merge, provenance v5 and content production are later batches.

## Live shadow evidence (2026-10-06)

Independently downloaded and verified Release `401833162`, published
`2026-10-02T13:15:35Z` in `BakerSean168/thought-forest`:

- Tag: `knowledge-public-v1-d2e3b97a0326908eb47d0f8f05f28d771865581a`
- Actual lightweight tag commit: `d2e3b97a0326908eb47d0f8f05f28d771865581a`
- Artifact: 27,718,845 bytes,
  `sha256:d573328cf4ae724df205230fc3e072d642f64a4dc840555c4dbd1c076118c78a`
- Manifest: 647 bytes,
  `sha256:37f1036a4816a8c5514ba0f1b079f1170b24855b0f236ba4cd8a51e087478015`
- Recomputed semantic identity:
  `sha256:708c3c89420c9bec89f634fb02f3d3269ec2ec51e601f0b15de23fbb493ffe3b`

Exact shadow, standard-event-shaped verification and live reconciliation each
produced byte-identical JSON to the migrated committed lock. Producer main was
`372715919bea9a267cfc417849983c337d5d3b91`, newer than the published revision;
reconciliation still resolved the Release successfully. Main was observed only
for this evidence, never used by the reader.

Reproduce read-only exact shadow (JSON on stdout; status on stderr):

```sh
pnpm exec tsx scripts/data-products/update-lock.ts shadow knowledge-public-v1 \
  knowledge-public-v1-d2e3b97a0326908eb47d0f8f05f28d771865581a
pnpm exec tsx --test scripts/data-products/*.test.ts scripts/verification-contract.test.ts
```

## Protocol authority and numeric limits

Protocol fixtures are byte-for-byte PDS examples at
`a4a75d2add3d8ef8e4b0cb07772c935be05e706e`; the corresponding
`scripts/data_product_protocol.py` is the cross-language reference. The semantic
fixture is a digest fixture, not a valid catalog domain payload.

`semantic-digest.ts` selects `{schemaVersion,product,producer,payload}` and hashes
compact UTF-8 JSON with recursively code-point-sorted keys, preserved array order,
and no trailing newline. Python and JavaScript do not generally serialize floats
identically. This implementation supports the reviewed safe-integer domain and
rejects non-integral/unsafe numbers and negative zero; broader numeric support
needs a protocol decision and shared fixtures. A mismatched producer semantic
digest fails closed.
