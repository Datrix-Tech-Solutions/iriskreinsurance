#!/usr/bin/env bash

set -euo pipefail

current_sha="${GITHUB_SHA:?GITHUB_SHA is required}"
api_url="${GITHUB_API_URL:-https://api.github.com}"
repository="${GITHUB_REPOSITORY:?GITHUB_REPOSITORY is required}"
output_file="${GITHUB_OUTPUT:?GITHUB_OUTPUT is required}"

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

if [[ "$last_successful_sha" =~ ^[0-9a-f]{40}$ ]] &&
  git merge-base --is-ancestor "$last_successful_sha" "$current_sha"; then
  printf 'found=true\n' >> "$output_file"
  printf 'base=%s\n' "$last_successful_sha" >> "$output_file"
  printf 'Using last successful DEV deployment %s as cumulative baseline.\n' "$last_successful_sha"
else
  printf 'found=false\n' >> "$output_file"
  printf 'base=\n' >> "$output_file"
  printf 'No successful ancestor DEV deployment found; rebuilding all services.\n'
fi