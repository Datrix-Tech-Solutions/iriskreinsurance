#!/usr/bin/env bash

set -euo pipefail

log() {
  printf '%s\n' "$*"
}

section() {
  printf '\n── %s ────────────────────\n' "$1"
}

die() {
  printf '✗ %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "Required command not found: $1"
}

deployment_includes_service() {
  local service_name="$1"
  local compose_file="${COMPOSE_FILE:-}"

  [[ -n "$compose_file" && -f "$compose_file" ]] || return 1
  grep -Eq "^[[:space:]]{2}${service_name}:" "$compose_file"
}

bytes_to_gib() {
  awk -v bytes="$1" 'BEGIN { printf "%.1f GiB", bytes / 1024 / 1024 / 1024 }'
}

required_env_vars_for() {
  local deploy_env="$1"
  local -a required=(
    GHCR_TOKEN
    GHCR_USERNAME
    RABBITMQ_URL
    JWT_SECRET
    ALLOWED_ORIGINS
    AUTH_FRONTEND_BASE_URL
    AUTH_COOKIE_SECURE
    AUTH_COOKIE_SAME_SITE
    AUTH_GOOGLE_CLIENT_ID
    AUTH_GOOGLE_CLIENT_SECRET
    AUTH_GOOGLE_CALLBACK_URL
    AUTH_MICROSOFT_CLIENT_ID
    AUTH_MICROSOFT_CLIENT_SECRET
    AUTH_MICROSOFT_CALLBACK_URL
    NOTIFY_RESEND_API_KEY
    NOTIFY_RESEND_FROM_EMAIL
    SUPER_ADMIN_PASSWORD
    SUPER_ADMIN_EMAIL
    HR_FIELD_ENCRYPTION_KEY
    HR_FIELD_HMAC_KEY
    BUILD_SHA
    BUILD_REF
    IMAGE_PREFIX
    AUTH_TENANT_ASSET_STORAGE_PROVIDER
    AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS
    INTERNAL_SERVICE_AUTH_SECRET
    INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES
  )

  case "$deploy_env" in
  dev)
    required+=(DATABASE_URL)
    ;;
  prod)
    required+=(DATABASE_URL REDIS_PASSWORD)
    ;;
esac

  if deployment_includes_service "reinsurance-service"; then
    required+=(REINSURANCE_DOCUMENT_STORAGE_PROVIDER)
  fi

  printf '%s\n' "${required[@]}"
}

contains_any() {
  local value
  value="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  shift

  local token
  for token in "$@"; do
    if [[ "$value" == *"$(printf '%s' "$token" | tr '[:upper:]' '[:lower:]')"* ]]; then
      return 0
    fi
  done

  return 1
}

validate_optional_boolean() {
  local name="$1"
  local value="${!name:-}"

  [[ -z "$value" ]] && return 0

  case "$value" in
    true|false) ;;
    *)
      die "${name} must be 'true' or 'false' when set (got '${value}')"
      ;;
  esac
}

validate_optional_positive_int() {
  local name="$1"
  local value="${!name:-}"

  [[ -z "$value" ]] && return 0

  if [[ ! "$value" =~ ^[0-9]+$ || "$value" -lt 1 ]]; then
    die "${name} must be a positive integer when set"
  fi
}

