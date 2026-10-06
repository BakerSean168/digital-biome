#!/usr/bin/env bash
set -euo pipefail

runtime_root=".pds-runtime/infra-public-v2"
lock_path="data-products/infra-public-v2.lock.json"

while [ "$#" -gt 0 ]; do
  case "$1" in
    --)
      shift
      ;;
    --runtime-root)
      test "$#" -ge 2 || { echo "--runtime-root requires a value" >&2; exit 1; }
      runtime_root="$2"
      shift 2
      ;;
    --lock)
      test "$#" -ge 2 || { echo "--lock requires a value" >&2; exit 1; }
      lock_path="$2"
      shift 2
      ;;
    *)
      echo "unknown prepare option: $1" >&2
      exit 1
      ;;
  esac
done

pnpm exec tsx scripts/data-products/prepare-infra-public-v2.ts "$runtime_root" "$lock_path"
