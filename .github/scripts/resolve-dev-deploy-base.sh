#!/usr/bin/env bash

set -euo pipefail

current_sha="${GITHUB_SHA:?GITHUB_SHA is required}"
api_url="${GITHUB_API_URL:-https://api.github.com}"
repository="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
output_file="${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"
force_all_services="${FORCE_ALL_SERVICES:-false}"
changed_paths_file="${2:-${DEV_DEPLOY_CHANGED_PATHS_FILE:-}}"

case "$force_all_services" in
  true|false) ;;
  *)
    printf 'FORCE_ALL_SERVICES must be true or false\n' >&2
    exit 1
    ;;
esac

runs_json_file="${1:-}"
if [[ -n "$runs_json_file" ]]; then
  runs_json="$(cat "$runs_json_file")"
else
  token="${GITHUB_TOKEN:?GITHUB_TOKEN is required}"
  runs_json="$(curl --fail --silent --show-error \
    --header "Accept: application/vnd.github+json" \
    --header "Authorization: Bearer ${token}" \
    --header "X-GitHub-Api-Version: 2022-11-28" \
    "${api_url}/repos/${repository}/actions/workflows/deploy-dev.yml/runs?branch=dev&status=success&per_page=100")"
fi

last_successful_sha="$(jq -r --arg current "$current_sha" '
  [.workflow_runs[]? | select(.head_sha != $current) | select(.conclusion == "success")]
  | sort_by(.created_at)
  | last
  | .head_sha // empty
' <<<"$runs_json")"

deployment_machinery_changed() {
  local base_sha="$1"
  local paths

  if [[ -n "$changed_paths_file" ]]; then
    paths="$(cat "$changed_paths_file")"
  else
    paths="$(git diff --name-only "$base_sha" "$current_sha")"
  fi

  while IFS= read -r path; do
    case "$path" in
      .github/workflows/deploy-dev.yml|\
      .github/scripts/deploy-dev.sh|\
      .github/scripts/deploy-common.sh|\
      .github/scripts/resolve-dev-deploy-base.sh|\
      .github/scripts/*.sh)
        return 0
        ;;
    esac
  done <<<"$paths"

  return 1
}

if [[ "$last_successful_sha" =~ ^[0-9a-f]{40}$ ]] &&
  git merge-base --is-ancestor "$last_successful_sha" "$current_sha"; then
  printf 'found=true\n' >> "$output_file"
  printf 'base=%s\n' "$last_successful_sha" >> "$output_file"
  if [[ "$force_all_services" == 'true' ]] || deployment_machinery_changed "$last_successful_sha"; then
    printf 'force_all=true\n' >> "$output_file"
    printf 'Deployment machinery changed or manual force-all requested; rebuilding all services.\n'
  else
    printf 'force_all=false\n' >> "$output_file"
    printf 'Using last successful DEV deployment %s as cumulative baseline.\n' "$last_successful_sha"
  fi
else
  printf 'found=false\n' >> "$output_file"
  printf 'base=\n' >> "$output_file"
  printf 'force_all=true\n' >> "$output_file"
  printf 'No successful ancestor DEV deployment found; rebuilding all services.\n'
fi