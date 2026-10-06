#!/usr/bin/env bash
set -euo pipefail

# Compatibility fetch-only entrypoint; same exact Release reader and verifier as prepare.
pnpm exec tsx scripts/data-products/prepare-infra-public-v2.ts \
  "${1:-.pds-runtime/infra-public-v2}" \
  "${2:-data-products/infra-public-v2.lock.json}" --fetch-only
