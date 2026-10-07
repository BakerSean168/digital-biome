# Delivery v5 implementation

New Candidates and application Releases record all three complete Protocol-v1 consumer locks in `dataProducts`: Knowledge, PDS catalog, and public Infrastructure. The private Infrastructure RuntimeBinding remains an independent `privateBindings` entry. These maps, source SHA, CI identity and immutable Pages archive identity participate in the manifest digest. Generation time does not.

Production validates the manifest and exact committed locks before fetching Releases or materializing inputs. It verifies the private checkout revision and binding digest, then runs the domain-owned public/private reference coverage checks. This work prepares deployment inputs only: the Pages archive is verified and unpacked before any encrypted binding mutation, and promoted with `--no-bundle` without an Astro build.

Historical v4/v3 published Releases retain their original tooling at their tagged application source. The current workflow selects their historical verifier path; new source does not write those schemas. Their source-regeneration compatibility path must remain until a v5 production proof and rollback drill justify retirement.

## Verification

The manifest tests cover complete identity preservation, missing or swapped inputs, digest tampering, and v4/v3 rollback compatibility. A workflow execution test runs the actual Candidate identity shell block against fixture output and committed locks, then promotes the resulting manifest without rebuilding. Revalidation tests reject any public or private lock mismatch, including semantic identity changes that preserve source SHA.

Local three-product Release preparation succeeds with the existing developer read credential. Hosted CI still requires the existing GitHub App installation to include read access to both `personal-infrastructure` and `personal-digital-system`; no broad personal token fallback is introduced. RuntimeBinding credentials remain separate.

## Rollout status

Infra consumer #122, PDS consumer #124 and v5 delivery #125 merged on 2026-10-07 after the existing GitHub App installation was extended and fresh exact-head CI passed. The automatic content layer follows in #126. Producer publication cutover and the v5 application Release must precede enabling both automation switches.

The production-content Environment uses the same destination account/project and read-only private repository access as application production. It needs CLOUDFLARE_ACCOUNT_ID, a CLOUDFLARE_API_TOKEN with Cloudflare Pages Edit on the destination account, and PERSONAL_INFRASTRUCTURE_DEPLOY_KEY with read-only repository access. Its deployment branch policy is main-only; application production retains its separate approval gate.

CI, merge, Candidate, Release and Production remain separate states. Use the published Release manifest and Cloudflare deployment record as delivery evidence; merged code alone does not prove activation. The historical v0.8.1 production evidence and the current takeover status are recorded in docs/data-product-takeover-status.md.
