#!/usr/bin/env bash
set -euo pipefail

lock_path="${2:-data-products/knowledge-public-v1.lock.json}"
runtime_root="${1:-.pds-runtime/knowledge-public-v1}"

test -n "${GH_TOKEN:-}" || {
  echo "GH_TOKEN is required to fetch the private knowledge-public-v1 Release." >&2
  exit 1
}

producer="$(jq -r '.producerRepository' "$lock_path")"
release_tag="$(jq -r '.releaseTag' "$lock_path")"
artifact_name="$(jq -r '.artifact.name' "$lock_path")"
manifest_name="$(jq -r '.manifest.name' "$lock_path")"

case "$producer" in
  BakerSean168/thought-forest) ;;
  *)
    echo "unexpected knowledge producer repository: $producer" >&2
    exit 1
    ;;
esac

rm -rf "$runtime_root"
mkdir -p "$runtime_root"

gh release download "$release_tag" \
  --repo "$producer" \
  --pattern "$artifact_name" \
  --pattern "$manifest_name" \
  --dir "$runtime_root"

pnpm exec tsx scripts/data-products/verify-knowledge-public-v1-lock.ts \
  "$lock_path" \
  "$runtime_root/$artifact_name" \
  "$runtime_root/$manifest_name"

echo "KNOWLEDGE_PUBLIC_V1_ARTIFACT=$runtime_root/$artifact_name"
