# ADR-0003: Consume infrastructure facts from Personal Infrastructure

Status: Accepted — 2026-10-02

## Context

Digital Biome historically rendered infrastructure pages from two consumer-owned sources:

- infrastructure asset notes synchronized from Thought Forest;
- static tables and topology constants in the Digital Biome source tree.

That duplicated host, network, service, lifecycle, and topology facts across repositories. It also meant an obsolete asset could remain visible after the operational infrastructure source had already changed.

Personal Infrastructure now publishes `infra-public-v2`, an immutable, presentation-safe projection containing infrastructure resource identity, lifecycle, public links, stable protected-value references, and explicit topology relationships. Protected values remain in the separate `digital-biome-private-infrastructure-v1` RuntimeBinding.

## Decision

Digital Biome treats Personal Infrastructure as the sole owner of infrastructure facts.

The current build:

1. pins an immutable `infra-public-v2` Release in `data-products/infra-public-v2.lock.json`;
2. verifies artifact and producer-manifest digests;
3. materializes the projection into the generated build input;
4. renders `/infrastructure` and infrastructure detail routes only from that projection;
5. resolves protected values and links only through the pinned private RuntimeBinding at authenticated runtime/deployment.

Thought Forest remains the knowledge producer. Its infrastructure knowledge may explain concepts, incidents, and operating procedures, but its asset-note layout is no longer an infrastructure source for Digital Biome.

The delivery contract is therefore upgraded to v4 so Candidate/Release provenance records three independent identities:

- `knowledge`;
- `publicInfrastructure`;
- `privateInfrastructure`.

v1-v3 Release validation remains available for rollback compatibility.

## Consequences

- Digital Biome no longer owns a VPS list or homelab fact table.
- Retired infrastructure disappears when the producer projection changes rather than when a presentation constant is edited.
- Public and protected infrastructure data have separate contracts and security boundaries.
- A Digital Biome release can be reproduced from exact application, knowledge, public-infrastructure, and private-infrastructure identities.
- Infrastructure presentation changes that require new facts must be made in Personal Infrastructure first.
