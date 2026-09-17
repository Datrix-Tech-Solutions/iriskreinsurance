#!/usr/bin/env bash

set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
resolver="$repo_root/.github/scripts/resolve-dev-deploy-base.sh"
all_services_output="$repo_root/.github/scripts/emit-dev-all-service-outputs.sh"
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
      [[ "$path" == apps/web/work-phelo-rein-web/* ]]
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
  local changed_paths_file="${2:-}"
  local force_all="${3:-false}"
  local output_file
  output_file="$(mktemp)"
  GITHUB_SHA="$current_sha" \
    GITHUB_REPOSITORY=datrix-tech-solutions/iriskreinsurance \
    GITHUB_OUTPUT="$output_file" \
    FORCE_ALL_SERVICES="$force_all" \
    bash "$resolver" "$runs_json" "$changed_paths_file" >/dev/null
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
assert_eq 'force_all=true' "$(printf '%s\n' "$resolver_output" | grep '^force_all=')" 'deployment machinery commit requires bootstrap reconciliation'

printf '%s\n' 'apps/auth-service/src/auth/auth.service.ts' > "$tmp_dir/app-paths"
ordinary_output="$(run_resolver "$tmp_dir/runs.json" "$tmp_dir/app-paths")"
assert_eq 'force_all=false' "$(printf '%s\n' "$ordinary_output" | grep '^force_all=')" 'ordinary application change keeps cumulative detection'

for machinery_path in \
  .github/workflows/deploy-dev.yml \
  .github/scripts/resolve-dev-deploy-base.sh \
  .github/scripts/deploy-dev.sh \
  .github/scripts/deploy-common.sh; do
  printf '%s\n' "$machinery_path" > "$tmp_dir/machinery-paths"
  machinery_output="$(run_resolver "$tmp_dir/runs.json" "$tmp_dir/machinery-paths")"
  assert_eq 'force_all=true' "$(printf '%s\n' "$machinery_output" | grep '^force_all=')" "deployment machinery path $machinery_path forces all services"
done

force_output="$(run_resolver "$tmp_dir/runs.json" "$tmp_dir/app-paths" true)"
assert_eq 'force_all=true' "$(printf '%s\n' "$force_output" | grep '^force_all=')" 'manual force-all requests all services'

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
assert_eq 'force_all=true' "$(printf '%s\n' "$fallback_output" | grep '^force_all=')" 'no prior deployment forces all services'

all_services_file="$tmp_dir/all-services-output"
bash "$all_services_output" "$all_services_file"
for service in \
  api-gateway auth-service hr-service notification-service subscription-service \
  marketing-service reinsurance-service accounting-service nextjs-web; do
  assert_eq "${service}=true" "$(grep "^${service}=" "$all_services_file")" "force-all output for ${service}"
done

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