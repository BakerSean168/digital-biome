#!/usr/bin/env bash
set -euo pipefail

runtime_root=".pds-runtime/infra-public-v2"
lock_path="data-products/infra-public-v2.lock.json"
producer_root=""

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
    --producer-root)
      test "$#" -ge 2 || { echo "--producer-root requires a value" >&2; exit 1; }
      producer_root="$2"
      shift 2
      ;;
    *)
      echo "unknown prepare option: $1" >&2
      exit 1
      ;;
  esac
done

artifact_name="$(jq -r '.artifact.name' "$lock_path")"
manifest_name="$(jq -r '.manifest.name' "$lock_path")"
source_revision="$(jq -r '.sourceRevision' "$lock_path")"

if [ -n "$producer_root" ]; then
  producer_root="$(cd "$producer_root" && pwd)"
  actual_revision="$(git -C "$producer_root" rev-parse HEAD)"
  [[ "$actual_revision" == "$source_revision" ]] || {
    echo "producer checkout revision mismatch: expected $source_revision, got $actual_revision" >&2
    exit 1
  }

  rm -rf "$runtime_root"
  mkdir -p "$runtime_root"

  (
    cd "$producer_root"
    python3 scripts/export_infra_public_v2.py
  )

  cp "$producer_root/generated/$artifact_name" "$runtime_root/$artifact_name"
  cp "$producer_root/generated/$manifest_name" "$runtime_root/$manifest_name"
  pnpm exec tsx scripts/data-products/verify-infra-public-v2-lock.ts     "$lock_path"     "$runtime_root/$artifact_name"     "$runtime_root/$manifest_name"
else
  scripts/data-products/fetch-infra-public-v2.sh "$runtime_root" "$lock_path"
fi

pnpm exec tsx scripts/data-products/materialize-infra-public-v2.ts "$runtime_root/$artifact_name"

materialized_revision="$(jq -r '.source.revision' src/data/infrastructure/infra-public-v2.json)"
[[ "$materialized_revision" == "$source_revision" ]] || {
  echo "materialized infrastructure source revision mismatch" >&2
  exit 1
}

echo "infra-public-v2 prepare=PASS revision=$source_revision output=src/data/infrastructure/infra-public-v2.json"
