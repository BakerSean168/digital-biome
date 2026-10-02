#!/usr/bin/env bash
set -euo pipefail

runtime_root=".pds-runtime/knowledge-public-v1"
lock_path="data-products/knowledge-public-v1.lock.json"
sync_args=()

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
    --dry-run|--with-favicons)
      sync_args+=("$1")
      shift
      ;;
    *)
      echo "unknown prepare option: $1" >&2
      exit 1
      ;;
  esac
done

scripts/data-products/fetch-knowledge-public-v1.sh "$runtime_root" "$lock_path"

artifact_name="$(jq -r '.artifact.name' "$lock_path")"
source_root="$runtime_root/source"
rm -rf "$source_root"

KNOWLEDGE_PUBLIC_V1_SOURCE_ROOT="$source_root" \
  pnpm sync:data-products:knowledge "$runtime_root/$artifact_name" "${sync_args[@]}"

source_revision="$(jq -r '.sourceRevision' "$lock_path")"
materialized_revision="$(jq -r '.source.revision' "$source_root/.pds-data-product-source.json")"
[[ "$materialized_revision" == "$source_revision" ]] || {
  echo "materialized knowledge source revision mismatch" >&2
  exit 1
}

echo "knowledge-public-v1 prepare=PASS revision=$source_revision source=$source_root"