validate_required_envs() {
  local deploy_env="$1"
  local -a missing=()
  local name

  while IFS= read -r name; do
    [[ -n "${!name:-}" ]] || missing+=("$name")
  done < <(required_env_vars_for "$deploy_env")

  if (( ${#missing[@]} > 0 )); then
    die "Missing required deployment variables for ${deploy_env}: ${missing[*]}"
  fi

  case "${AUTH_COOKIE_SECURE}" in
    true|false) ;;
    *)
      die "AUTH_COOKIE_SECURE must be 'true' or 'false' (got '${AUTH_COOKIE_SECURE}')"
      ;;
  esac

  case "${AUTH_COOKIE_SAME_SITE}" in
    lax|strict|none) ;;
    *)
      die "AUTH_COOKIE_SAME_SITE must be one of: lax, strict, none (got '${AUTH_COOKIE_SAME_SITE}')"
      ;;
  esac

  case "$(printf '%s' "${AUTH_TENANT_ASSET_STORAGE_PROVIDER}" | tr '[:upper:]' '[:lower:]')" in
    s3)
      for name in         AUTH_TENANT_ASSET_S3_BUCKET         AUTH_TENANT_ASSET_S3_REGION         AUTH_TENANT_ASSET_S3_PREFIX         AWS_ACCESS_KEY_ID         AWS_SECRET_ACCESS_KEY; do
        [[ -n "${!name:-}" ]] || missing+=("$name")
      done
      ;;
    cloudinary)
      for name in CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET; do
        [[ -n "${!name:-}" ]] || missing+=("$name")
      done
      ;;
    *)
      die "AUTH_TENANT_ASSET_STORAGE_PROVIDER must be one of: s3, cloudinary (got '${AUTH_TENANT_ASSET_STORAGE_PROVIDER}')"
      ;;
  esac

  if (( ${#missing[@]} > 0 )); then
    die "Missing required deployment variables for ${deploy_env}: ${missing[*]}"
  fi

  if deployment_includes_service "reinsurance-service"; then
    case "$(printf '%s' "${REINSURANCE_DOCUMENT_STORAGE_PROVIDER}" | tr '[:upper:]' '[:lower:]')" in
      cloudinary)
        local -a cloudinary_missing=()
        local name
        for name in CLOUDINARY_CLOUD_NAME CLOUDINARY_API_KEY CLOUDINARY_API_SECRET; do
          if [[ -z "${!name:-}" ]]; then
            cloudinary_missing+=("$name")
          fi
        done

        if (( ${#cloudinary_missing[@]} > 0 )); then
          die "Missing required Reinsurance Cloudinary variables for ${deploy_env}: ${cloudinary_missing[*]}"
        fi
        ;;
      s3)
        local -a s3_missing=()
        local name
        for name in REINSURANCE_DOCUMENT_S3_BUCKET REINSURANCE_DOCUMENT_S3_REGION; do
          if [[ -z "${!name:-}" ]]; then
            s3_missing+=("$name")
          fi
        done

        if (( ${#s3_missing[@]} > 0 )); then
          die "Missing required Reinsurance S3 variables for ${deploy_env}: ${s3_missing[*]}"
        fi

        validate_optional_boolean REINSURANCE_DOCUMENT_S3_FORCE_PATH_STYLE
        ;;
      *)
        die "Reinsurance document storage provider must be one of: s3, cloudinary (got '${REINSURANCE_DOCUMENT_STORAGE_PROVIDER}')"
        ;;
    esac

    validate_optional_positive_int REINSURANCE_DOCUMENT_SIGNED_URL_TTL_SECONDS
  fi

  validate_database_target "$deploy_env"
  validate_environment_boundaries "$deploy_env"
}

warn_optional_envs() {
  local -a optional=(
    NOTIFY_TERMII_API_KEY
    NOTIFY_TERMII_SENDER_ID
  )
  local name

  for name in "${optional[@]}"; do
    if [[ -z "${!name:-}" ]]; then
      log "⚠ Optional variable not set: ${name}"
    fi
  done
}

db_url_for_schema() {
  local schema="$1"
  if [[ "$DATABASE_URL" == *"?"* ]]; then
    printf '%s&schema=%s' "$DATABASE_URL" "$schema"
  else
    printf '%s?schema=%s' "$DATABASE_URL" "$schema"
  fi
}

ensure_deploy_dirs() {
  mkdir -p \
    "$DEPLOY_PATH/infrastructure" \
    "$DEPLOY_PATH/apps/api-gateway" \
    "$DEPLOY_PATH/apps/auth-service" \
    "$DEPLOY_PATH/apps/hr-service" \
    "$DEPLOY_PATH/apps/notification-service" \
    "$DEPLOY_PATH/apps/reinsurance-service"

  if [[ "${DEPLOY_ENV}" == "dev" ]]; then
    mkdir -p \
      "$DEPLOY_PATH/apps/subscription-service" \
      "$DEPLOY_PATH/apps/marketing-service" \
      "$DEPLOY_PATH/apps/accounting-service"
  fi
}

write_env_file() {
  local target="$1"
  shift
  local tmp_file
  tmp_file="$(mktemp "${target##*/}.XXXXXX")"

  for line in "$@"; do
    printf '%s\n' "$line" >> "$tmp_file"
  done

  chmod 600 "$tmp_file"
  mv "$tmp_file" "$target"
}

read_env_value() {
  local file="$1"
  local key="$2"

  [[ -f "$file" ]] || return 1

  local line
  line="$(grep -E "^${key}=" "$file" | tail -1 || true)"
  [[ -n "$line" ]] || return 1
  printf '%s\n' "${line#*=}"
}

service_changed() {
  local service_name="$1"
  local changed_services="${CHANGED_SERVICES:-}"

  [[ "$changed_services" == *"\"${service_name}\""* ]]
}

resolve_image_ref() {
  local existing_env_file="$1"
  local env_var_name="$2"
  local image_name="$3"
  local change_key="$4"
  local fallback_tag="$5"
  local existing_ref=""

  if existing_ref="$(read_env_value "$existing_env_file" "$env_var_name" 2>/dev/null)"; then
    :
  else
    existing_ref=""
  fi

  if service_changed "$change_key"; then
    printf '%s/%s:%s\n' "$IMAGE_PREFIX" "$image_name" "$BUILD_SHA"
  elif [[ -n "$existing_ref" ]]; then
    printf '%s\n' "$existing_ref"
  else
    printf '%s/%s:%s\n' "$IMAGE_PREFIX" "$image_name" "$fallback_tag"
  fi
}

docker_compose() {
  docker compose \
    --project-name "$COMPOSE_PROJECT_NAME" \
    --env-file "$COMPOSE_ENV_FILE" \
    -f "$COMPOSE_FILE" \
    "$@"
}

docker_compose_exec() {
  docker_compose exec -T "$@"
}

deploy_path_for_env() {
  local deploy_env="$1"

  case "$deploy_env" in
    dev)
      if [[ "${DEPLOY_ENV:-}" == "dev" && -n "${DEPLOY_PATH:-}" ]]; then
        printf '%s\n' "$DEPLOY_PATH"
      else
        printf '%s\n' "${WORKPHELO_DEV_DEPLOY_PATH:-/var/www/apps/dev.workphelo.datrixtechsolutions.com/work-phelo}"
      fi
      ;;
    prod)
      if [[ "${DEPLOY_ENV:-}" == "prod" && -n "${DEPLOY_PATH:-}" ]]; then
        printf '%s\n' "$DEPLOY_PATH"
      else
        printf '%s\n' "${WORKPHELO_PROD_DEPLOY_PATH:-/var/www/apps/workphelo.com/work-phelo}"
      fi
      ;;
    *)
      return 1
      ;;
  esac
}

compose_env_file_for_env() {
  local deploy_env="$1"
  printf '%s/.compose.%s.env\n' "$(deploy_path_for_env "$deploy_env")" "$deploy_env"
}

deploy_image_history_file_for_env() {
  local deploy_env="$1"
  printf '%s/.deploy-image-history.%s\n' "$(deploy_path_for_env "$deploy_env")" "$deploy_env"
}

service_name_from_image_env_key() {
  local key="$1"
  local service

  service="${key%_IMAGE}"
  service="$(printf '%s' "$service" | tr '[:upper:]_' '[:lower:]-')"

  case "$service" in
    nextjs)
      printf 'nextjs\n'
      ;;
    *)
      printf '%s\n' "$service"
      ;;
  esac
}

is_workphelo_image_ref() {
  local image_ref="$1"
  local image_prefix="${IMAGE_PREFIX:-ghcr.io/datrix-tech-solutions/work-phelo}"

  [[ "$image_ref" == "${image_prefix}/"* ]]
}

is_sha_tagged_workphelo_ref() {
  local image_ref="$1"
  local tag="${image_ref##*:}"

  is_workphelo_image_ref "$image_ref" && [[ "$tag" =~ ^[0-9a-f]{40}$ ]]
}

list_service_image_refs_from_env_file() {
  local env_file="$1"
  local key
  local image_ref

  [[ -f "$env_file" ]] || return 0

  while IFS='=' read -r key image_ref; do
    [[ "$key" == *_IMAGE ]] || continue
    [[ -n "${image_ref:-}" ]] || continue
    printf '%s\t%s\n' "$(service_name_from_image_env_key "$key")" "$image_ref"
  done <"$env_file"
}

validate_compose_render() {
  local tmp
  tmp="$(mktemp)"
  docker_compose config >"$tmp"
  [[ -s "$tmp" ]] || die "Docker Compose config rendered empty output"
  rm -f "$tmp"
  log "Docker Compose config validation passed"
}

root_disk_usage() {
  df -Pk / | awk 'NR == 2 { gsub(/%/, "", $5); printf "%.0f %s\n", $4 * 1024, $5 }'
}

report_root_disk_usage() {
  local label="${1:-Root Disk Usage}"
  local available_bytes
  local used_percent
  local warning_percent="${DEPLOY_DISK_WARNING_PERCENT:-85}"
  local critical_percent="${DEPLOY_DISK_CRITICAL_PERCENT:-90}"
  local status="healthy"

  read -r available_bytes used_percent < <(root_disk_usage)

  if (( used_percent >= critical_percent )); then
    status="critical"
  elif (( used_percent >= warning_percent )); then
    status="warning"
  fi

  section "$label"
  log "Root filesystem: ${used_percent}% used, $(bytes_to_gib "$available_bytes") available (${status})"
}

assert_root_disk_not_critical() {
  local available_bytes
  local used_percent
  local critical_percent="${DEPLOY_DISK_CRITICAL_PERCENT:-90}"

  read -r available_bytes used_percent < <(root_disk_usage)

  if (( used_percent >= critical_percent )); then
    die "Root filesystem remains critical after deployment cleanup: ${used_percent}% used, $(bytes_to_gib "$available_bytes") available"
  fi
}

preflight_runtime_env() {
  local image_ref="$1"
  local env_file="$2"
  local validation_script="$3"
  local label="$4"

  log "  • ${label}"
  docker run \
    --rm \
    --network none \
    --env-file "$env_file" \
    "$image_ref" \
    node "$validation_script"
}

collect_container_image_ids() {
  local container_id

  docker ps -aq | while IFS= read -r container_id; do
    [[ -n "$container_id" ]] || continue
    docker inspect --format='{{.Image}}' "$container_id" 2>/dev/null || true
  done | sort -u
}

collect_current_compose_image_refs() {
  local deploy_env

  for deploy_env in dev prod; do
    list_service_image_refs_from_env_file "$(compose_env_file_for_env "$deploy_env")" |
      awk -F '\t' '{ print $2 }'
  done | sort -u
}

collect_deploy_history_image_refs() {
  local deploy_env
  local history_file

  for deploy_env in dev prod; do
    history_file="$(deploy_image_history_file_for_env "$deploy_env")"
    [[ -f "$history_file" ]] || continue
    sort -r "$history_file" | awk -F '\t' '
      NF >= 3 {
        service = $2
        image = $3
        key = service SUBSEP image
        if (seen[key]++) next
        if (++count[service] <= 3) print image
      }
    '
  done | sort -u
}

collect_retained_workphelo_image_ids() {
  local image_ref

  {
    collect_current_compose_image_refs
    collect_deploy_history_image_refs
  } | sort -u | while IFS= read -r image_ref; do
    [[ -n "$image_ref" ]] || continue
    is_workphelo_image_ref "$image_ref" || continue
    docker image inspect --format='{{.Id}}' "$image_ref" 2>/dev/null || true
  done | sort -u
}

collect_protected_workphelo_image_ids() {
  {
    collect_container_image_ids
    collect_retained_workphelo_image_ids
  } | sort -u
}

list_workphelo_image_tags() {
  local image_prefix="${IMAGE_PREFIX:-ghcr.io/datrix-tech-solutions/work-phelo}"
  local repository
  local tag
  local image_id
  local created

  docker image ls --format '{{.Repository}}|{{.Tag}}' | while IFS='|' read -r repository tag; do
    [[ "$repository" == "${image_prefix}/"* ]] || continue
    [[ -n "$tag" && "$tag" != "<none>" ]] || continue

    image_id="$(docker image inspect --format='{{.Id}}' "${repository}:${tag}" 2>/dev/null || true)"
    created="$(docker image inspect --format='{{.Created}}' "${repository}:${tag}" 2>/dev/null || true)"
    [[ -n "$image_id" && -n "$created" ]] || continue

    printf '%s|%s|%s|%s\n' "$repository" "$tag" "$image_id" "$created"
  done
}

record_successful_deploy_images() {
  local deploy_env="${DEPLOY_ENV:-}"
  local compose_env_file="${COMPOSE_ENV_FILE:-}"
  local timestamp
  local history_file
  local history_dir
  local new_entries
  local combined
  local bounded
  local tmp_file

  [[ "$deploy_env" == "dev" || "$deploy_env" == "prod" ]] ||
    die "Cannot record deployment image history for DEPLOY_ENV='${deploy_env}'"
  [[ -f "$compose_env_file" ]] ||
    die "Cannot record deployment image history; compose env file missing: ${compose_env_file}"

  timestamp="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  history_file="$(deploy_image_history_file_for_env "$deploy_env")"
  history_dir="$(dirname "$history_file")"
  mkdir -p "$history_dir"

  new_entries="$(mktemp)"
  combined="$(mktemp)"
  bounded="$(mktemp)"
  tmp_file="$(mktemp "${history_file}.XXXXXX")"

  while IFS=$'\t' read -r service image_ref; do
    [[ -n "${service:-}" && -n "${image_ref:-}" ]] || continue
    is_sha_tagged_workphelo_ref "$image_ref" || continue
    printf '%s\t%s\t%s\n' "$timestamp" "$service" "$image_ref"
  done < <(list_service_image_refs_from_env_file "$compose_env_file") >"$new_entries"

  if [[ -f "$history_file" ]]; then
    cat "$history_file" "$new_entries" >"$combined"
  else
    cat "$new_entries" >"$combined"
  fi

  sort -r "$combined" | awk -F '\t' '
    NF >= 3 {
      service = $2
      image = $3
      key = service SUBSEP image
      if (seen[key]++) next
      if (++count[service] <= 3) print
    }
  ' >"$bounded"

  cat "$bounded" >"$tmp_file"
  chmod 600 "$tmp_file"
  mv "$tmp_file" "$history_file"
  rm -f "$new_entries" "$combined" "$bounded"

  log "✓ Recorded ${deploy_env} image history at ${history_file}"
}

cleanup_stale_workphelo_images() {
  local protected_ids
  local image_tags
  protected_ids="$(mktemp)"
  image_tags="$(mktemp)"

  collect_protected_workphelo_image_ids >"$protected_ids"
  list_workphelo_image_tags >"$image_tags"

  if [[ ! -s "$image_tags" ]]; then
    rm -f "$protected_ids" "$image_tags"
    log "No WorkPhelo GHCR images found for retention cleanup"
    return 0
  fi

  local deleted=0
  local repository

  while IFS= read -r repository; do
    while IFS='|' read -r _repo tag image_id _created; do
      [[ "$tag" =~ ^[0-9a-f]{40}$ ]] || continue

      if grep -Fxq "$image_id" "$protected_ids"; then
        continue
      fi

      if docker image rm "${repository}:${tag}" >/dev/null 2>&1; then
        deleted=$((deleted + 1))
        log "  • removed stale unused image ${repository}:${tag}"
      else
        log "  ⚠ could not remove stale unused image ${repository}:${tag}"
      fi
    done < <(grep -F "${repository}|" "$image_tags" | sort -t '|' -k4,4r)
  done < <(cut -d '|' -f1 "$image_tags" | sort -u)

  rm -f "$protected_ids" "$image_tags"
  log "WorkPhelo image retention complete; removed ${deleted} stale unused SHA-tagged image(s)"
}

post_deploy_capacity_maintenance() {
  report_root_disk_usage "Post-Deploy Disk Usage"

  section "Post-Deploy Image Retention"
  if cleanup_stale_workphelo_images; then
    log "✓ WorkPhelo image cleanup completed"
  else
    log "⚠ WorkPhelo image cleanup failed; continuing unless disk is critical"
  fi

  report_root_disk_usage "Post-Cleanup Disk Usage"
  assert_root_disk_not_critical
}

ensure_image_available() {
  local image_ref="$1"
  local change_key="$2"
  local label="$3"

  if service_changed "$change_key" || ! docker image inspect "$image_ref" >/dev/null 2>&1; then
    log "  • pulling ${label}: ${image_ref}"
    docker pull "$image_ref"
  else
    log "  • reusing local ${label}: ${image_ref}"
  fi
}

wait_for_container_health() {
  local service_name="$1"
  local timeout_seconds="${2:-120}"
  local poll_interval=5
  local elapsed=0
  local container_id

  container_id="$(docker_compose ps -q "$service_name" | head -1)"
  [[ -n "$container_id" ]] || die "${service_name}: container not found"

  while (( elapsed < timeout_seconds )); do
    local status
    local health
    status="$(docker inspect --format='{{.State.Status}}' "$container_id" 2>/dev/null || printf 'unknown')"
    health="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || printf 'none')"

    if [[ "$status" == "running" && ( "$health" == "healthy" || "$health" == "none" ) ]]; then
      log "  ✓ ${service_name} container healthy"
      return 0
    fi

    if [[ "$status" == "exited" || "$status" == "dead" || "$health" == "unhealthy" ]]; then
      print_service_diagnostics "$service_name" "$container_id"
      die "${service_name}: container status=${status} health=${health}"
    fi

    sleep "$poll_interval"
    elapsed=$((elapsed + poll_interval))
    log "  … ${service_name} container status=${status} health=${health} (${elapsed}s/${timeout_seconds}s)"
  done

  print_service_diagnostics "$service_name" "$container_id"
  die "${service_name}: timed out waiting for container health"
}

http_get_ok() {
  local url="$1"

  if command -v curl >/dev/null 2>&1; then
    curl -fsSL --max-time 10 "$url" >/dev/null
    return 0
  fi

  if command -v wget >/dev/null 2>&1; then
    wget -qO- --timeout=10 "$url" >/dev/null
    return 0
  fi

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$url" <<'PY'
import sys
import urllib.request

with urllib.request.urlopen(sys.argv[1], timeout=10) as response:
    if response.status >= 400:
        raise SystemExit(1)
PY
    return 0
  fi

  die "Need one of curl, wget, or python3 to perform HTTP reachability checks"
}

wait_for_http_ok() {
  local label="$1"
  local url="$2"
  local timeout_seconds="${3:-120}"
  local poll_interval=5
  local elapsed=0

  while (( elapsed < timeout_seconds )); do
    if http_get_ok "$url"; then
      log "  ✓ ${label} reachable at ${url}"
      return 0
    fi

    sleep "$poll_interval"
    elapsed=$((elapsed + poll_interval))
    log "  … ${label} not reachable yet (${elapsed}s/${timeout_seconds}s): ${url}"
  done

  die "${label}: timed out waiting for ${url}"
}

print_service_logs() {
  local service_name="$1"
  log ""
  log "Recent logs for ${service_name}:"
  docker_compose logs --no-color --tail 120 "$service_name" || true
}

print_service_health_inspect() {
  local container_id="$1"

  log ""
  log "Health inspection for ${container_id}:"
  docker inspect \
    --format='Container={{.Name}} Status={{.State.Status}} Health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} StartedAt={{.State.StartedAt}} FinishedAt={{.State.FinishedAt}} ExitCode={{.State.ExitCode}} Error={{.State.Error}}' \
    "$container_id" || true

  log ""
  log "Healthcheck log entries for ${container_id}:"
  docker inspect \
    --format='{{if .State.Health}}{{range .State.Health.Log}}- Start={{.Start}} End={{.End}} ExitCode={{.ExitCode}} Output={{printf "%q" .Output}}{{println}}{{end}}{{else}}No Docker healthcheck log available.{{end}}' \
    "$container_id" || true
}

print_service_diagnostics() {
  local service_name="$1"
  local container_id="$2"

  log ""
  log "Compose service status:"
  docker_compose ps || true

  print_service_logs "$service_name"

  if [[ -n "$container_id" ]]; then
    print_service_health_inspect "$container_id"
  else
    log ""
    log "No container id found for ${service_name}; skipping health inspection."
  fi
}

print_compose_failure_diagnostics() {
  local inspected=0

  log ""
  log "Compose service status:"
  docker_compose ps || true

  local service_name
  while IFS= read -r service_name; do
    [[ -n "$service_name" ]] || continue

    local container_id
    container_id="$(docker_compose ps -q "$service_name" | head -1 || true)"
    [[ -n "$container_id" ]] || continue

    local status
    local health
    status="$(docker inspect --format='{{.State.Status}}' "$container_id" 2>/dev/null || printf 'unknown')"
    health="$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$container_id" 2>/dev/null || printf 'none')"

    if [[ "$status" == "running" && ( "$health" == "healthy" || "$health" == "none" ) ]]; then
      continue
    fi

    inspected=$((inspected + 1))
    print_service_logs "$service_name"
    print_service_health_inspect "$container_id"
  done < <(docker_compose config --services 2>/dev/null || true)

  if (( inspected == 0 )); then
    log ""
    log "No non-ready service containers were available for health inspection."
  fi
}

