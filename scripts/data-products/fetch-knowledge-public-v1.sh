#!/usr/bin/env bash
set -euo pipefail

# Compatibility entrypoint; identity, transport and staging are owned by the common reader.
pnpm exec tsx scripts/data-products/prepare-knowledge-public-v1.ts \
  "${1:-.pds-runtime/knowledge-public-v1}" \
  "${2:-data-products/knowledge-public-v1.lock.json}" --fetch-only
