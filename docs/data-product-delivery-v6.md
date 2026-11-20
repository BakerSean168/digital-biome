# Delivery v6

Thought Forest owns knowledge, Projects and Uses. Personal Infrastructure owns infrastructure facts, deployment configuration and protected runtime bindings. Digital Biome consumes only their public projections. v6 is implemented on this branch but has not been released. Production still uses the v5 contract and the pinned pds-catalog-v1 publication; PDS retirement is pending Staging acceptance and a later release.

Candidate and Release accept only `digital-biome.candidate/v6` and `digital-biome.release/v6`. The exact public product set is `knowledge-public-v1` and `infra-public-v2`; the separate protected binding is `digital-biome-private-infrastructure-v1`. Unknown products, fields and old schemas fail closed.

Full committed locks, Git SHA, source CI, Candidate identity and immutable Pages artifact identity participate in the digest. Release promotion preserves these values. Annotated release provenance binds the release digest, artifact digest and candidate digest.

Production revalidates complete committed locks, immutable producer publications, private checkout revision, private binding digest and public/private reference coverage. It deploys the existing verified archive without rebuilding. Historical Git commits and Releases remain available for manual recovery; current workflows provide no old-schema deployment path.

Generated notes, indexes and infrastructure projections remain ignored. Public output includes only opaque private references; protected targets resolve through the authenticated Infrastructure API.

## Acceptance

Run `pnpm verify`, `pnpm build:only` and browser critical paths. Staging acceptance must separately prove hosted credentials, protected API authentication and producer publication access. Production deployment and repository archival require a later explicit decision.