validate_database_target() {
  local deploy_env="$1"
  local db_url="${DATABASE_URL:-}"

  [[ -n "$db_url" ]] || die "DATABASE_URL is required"

  case "$deploy_env" in
    prod)
      [[ "$db_url" != *"dev"* ]] || die "Prod deployment must not use dev database URL"
      [[ "$db_url" != *"staging"* ]] || die "Prod deployment must not use staging database URL"
      ;;
    dev)
      [[ "$db_url" != *"prod"* ]] || die "Dev deployment must not use prod database URL"
      [[ "$db_url" != *"production"* ]] || die "Dev deployment must not use production database URL"
      ;;
  esac
}

validate_environment_boundaries() {
  local deploy_env="$1"
  local frontend_url="${AUTH_FRONTEND_BASE_URL:-}"
  local allowed_origins="${ALLOWED_ORIGINS:-}"
  local rabbitmq_url="${RABBITMQ_URL:-}"

  case "$deploy_env" in
  prod)
    [[ "${AUTH_COOKIE_SECURE}" == "true" ]] ||
      die "Production deployments require AUTH_COOKIE_SECURE=true"

    if contains_any "$frontend_url" "localhost" "127.0.0.1" "dev.workphelo" "staging"; then
      die "Production AUTH_FRONTEND_BASE_URL appears to point at a non-production host"
    fi

    if contains_any "$allowed_origins" "localhost" "127.0.0.1" "dev.workphelo" "staging"; then
      die "Production ALLOWED_ORIGINS contains local/dev/staging origins"
    fi

    if contains_any "$rabbitmq_url" "localhost" "127.0.0.1" "workphelo-dev"; then
      die "Production RABBITMQ_URL appears to point at a local/dev broker"
    fi
    ;;
  dev)
    if contains_any "$frontend_url" "https://workphelo.com"; then
      die "Dev AUTH_FRONTEND_BASE_URL appears to point at production"
    fi

    if contains_any "$allowed_origins" "https://workphelo.com"; then
      die "Dev ALLOWED_ORIGINS contains the production origin"
    fi
    ;;
  *)
    die "Unknown DEPLOY_ENV '${deploy_env}'. Expected dev or prod."
    ;;
  esac
}
