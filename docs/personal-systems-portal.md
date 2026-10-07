# Personal Systems portal

Digital Biome now treats `/systems` as the presentation surface for the Personal Digital System rather than using "My Infrastructure" as the umbrella concept.

## Ownership model

- **Personal Digital System** owns system/domain/repository boundaries plus canonical repository navigation/lifecycle metadata and publishes `pds-catalog-v1`.
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

`/systems` is a **personal system launcher**, not a dashboard and not a second source of truth. Its default reading order is:

1. **Pinned** — at most a small set of high-frequency entrypoints such as Personal Twin, LiteLLM, Hermes and Nezha;
2. **Servers** — the current active `public-fleet` hosts and the number of launcher services placed on each host;
3. **Services** — a compact directory grouped into Apps & Products, AI & Agents, Operations and Home Lab; each row answers “what is it, where does it run, who can access it, how do I open it?”;
4. **System Registry** — repository/Owner/PDS boundary metadata, collapsed by default because it is engineering detail rather than the primary navigation task.

`/infrastructure` remains the deeper runtime/topology/resource view. Debug ports, MCP endpoints, secondary links and historical inventory belong there rather than on the launcher.

The launcher is derived from `infra-public-v2` groups (`portal-apps`, `portal-ai`, `portal-ops`, `portal-homelab`, `portal-pinned`). Digital Biome does not keep a separate hand-written service list. Public targets open directly; protected targets are represented only by `privateRef` and resolve through the authenticated private infrastructure API.

Global Search consumes the same launcher read model. Searching `litellm`, `twin`, `hermes`, `pve`, etc. navigates to the matching service without introducing another asset-discovery page.

## Sync model

Digital Biome tracks only `data-products/pds-catalog-v1.lock.json`, using the common public Protocol-v1 contract. `pnpm sync` / `pnpm sync:data-products`, CI and Candidate read the exact immutable Release with the public read-only GitHub App, verify tag/source/manifest/raw and semantic digests plus the existing PDS domain parser, then generate the ignored `src/data/system/pds-catalog-v1.json`. Consumer builds never check out PDS source or run its exporter.

Standard events, manual recovery and scheduled reconciliation use the same generic verifier and fixed lock-only PR branch, with protected exact-head CI and manual merge. The legacy PDS workflow is a manual reconciliation alias only. See [consumer migration evidence and PR #120 supersession handoff](../scripts/data-products/README.md#pds-prepare-and-git-ownership-cutover-dpp-303307). Private RuntimeBinding credentials and `/systems` audience policy remain separate.

## Domain visibility policy

Digital Biome owns a small presentation-only policy in `src/config/personal-systems-access.ts`:

- `public` domains are rendered into the static `/systems` HTML;
- `owner` domains are absent from public HTML and are loaded from `/api/private/systems` only after Cloudflare Access authentication;
- `hidden` domains are omitted from both presentation surfaces;
- unknown future domains fail closed to `owner` until explicitly classified.

This policy deliberately stays out of Personal Digital System. PDS defines catalog truth; Digital Biome defines audience/presentation. The current public system map exposes Infrastructure, Knowledge, and Presentation. Products, Personal Configuration, Personal Twin, and Agent Platform are owner-only.

Repository cards may expose a direct GitHub jump only when `pds-catalog-v1` carries the producer-owned `webUrl`. Digital Biome does not guess repository URLs from names.
