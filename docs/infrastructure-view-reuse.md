# Infrastructure view reuse and retired legacy component chain (DB-Q10)

Issue: #183. Parent governance tracker: #172. Depends on merged DB-Q09 #199.

## Evidence-based ownership

- Active infrastructure registry: InfrastructureShowcase.astro, referenced by /infrastructure.
- Active infrastructure resource detail: /infrastructure/[assetId].astro.
- Active note-based asset detail: AssetDetailView.astro, shared by /dev, /tools and /projects detail routes.
- Active topology subtree: InfrastructureTopologyMap.astro -> TopologyNodeCard.astro, rendered by AssetDetailView for supplied sub-topology. It is NOT interchangeable with the current infrastructure fleet registry and was preserved.
- Unused old display DAG: InfrastructureAtlas.astro -> AssetSection.astro -> AssetCard.astro and ProjectCard.astro; separate InfrastructureNodePanel.astro. A full tracked-source search found no production import from any live page or component; no generic Astro glob or runtime component discovery references it. All five were removed as one unreachable DAG.
- Five SHA-256 formatter grandfather entries were removed alongside these files; all remaining historical file hashes are preserved.

## Shared policy, without over-abstraction

- infrastructure-labels.ts is the one type-checked source of the five infrastructure status labels (Chinese detail, uppercase registry code, color tone) and four registry kind labels. Existing registeredStatus and publicResourceGroups remain compatible.
- InfrastructureKindIcon.astro is the one active, reusable renderer mapping host to Server, network to Network and service/platform to Boxes. Both /infrastructure registry and /infrastructure/[assetId] detail use it.
- asset-card.ts owns the distinct note-based visibility policy for internal/private links and the original monitor-link fallback. AssetDetailView uses that pure policy; these note AssetLinks are not conflated with the separately published infra-public-v2 InfrastructureResourceLink type.
- Distinct UI patterns remain local rather than abstracting unrelated tags and access states into a complex generic component. No new private target data reaches SSR or public catalogs.

## Protected contracts and verification

The original /infrastructure route, /infrastructure/[assetId], /tools, /dev, /projects, schema identity, asset_id, privateRef and login fallback, page layout and GUI/TUI modes remain unchanged. The access middleware, immutable data-product locks, release manifests and production promotion path were not touched.

Regression gates: focused status/kind and link-policy tests, static entrypoint/deletion tests, Astro type check, Biome/Oxlint/Oxfmt, infrastructure/edge/unit tests, Astro static build, Pagefind, performance budgets and Chromium E2E. The new browser contract verifies kind icons, registered statuses, host detail and private-link fallback at mobile and desktop widths.

Rollback: revert the isolated DB-Q10 PR and restore its two original format-baseline SHA entries as well as the three transitive orphan entries. Do not modify independent Q09 or older migrations.
