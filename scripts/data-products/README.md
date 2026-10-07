# Public Protocol-v1 consumer — knowledge + infra rollout

The common protocol foundation supports three public products; **generic sync and
prepare currently enable `knowledge-public-v1` and `infra-public-v2`**. PDS generic
consumption/materialization remains disabled; its legacy workflow and PR #120 are
unchanged. Private RuntimeBindings, Candidate provenance and production promotion
are not cut over by this slice.

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
pnpm sync  # knowledge + infra prepare wrappers, sharing exact Release verification
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
  requires `product` and exact `release_tag`. PDS remains not-yet-enabled; unknown
  products/producers and private bindings are rejected.
- `reconcile-data-products.yml` runs at `17 */6 * * *` and manually. Its knowledge +
  infra matrix calls the same reusable sync workflow. Each product shares the same
  concurrency group across event/manual/reconcile, lock generator, fixed branch
  `automation/data-product-<product>`, and PR flow. One product's failure does not
  cancel the other's run.
- A credential-free route step validates the request and emits registry-owned
  repository, branch and lock path. Producer reads use the existing short-lived
  `VAULT_APP_CLIENT_ID` / `VAULT_APP_PRIVATE_KEY` App with Contents Read on only the
  selected producer. CI/Candidate read tokens need both Thought Forest and Personal
  Infrastructure. The App installation must authorize these repositories before activation.
- Consumer writes use `GITHUB_TOKEN`. Since its pushes may suppress PR-triggered
  Actions, the workflow explicitly dispatches the existing protected `check.yml`
  at the fixed branch, waits for successful exact-head CI, and rechecks live PR
  head identity. Timeouts, CI failure and head movement fail closed. No auto-merge.
- `sync-knowledge-public-v1.yml` retains its legacy event/manual inputs and branch
  for rollback. Its final lock generation now also verifies through the common
  reader so it cannot downgrade the Protocol-v1 lock. Avoid dual legacy/standard
  dispatch during activation; they intentionally remain separate PR lanes.

- `sync-infra-public-v2.yml` is now only a manual alias to shared reconciliation.
  It has no schedule, old event listener, source checkout/exporter or second PR lane.
  Until Personal Infrastructure PR #112 is merged/activated, shared reconciliation
  recovers legacy/missed notifications from existing published semantic Releases.

Before activation, this consumer must reach the default branch, the reviewed
producer Protocol-v1 branches must be activated, and their consumer dispatch
credentials must be valid. Verify a real standard dispatch and
reconciliation run, lock-only PR, and protected exact-head CI in GitHub. Local
shadow reads do not prove these hosted write/CI operations. Merge stays manual;
auto-merge, provenance v5 and content production are later batches.

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

Check/Candidate public preparation no longer checks out Personal Infrastructure
or installs/runs its exporter. Private binding source checkout, credentials,
validation and secret mutation are unchanged, as is the Candidate v4 manifest.

**Production remains outside this slice.** `deploy-production.yml` is unchanged,
including its historical v4 public-source preparation call. Already published
rollback Releases use their exact historical tooling. Promoting a future Release
built from this slice requires a separately approved public revalidation cutover:
that workflow still passes the removed `--producer-root` option and its read App
scope has not been expanded for infra Releases. Do not treat local/CI acceptance
here as production readiness. No compatibility exporter path is retained in the
new prepare implementation.

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

### Infra verified lock migration

Producer reference: `BakerSean168/personal-infrastructure` PR #112, reviewed head
`55248d163bab1985caa09aa97036955448650835` (observed open/unmerged). Re-downloaded
current locked Release `402531799`, published `2026-10-03T13:46:42Z`:

- Tag: `infra-public-v2-88f5e8dd1865e373cdfec3b0c3dcce1dbb7f4df7`
- Dereferenced tag commit: `88f5e8dd1865e373cdfec3b0c3dcce1dbb7f4df7`
- Artifact: 25,884 bytes,
  `sha256:8dbad767d9dd76b2117865f10eb60c29b08087a491894ebc4ec0cfe60163602f`
- Manifest: 649 bytes,
  `sha256:7c2718a2b87a145e979fa72e116fb3885efac6aa9b673f8fedfc3b8c4cb0ac51`
- Recomputed semantic digest (TypeScript, independently confirmed by Python):
  `sha256:664fb1f8411a5b845cb558a8080bd6ba109171464c9367d090e9826a7ef785f3`

The existing source/tag/raw digests are unchanged. Migration replaces
`schemaVersion` with `protocolVersion` and adds the verified semantic digest.
The legacy prerelease reports GitHub `immutable: false`: this consumer implements
Protocol-v1 exact-tag/content-pinning immutability, not a requirement for GitHub's
new server-side Release immutability flag, which existing publications do not use.

Observed producer main: `ea906f56772eb380d1ec806fdc2bb3bc189b2a7f`, newer than the
latest semantic Release; no corresponding product Release exists. Live shared
reconciliation returned the committed lock with `changed=false`. The historical
regression fixture models those revisions and a missing main Release, forbids
main lookups, and exercises the same event/manual/reconcile entrypoint. Main was
observed for evidence only and is never an input to reconciliation.

```sh
pnpm exec tsx scripts/data-products/update-lock.ts shadow infra-public-v2 \
  infra-public-v2-88f5e8dd1865e373cdfec3b0c3dcce1dbb7f4df7
pnpm exec tsx scripts/data-products/update-lock.ts reconcile infra-public-v2
```

Hosted dispatch, fixed-branch/PR refresh and exact-head protected CI still require
post-merge activation evidence. No remote writes were performed for this slice.

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
