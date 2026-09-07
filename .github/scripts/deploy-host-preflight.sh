#!/usr/bin/env bash

set -euo pipefail

log() {
  printf '%s\n' "$*"
}

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || die "required command not found: $1"
}

bytes_to_gib() {
  awk -v bytes="$1" 'BEGIN { printf "%.1f GiB", bytes / 1024 / 1024 / 1024 }'
}

check_root_disk_space() {
  local min_free_gib="${DEPLOY_MIN_FREE_GIB:-15}"
  local min_free_bytes=$((min_free_gib * 1024 * 1024 * 1024))
  local available_kib
  local used_percent

  read -r available_kib used_percent < <(df -Pk / | awk 'NR == 2 { gsub(/%/, "", $5); print $4, $5 }')
  [[ -n "${available_kib:-}" && -n "${used_percent:-}" ]] ||
    die "could not read root filesystem usage"

  local available_bytes=$((available_kib * 1024))
  if (( available_bytes < min_free_bytes )); then
    die "insufficient disk space: $(bytes_to_gib "$available_bytes") free; $(bytes_to_gib "$min_free_bytes") required; root filesystem ${used_percent}% used"
  fi

  log "OK: root disk has $(bytes_to_gib "$available_bytes") free; minimum $(bytes_to_gib "$min_free_bytes"); ${used_percent}% used"
}

check_docker() {
  require_command docker
  docker info >/dev/null 2>&1 || die "docker daemon is not responding"
  docker compose version >/dev/null 2>&1 || die "docker compose plugin is not available"
  log "OK: Docker daemon and compose plugin are available"
}

check_deploy_target() {
  local deploy_path="${DEPLOY_PATH:-}"
  [[ -n "$deploy_path" ]] || die "DEPLOY_PATH is required"
  [[ "$deploy_path" = /* ]] || die "DEPLOY_PATH must be absolute"

  local target="$deploy_path"
  if [[ ! -d "$target" ]]; then
    target="$(dirname "$deploy_path")"
    [[ -d "$target" ]] || die "deploy target does not exist and parent is missing: $deploy_path"
  fi

  [[ -w "$target" ]] || die "deploy target is not writable: $target"

  local probe="${target}/.workphelo-preflight-${DEPLOY_ENV:-unknown}-$$"
  : >"$probe" || die "could not write probe file in deploy target: $target"
  rm -f "$probe" || die "could not remove probe file from deploy target: $target"
  log "OK: deploy target is writable: $target"
}

check_host_utilities() {
  require_command df
  require_command awk
  require_command tar
  log "OK: required host utilities are available"
}

main() {
  log "WorkPhelo deployment host preflight (${DEPLOY_ENV:-unknown})"
  check_host_utilities
  check_root_disk_space
  check_docker
  check_deploy_target
  log "OK: deployment host preflight passed"
}

main "$@"
