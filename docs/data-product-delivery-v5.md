# Delivery v5 implementation

New Candidates and application Releases record all three complete Protocol-v1 consumer locks in `dataProducts`: Knowledge, PDS catalog, and public Infrastructure. The private Infrastructure RuntimeBinding remains an independent `privateBindings` entry. These maps, source SHA, CI identity and immutable Pages archive identity participate in the manifest digest. Generation time does not.

Production validates the manifest and exact committed locks before fetching Releases or materializing inputs. It verifies the private checkout revision and binding digest, then runs the domain-owned public/private reference coverage checks. This work prepares deployment inputs only: the Pages archive is verified and unpacked before any encrypted binding mutation, and promoted with `--no-bundle` without an Astro build.

Historical v4/v3 published Releases retain their original tooling at their tagged application source. The current workflow selects their historical verifier path; new source does not write those schemas. Their source-regeneration compatibility path must remain until a v5 production proof and rollback drill justify retirement.

## Verification

The manifest tests cover complete identity preservation, missing or swapped inputs, digest tampering, and v4/v3 rollback compatibility. A workflow execution test runs the actual Candidate identity shell block against fixture output and committed locks, then promotes the resulting manifest without rebuilding. Revalidation tests reject any public or private lock mismatch, including semantic identity changes that preserve source SHA.

Local three-product Release preparation succeeds with the existing developer read credential. Hosted CI still requires the existing GitHub App installation to include read access to both `personal-infrastructure` and `personal-digital-system`; no broad personal token fallback is introduced. RuntimeBinding credentials remain separate.

## Rollout status

Implementation is in the stack after Infra consumer PR #122 and PDS consumer PR #124. CI, merge, Candidate, Release and Production are separate states. The frontend PR #123 has merged independently. This document does not assert v5 production activation before workflow and deployment evidence exists.
