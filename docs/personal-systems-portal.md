# Personal Systems portal

Digital Biome now treats `/systems` as the presentation surface for the Personal Digital System rather than using "My Infrastructure" as the umbrella concept.

## Ownership model

- **Personal Digital System** owns only system/domain/repository boundaries and publishes `pds-catalog-v1`.
- **Personal Infrastructure** owns runtime infrastructure facts and publishes `infra-public-v2` plus the protected RuntimeBinding.
- **Thought Forest** owns knowledge facts and publishes `knowledge-public-v1`.
- **Product repositories** own application behavior.
- **Digital Biome** composes these producer-owned views; it must not become another source of truth.

This mirrors a software-catalog model: systems/domains provide the logical map, components/resources remain owned by their authoritative producers, and the portal is a read-oriented composition layer.

## Access tiers

The portal uses three practical tiers without putting protected values in public HTML:

1. **Public** — safe metadata and public links can be indexed and opened directly.
2. **Owner** — public-safe metadata may be listed, but the operational target is a stable `privateRef`; Cloudflare Access unlocks the target at runtime.
3. **Internal** — Personal Infrastructure resources marked `visibility: internal` never enter `infra-public-v2`, so they are absent from the public build entirely.

Cloudflare Access remains path/API policy enforcement. UI locks are only presentation hints; authorization is enforced by the protected `/api/private/*` Functions middleware.

## Information architecture

`/systems` is the top-level hub:

- current access mode;
- system/domain map from `pds-catalog-v1`;
- quick service/control entry points from `infra-public-v2`;
- public product/project cards;
- focused links into infrastructure, projects, and knowledge.

`/infrastructure` remains a focused runtime/topology view rather than the umbrella page.

## Sync model

The public-safe PDS catalog is materialized into Digital Biome by an automation PR. The workflow checks out the private PDS repository using a read-only deploy key, runs the producer-owned exporter at an exact Git revision, verifies the digest, and commits only the generated public-safe artifact plus its lock. Normal Digital Biome builds therefore do not need access to the private PDS repository.
