# Cloudflare Pages deployment

This site is a static Astro build with a narrowly routed Pages Functions API.
The public build contains masked infrastructure labels only. Real IP addresses
and protected URLs are returned after Cloudflare Access authentication.

## Architecture and trust boundary

- `public/_routes.json` invokes Functions only for `/api/private/*`.
- Cloudflare Access must protect `/api/private/*` before requests reach Pages.
- `functions/api/private/_middleware.ts` validates the
  `Cf-Access-Jwt-Assertion` signature, issuer, audience, expiry, and app-token
  claims. Missing or invalid tokens fail closed.
- `PRIVATE_INFRASTRUCTURE_JSON` is an encrypted runtime secret. It is never a
  build-time public variable.
- The sync pipeline masks non-allowlisted IPv4 addresses in every Markdown note.
- `scripts/postbuild.ts` scans HTML, JavaScript, JSON, and Pagefind output for
  source infrastructure identifiers and fails the build on a match.

## One-time Cloudflare setup

1. Create or select the Pages project named `digital-biome`; production branch
   is `main`, output directory is `dist`, and Node is pinned by `.node-version`.
2. Create a Cloudflare Access self-hosted application for the production host
   with path `/api/private/*`. Add only the intended GitHub/Google identities.
3. Copy the application Audience tag and team domain.
4. Add these encrypted production secrets under Pages → Settings → Variables
   and Secrets:

   - `CF_ACCESS_TEAM_DOMAIN` — `https://<team>.cloudflareaccess.com`
   - `CF_ACCESS_AUD` — the Access application Audience tag
   - `PRIVATE_INFRASTRUCTURE_JSON` — versioned JSON generated below

Do not configure these names as plaintext build variables or `PUBLIC_*` values.

## Generate the private payload

The exporter derives protected link keys and Infrastructure Showcase aliases
from the upstream asset index, then validates the runtime schema:

```bash
pnpm export:private -- --out tmp/private-infrastructure.json
```

Use the generated file as the value of `PRIVATE_INFRASTRUCTURE_JSON`, then remove
the local copy. `tmp/`, `.dev.vars*`, and environment files are excluded from
source control.

## Validate and deploy

```bash
pnpm sync
pnpm check
pnpm check:edge
pnpm test:edge
pnpm build:only
pnpm deploy:cloudflare
```

`pnpm deploy:cloudflare` performs a fresh synced build before direct upload. A
deployment is not ready merely because static upload succeeded; complete the
production checks below.

## Production acceptance checks

1. Signed out: `GET /api/private/infrastructure` is denied by Access or returns
   `401`; the infrastructure page remains masked and protected links stay locked.
2. Signed in with an allowed identity: `/api/private/session` returns
   `{ "authenticated": true }`, and private values/links unlock in the page.
3. Signed in with a disallowed identity: Access denies the request.
4. `dist/` and Pagefind contain no complete private IP address, SSH URL, or
   protected internal URL. This is also enforced by `scripts/postbuild.ts`.
5. Verify `/api/private/infrastructure` responses include
   `Cache-Control: private, no-store` and never appear in a shared cache.

## Key maintenance

`edge/private-refs.ts` is the single key-construction rule used by both the
public asset-index redaction and the private secret exporter. Regenerate the
payload after adding, renaming, or changing visibility of an asset link. Avoid
hand-maintained duplicate key maps; the exporter owns compatibility aliases such
as `vps.*.ip` and `portal.home`.
