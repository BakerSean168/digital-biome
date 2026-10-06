# Public Protocol-v1 foundation (DPP-301 / DPP-302)

This is an opt-in pure foundation. Existing product entrypoints, committed locks,
workflows, and private RuntimeBindings are unchanged.

- `registry.ts` allowlists exactly three public producer/product pairs, their
  assets, manifest contracts, lock paths, parser functions, and materializer
  identities. PDS uses `application/vnd.pds.catalog-v1+json`; its future JSON
  materializer is declarative here, not an implemented writer (DPP-304).
- `lock-v1.ts` accepts **decoded JSON** as `unknown`. `parseDataProductPublished`
  validates the snake-case event through the same lock validation path.
  `canonicalLockIdentity` produces compact sorted JSON without a trailing newline
  or non-authoritative `consumerMetadata`. It is suitable for identity comparison;
  callers may pretty-print the validated identity for a future lock PR.
- `verify-publication.ts` accepts an identity, fetched asset names/bytes, and
  independently verified tag metadata. It verifies transport hashes before
  decoding, manifest identity before invoking the existing domain parser, then
  source binding and semantic digest. It returns the parsed projection and
  canonical verified producer identity. It does not fetch, write, or materialize.
- `semantic-digest.ts` selects only `{schemaVersion,product,producer,payload}` and
  hashes compact UTF-8 JSON with recursively code-point-sorted object keys,
  preserved array order, and no trailing newline.

## Authority and limits

Fixtures in `fixtures/` are byte-for-byte copies of PDS examples at
`a4a75d2add3d8ef8e4b0cb07772c935be05e706e`. The semantic fixture is a digest fixture,
not a valid catalog domain payload. The corresponding PDS
`scripts/data_product_protocol.py` is the cross-language reference.

Reviewer P2 numeric caveat: Python and JavaScript do not generally serialize
floating-point JSON identically (`1.0`, `-0.0`, exponent notation, precision).
This batch proves the current safe-integer domain, rejects non-integral/unsafe
numbers and negative zero, and does not claim a general floating-point standard.
JSON parsing in JavaScript already erases the spelling distinction between `1`
and `1.0`; producers must stay in the shared integer domain. A mismatched producer
semantic digest fails verification rather than being silently accepted. Broader
numeric support requires a shared protocol decision and cross-language fixtures.

`VerifiedReleaseTag` is a caller trust precondition, not proof obtained from an
event. The future Release reader must independently fetch the exact repository
and tag, check the Release is published/non-draft, resolve annotated/lightweight
Git tags to the exact commit, and provide that commit as `sourceRevision`.
GitHub's mutable `target_commitish` is not sufficient. No claim of live Release
verification is made by unit tests supplying this metadata.

## Next knowledge slice

Add the injectable, bounded exact-Release reader and isolated staging/cleanup,
then shadow-verify a real knowledge publication before wiring lock PRs or
materialization. Do not regenerate from producer source or mutate an accepted
materialization on verifier failure. Convert locks only from verified published
bytes; never invent missing semantic or manifest digests. Release transport and
live publication proof are deliberately deferred, not supplied by this batch.

Focused checks:

```sh
pnpm exec tsx --test scripts/data-products/protocol-v1.test.ts scripts/data-products/verify-publication.test.ts
pnpm exec tsx --test scripts/data-products/*-lock.test.ts scripts/data-products/knowledge-public-v1.test.ts src/domain/system/pds-catalog-v1.test.ts
```

Repository-wide Astro/build gates require the ignored lock-backed content to be
materialized first. Do not substitute fake generated indexes to make them pass.
