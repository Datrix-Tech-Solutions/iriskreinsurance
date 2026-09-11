#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
resolver="$repo_root/.github/scripts/resolve-dev-deploy-base.sh"
helper="$repo_root/.github/scripts/deploy-common.sh"
current_sha="$(git -C "$repo_root" rev-parse HEAD)"

assert_eq() {
  local expected="$1"
  local actual="$2"
  local message="$3"
  [[ "$expected" == "$actual" ]] || {
    printf 'FAIL: %s\nexpected: %s\nactual: %s\n' "$message" "$expected" "$actual" >&2
    exit 1
  }
}

service_matches_path() {
  local service="$1"
  local path="$2"

  case "$service" in
    nextjs-web)
      [[ "$path" == apps/web/work-phelo-web/* ]]
      ;;
    *)
      [[ "$path" == apps/${service}/* || "$path" == packages/* || "$path" == package.json || "$path" == package-lock.json || "$path" == tsconfig.* || "$path" == tsconfig*.json ]]
      ;;
  esac
}

assert_service_set() {
  local expected="$1"
  shift
  local paths=("$@")
  local service
  local actual=()
  local services=(
    api-gateway auth-service hr-service notification-service subscription-service
    marketing-service reinsurance-service accounting-service nextjs-web
  )

  for service in "${services[@]}"; do
    for path in "${paths[@]}"; do
      if service_matches_path "$service" "$path"; then
        actual+=("$service")
        break
      fi
    done
  done

  assert_eq "$expected" "$(IFS=,; echo "${actual[*]}")" "path filters for ${paths[*]}"
}

run_resolver() {
  local runs_json="$1"
  local output_file
  output_file="$(mktemp)"
  GITHUB_SHA="$current_sha" \
    GITHUB_REPOSITORY=datrix-tech-solutions/iriskreinsurance \
    GITHUB_OUTPUT="$output_file" \
    bash "$resolver" "$runs_json" >/dev/null
  cat "$output_file"
  rm -f "$output_file"
}

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT

successful_base="$(git -C "$repo_root" rev-parse HEAD~1)"
cat > "$tmp_dir/runs.json" <<EOF
{"workflow_runs":[
  {"head_sha":"$successful_base","conclusion":"success","created_at":"2026-09-10T10:00:00Z"},
  {"head_sha":"$current_sha","conclusion":"success","created_at":"2026-09-11T10:00:00Z"}
]}
EOF
resolver_output="$(run_resolver "$tmp_dir/runs.json")"
assert_eq 'found=true' "$(printf '%s\n' "$resolver_output" | grep '^found=')" 'normal run uses the previous successful deployment'
assert_eq "base=$successful_base" "$(printf '%s\n' "$resolver_output" | grep '^base=')" 'normal baseline SHA'

cat > "$tmp_dir/failed-retry.json" <<EOF
{"workflow_runs":[{"head_sha":"$successful_base","conclusion":"success","created_at":"2026-09-10T10:00:00Z"}]}
EOF
retry_output="$(run_resolver "$tmp_dir/failed-retry.json")"
assert_eq 'found=true' "$(printf '%s\n' "$retry_output" | grep '^found=')" 'retry still uses the last successful deployment'

cat > "$tmp_dir/no-success.json" <<'EOF'
{"workflow_runs":[]}
EOF
fallback_output="$(run_resolver "$tmp_dir/no-success.json")"
assert_eq 'found=false' "$(printf '%s\n' "$fallback_output" | grep '^found=')" 'no prior deployment uses conservative fallback'

assert_service_set 'auth-service' 'apps/auth-service/src/auth/auth.service.ts'
assert_service_set 'api-gateway,auth-service,hr-service,notification-service,subscription-service,marketing-service,reinsurance-service,accounting-service' 'packages/types/src/events.ts'
assert_service_set 'auth-service,hr-service' 'apps/hr-service/src/employees/employees.service.ts' 'apps/auth-service/test/unit/auth.password-flows.spec.ts'

source "$helper"
IMAGE_PREFIX=ghcr.io/datrix-tech-solutions/iriskreinsurance
BUILD_SHA=0123456789012345678901234567890123456789
compose_env="$tmp_dir/.compose.dev.env"
printf '%s\n' 'HR_SERVICE_IMAGE=ghcr.io/datrix-tech-solutions/iriskreinsurance/hr-service:oldsha' > "$compose_env"
CHANGED_SERVICES='["auth-service"]'
assert_eq \
  'ghcr.io/datrix-tech-solutions/iriskreinsurance/hr-service:oldsha' \
  "$(resolve_image_ref "$compose_env" HR_SERVICE_IMAGE hr-service hr-service dev)" \
  'unchanged HR preserves its image'
CHANGED_SERVICES='["auth-service","hr-service"]'
assert_eq \
  'ghcr.io/datrix-tech-solutions/iriskreinsurance/hr-service:0123456789012345678901234567890123456789' \
  "$(resolve_image_ref "$compose_env" HR_SERVICE_IMAGE hr-service hr-service dev)" \
  'cumulatively changed HR uses the current build SHA'

printf 'PASS: cumulative DEV deployment change detection\n'