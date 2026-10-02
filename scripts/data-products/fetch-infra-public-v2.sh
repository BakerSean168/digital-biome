#!/usr/bin/env bash
set -euo pipefail

runtime_root="${1:-.pds-runtime/infra-public-v2}"
lock_path="${2:-data-products/infra-public-v2.lock.json}"

if [ -z "${GH_TOKEN:-}" ]; then
  if command -v gh > /dev/null 2>&1; then
    GH_TOKEN="$(gh auth token 2>/dev/null || true)"
    export GH_TOKEN
  fi
fi

test -n "${GH_TOKEN:-}" || {
  echo "A GitHub token is required to fetch infra-public-v2. Set GH_TOKEN or authenticate gh." >&2
  exit 1
}

producer="$(jq -r '.producerRepository' "$lock_path")"
release_tag="$(jq -r '.releaseTag' "$lock_path")"
artifact_name="$(jq -r '.artifact.name' "$lock_path")"
manifest_name="$(jq -r '.manifest.name' "$lock_path")"

case "$producer" in
  BakerSean168/personal-infrastructure) ;;
  *)
    echo "unexpected infrastructure producer repository: $producer" >&2
    exit 1
    ;;
esac

rm -rf "$runtime_root"
mkdir -p "$runtime_root"

gh release download "$release_tag"   --repo "$producer"   --pattern "$artifact_name"   --pattern "$manifest_name"   --dir "$runtime_root"

pnpm exec tsx scripts/data-products/verify-infra-public-v2-lock.ts   "$lock_path"   "$runtime_root/$artifact_name"   "$runtime_root/$manifest_name"

echo "INFRA_PUBLIC_V2_ARTIFACT=$runtime_root/$artifact_name"
