# ADR-0002: Producer-owned private infrastructure RuntimeBinding

- Status: Accepted
- Date: 2026-10-02
- Decision scope: private infrastructure ownership, Digital Biome production provenance, runtime binding transport
- Supersedes: the private-source checkout mechanism in ADR-0001; ADR-0001 remains authoritative for Wrangler Direct Upload, production approval, and Cloudflare Access boundaries

## Context

Digital Biome needs two classes of data that have different ownership and publication rules:

1. public knowledge and redacted asset metadata, produced by Thought Forest as `knowledge-public-v1`;
2. protected infrastructure values such as private endpoints and host addresses, needed only by authenticated runtime surfaces.

The previous production path regenerated the protected infrastructure payload by checking out the exact private Thought Forest source revision recorded by a Release. That preserved reproducibility, but it coupled Digital Biome production to the knowledge repository's private source layout and made Thought Forest an accidental owner of infrastructure runtime facts.

The Personal Digital System boundary is now:

- one fact, one owner;
- producer-owned projection or contract;
- consumer-owned lock and validation;
- exact revision and digest provenance;
- no cross-repository source-layout dependency.

Personal Infrastructure is the canonical owner of infrastructure runtime facts. Thought Forest remains the canonical knowledge repository and publishes only the redacted public knowledge product.

## Decision

Personal Infrastructure owns a consumer-scoped private contract:

`bindings/digital-biome/private-infrastructure-v1.json`

The contract envelope is `pds/v1alpha1 RuntimeBinding` and identifies:

- producer: `pds://system/component/personal-infrastructure`;
- consumer: `pds://system/component/digital-biome`;
- contract: `digital-biome-private-infrastructure/v1`;
- payload: the existing Digital Biome `{ version, values, links }` private-infrastructure shape.

Digital Biome does not commit the private contract contents. It commits only:

`data-products/digital-biome-private-infrastructure-v1.lock.json`

The lock records:

- producer repository;
- exact 40-character Git revision;
- exact contract path;
- SHA-256 of the contract bytes.

Candidate and Release manifests use schema v3 and bind both independent producer identities:

- `knowledge-public-v1` from Thought Forest;
- `digital-biome-private-infrastructure-v1` from Personal Infrastructure.

Production checks out the exact Personal Infrastructure revision using a read-only deploy key stored only in the Digital Biome `production` Environment, verifies the locked contract SHA-256, validates the consumer contract, renders `PRIVATE_INFRASTRUCTURE_JSON`, and updates the encrypted Cloudflare Pages binding.

Current v3 production does not check out Thought Forest private source and does not run Thought Forest `kb:index`.

## Security boundary

The RuntimeBinding may contain private operational values, but it must not contain credentials, tokens, passwords, or backend secret material.

Validation rejects:

- unknown contract envelope fields;
- malformed or unbounded keys/values;
- unsupported link protocols;
- HTTP(S) URLs with embedded username/password;
- any URL containing a password.

SSH URLs may include a login username because it is part of endpoint identity; passwords remain prohibited.

The repository deploy key is read-only. Its private key exists only as the Digital Biome production Environment secret `PERSONAL_INFRASTRUCTURE_DEPLOY_KEY`.

## Delivery provenance

For v3:

```text
Thought Forest -> knowledge-public-v1 Release -> knowledge lock
Personal Infrastructure -> private RuntimeBinding -> private lock
Digital Biome main CI -> Candidate v3 -> Release v3
Release v3 + production approval
  -> verify knowledge provenance
  -> checkout exact Personal Infrastructure revision
  -> verify RuntimeBinding digest + consumer coverage
  -> update encrypted Pages binding
  -> deploy unchanged immutable Pages artifact
```

The public application artifact is built only during Candidate creation. Production does not rebuild application code.

## Rollback compatibility

Historical Release schemas remain valid:

- v2 keeps the former exact private Thought Forest checkout path;
- v1 keeps the historical gitlink + Vault SHA + private asset-index digest path.

This preserves deployability of older Published Releases without reintroducing those dependencies into the current v3 path.

## Consequences

Positive:

- Personal Infrastructure becomes the single owner of private infrastructure facts.
- Thought Forest is no longer a production-private runtime dependency for current Releases.
- Digital Biome depends on a small explicit contract rather than another repository's source layout.
- Public knowledge and private infrastructure provenance are independently reproducible.
- The Cloudflare encrypted binding retains the existing runtime API, so the browser-facing behavior does not need a migration.

Negative:

- Production has one additional read-only credential boundary for Personal Infrastructure.
- A private binding revision change requires a Digital Biome lock update before a new Release can carry it.
- v1/v2 rollback support retains some historical workflow complexity until those Releases are intentionally retired.

## Alternatives rejected

### Keep deriving private infrastructure from Thought Forest

Rejected because it makes the knowledge repository an infrastructure runtime owner and preserves a source-layout dependency across repositories.

### Commit the private payload into Digital Biome

Rejected because Digital Biome is public and the payload contains protected infrastructure values.

### Fetch Personal Infrastructure by mutable branch or `latest`

Rejected because production provenance must be reproducible. The consumer pins a full Git SHA and the contract byte digest.

### Put credentials inside the RuntimeBinding

Rejected. Credentials remain in dedicated secret stores and GitHub/Cloudflare environment secrets.

## Verification

The implementation is accepted only when:

- Personal Infrastructure contract validation and sensitive-state checks pass;
- all public `privateRef` keys required by Digital Biome are covered by the private RuntimeBinding;
- Digital Biome Candidate/Release v3 manifest tests pass;
- workflow contract tests prove v3 does not run private Thought Forest indexing/sync;
- full Digital Biome `pnpm verify:full` passes against the immutable public projection and materialized private RuntimeBinding.
