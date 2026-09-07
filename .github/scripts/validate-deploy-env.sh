#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 <dev|prod>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=.github/scripts/deploy-common.sh
source "${SCRIPT_DIR}/deploy-common.sh"

DEPLOY_ENV="$1"

if [[ "$1" == "dev" && -z "${DATABASE_URL:-}" && -n "${DEV_DATABASE_URL:-}" ]]; then
export DATABASE_URL="$DEV_DATABASE_URL"
fi

validate_required_envs "$DEPLOY_ENV"
warn_optional_envs

echo "✓ ${DEPLOY_ENV} deployment variables validated"
