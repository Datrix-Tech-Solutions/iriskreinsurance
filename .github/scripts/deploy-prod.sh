#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ENV="prod"
DEPLOY_PATH="/srv/iriskre-prod"
COMPOSE_FILE="${DEPLOY_PATH}/infrastructure/docker-compose.prod.yml"
COMPOSE_ENV_FILE="${DEPLOY_PATH}/.compose.prod.env"
COMPOSE_PROJECT_NAME="iriskre-prod"
HELPER_FILE="${DEPLOY_PATH}/.github/scripts/deploy-common.sh"

[[ -f "$HELPER_FILE" ]] || {
  echo "✗ Missing deploy helper at ${HELPER_FILE}. Upload step did not complete." >&2
  exit 1
}

# shellcheck source=/dev/null
source "$HELPER_FILE"

section "iRisk Reinsurance Production Deployment"
log "SHA: ${BUILD_SHA:-unknown}"
log "Ref: ${BUILD_REF:-unknown}"
log "Time: $(date -u +%Y-%m-%dT%H:%M:%SZ)"

require_command docker

validate_required_envs "$DEPLOY_ENV"
warn_optional_envs
ensure_deploy_dirs

API_GATEWAY_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "API_GATEWAY_IMAGE" "api-gateway" "api-gateway" "prod")"
AUTH_SERVICE_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "AUTH_SERVICE_IMAGE" "auth-service" "auth-service" "prod")"
HR_SERVICE_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "HR_SERVICE_IMAGE" "hr-service" "hr-service" "prod")"
NOTIFICATION_SERVICE_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "NOTIFICATION_SERVICE_IMAGE" "notification-service" "notification-service" "prod")"
SUBSCRIPTION_SERVICE_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "SUBSCRIPTION_SERVICE_IMAGE" "subscription-service" "subscription-service" "prod")"
MARKETING_SERVICE_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "MARKETING_SERVICE_IMAGE" "marketing-service" "marketing-service" "prod")"
REINSURANCE_SERVICE_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "REINSURANCE_SERVICE_IMAGE" "reinsurance-service" "reinsurance-service" "prod")"
ACCOUNTING_SERVICE_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "ACCOUNTING_SERVICE_IMAGE" "accounting-service" "accounting-service" "prod")"
NEXTJS_IMAGE="$(resolve_image_ref "$COMPOSE_ENV_FILE" "NEXTJS_IMAGE" "nextjs-web" "nextjs-web" "prod")"

section "Compose Env"
write_env_file "$COMPOSE_ENV_FILE" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME}" \
  "IMAGE_PREFIX=${IMAGE_PREFIX}" \
  "REDIS_PASSWORD=${REDIS_PASSWORD}" \
  "API_GATEWAY_IMAGE=${API_GATEWAY_IMAGE}" \
  "AUTH_SERVICE_IMAGE=${AUTH_SERVICE_IMAGE}" \
  "HR_SERVICE_IMAGE=${HR_SERVICE_IMAGE}" \
  "NOTIFICATION_SERVICE_IMAGE=${NOTIFICATION_SERVICE_IMAGE}" \
  "SUBSCRIPTION_SERVICE_IMAGE=${SUBSCRIPTION_SERVICE_IMAGE}" \
  "MARKETING_SERVICE_IMAGE=${MARKETING_SERVICE_IMAGE}" \
  "REINSURANCE_SERVICE_IMAGE=${REINSURANCE_SERVICE_IMAGE}" \
  "ACCOUNTING_SERVICE_IMAGE=${ACCOUNTING_SERVICE_IMAGE}" \
  "NEXTJS_IMAGE=${NEXTJS_IMAGE}" \
  "WEB_PUBLIC_API_URL=${WEB_PUBLIC_API_URL:-https://api.iriskreinsurance.com/api/v1}" \
  "WEB_PUBLIC_APP_BASE_URL=${WEB_PUBLIC_APP_BASE_URL:-https://iriskreinsurance.com}"
log "✓ ${COMPOSE_ENV_FILE}"

section "Service Env Files"
write_env_file "${DEPLOY_PATH}/apps/api-gateway/.env.prod" \
  "PORT=4000" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "ENABLE_SWAGGER=false" \
  "JWT_SECRET=${JWT_SECRET}" \
  "ALLOWED_ORIGINS=${ALLOWED_ORIGINS}" \
  "AUTH_SERVICE_URL=http://auth-service:4001" \
  "HR_SERVICE_URL=http://hr-service:4002" \
  "NOTIFICATION_SERVICE_URL=http://notification-service:4004" \
  "SUBSCRIPTION_SERVICE_URL=http://subscription-service:4005" \
  "MARKETING_SERVICE_URL=http://marketing-service:4006" \
  "REINSURANCE_SERVICE_URL=http://reinsurance-service:4007" \
  "ACCOUNTING_SERVICE_URL=http://accounting-service:4008"

write_env_file "${DEPLOY_PATH}/apps/auth-service/.env.prod" \
  "PORT=4001" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "ENABLE_SWAGGER=false" \
  "DATABASE_URL=$(db_url_for_schema w_auth)" \
  "RABBITMQ_URL=${RABBITMQ_URL}" \
  "JWT_SECRET=${JWT_SECRET}" \
  "ALLOWED_ORIGINS=${ALLOWED_ORIGINS}" \
  "FRONTEND_BASE_URL=${AUTH_FRONTEND_BASE_URL}" \
  "APP_URL=${AUTH_FRONTEND_BASE_URL}" \
  "FRONTEND_URL=${AUTH_FRONTEND_BASE_URL}" \
  "COOKIE_SECURE=${AUTH_COOKIE_SECURE}" \
  "COOKIE_SAME_SITE=${AUTH_COOKIE_SAME_SITE}" \
  "COOKIE_DOMAIN=${AUTH_COOKIE_DOMAIN}" \
  "GOOGLE_CLIENT_ID=${AUTH_GOOGLE_CLIENT_ID}" \
  "GOOGLE_CLIENT_SECRET=${AUTH_GOOGLE_CLIENT_SECRET}" \
  "GOOGLE_CALLBACK_URL=${AUTH_GOOGLE_CALLBACK_URL}" \
  "MICROSOFT_CLIENT_ID=${AUTH_MICROSOFT_CLIENT_ID}" \
  "MICROSOFT_CLIENT_SECRET=${AUTH_MICROSOFT_CLIENT_SECRET}" \
  "MICROSOFT_CALLBACK_URL=${AUTH_MICROSOFT_CALLBACK_URL}" \
  "SUPER_ADMIN_EMAIL=${SUPER_ADMIN_EMAIL}" \
  "AUTH_TENANT_ASSET_STORAGE_PROVIDER=${AUTH_TENANT_ASSET_STORAGE_PROVIDER}" \
  "AUTH_TENANT_ASSET_S3_BUCKET=${AUTH_TENANT_ASSET_S3_BUCKET:-}" \
  "AUTH_TENANT_ASSET_S3_REGION=${AUTH_TENANT_ASSET_S3_REGION:-}" \
  "AUTH_TENANT_ASSET_S3_PREFIX=${AUTH_TENANT_ASSET_S3_PREFIX:-}" \
  "AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS=${AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS}" \
  "AUTH_TENANT_ASSET_CLOUDINARY_ROOT_FOLDER=${AUTH_TENANT_ASSET_CLOUDINARY_ROOT_FOLDER:-}" \
  "CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME:-}" \
  "CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY:-}" \
  "CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET:-}" \
  "AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID:-}" \
  "AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY:-}" \
  "INTERNAL_SERVICE_AUTH_SECRET=${INTERNAL_SERVICE_AUTH_SECRET}" \
  "INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES=${INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES}"

write_env_file "${DEPLOY_PATH}/apps/hr-service/.env.prod" \
  "PORT=4002" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "ENABLE_SWAGGER=false" \
  "DATABASE_URL=$(db_url_for_schema hr)" \
  "RABBITMQ_URL=${RABBITMQ_URL}" \
  "REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379" \
  "JWT_SECRET=${JWT_SECRET}" \
  "ALLOWED_ORIGINS=${ALLOWED_ORIGINS}" \
  "FRONTEND_BASE_URL=${AUTH_FRONTEND_BASE_URL}" \
  "FIELD_ENCRYPTION_KEY=${HR_FIELD_ENCRYPTION_KEY}" \
  "FIELD_HMAC_KEY=${HR_FIELD_HMAC_KEY}"

write_env_file "${DEPLOY_PATH}/apps/notification-service/.env.prod" \
  "PORT=4004" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "ENABLE_SWAGGER=false" \
  "DATABASE_URL=$(db_url_for_schema notify)" \
  "RABBITMQ_URL=${RABBITMQ_URL}" \
  "JWT_SECRET=${JWT_SECRET}" \
  "FRONTEND_BASE_URL=${AUTH_FRONTEND_BASE_URL}" \
  "RESEND_API_KEY=${NOTIFY_RESEND_API_KEY}" \
  "RESEND_FROM_EMAIL=${NOTIFY_RESEND_FROM_EMAIL}" \
  "SMS_PROVIDER=${NOTIFY_SMS_PROVIDER:-termii}" \
  "TERMII_API_KEY=${NOTIFY_TERMII_API_KEY:-}" \
  "TERMII_SENDER_ID=${NOTIFY_TERMII_SENDER_ID:-iRisk}" \
  "PILOSMS_API_KEY=${NOTIFY_PILOSMS_API_KEY:-}" \
  "PILOSMS_SENDER_ID=${NOTIFY_PILOSMS_SENDER_ID:-iRisk}"

write_env_file "${DEPLOY_PATH}/apps/subscription-service/.env.prod" \
  "PORT=4005" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "ENABLE_SWAGGER=false" \
  "DATABASE_URL=${DATABASE_URL}" \
  "RABBITMQ_URL=${RABBITMQ_URL}"

write_env_file "${DEPLOY_PATH}/apps/marketing-service/.env.prod" \
  "PORT=4006" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "ENABLE_SWAGGER=false" \
  "DATABASE_URL=${DATABASE_URL}" \
  "RABBITMQ_URL=${RABBITMQ_URL}"

write_env_file "${DEPLOY_PATH}/apps/reinsurance-service/.env.prod" \
  "PORT=4007" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "ENABLE_SWAGGER=false" \
  "DATABASE_URL=$(db_url_for_schema reinsurance)" \
  "JWT_SECRET=${JWT_SECRET}" \
  "RABBITMQ_URL=${RABBITMQ_URL}" \
  "AUTH_SERVICE_URL=http://auth-service:4001" \
  "ACCOUNTING_SERVICE_URL=http://accounting-service:4008" \
  "INTERNAL_SERVICE_AUTH_SECRET=${INTERNAL_SERVICE_AUTH_SECRET}" \
  "REINSURANCE_DOCUMENT_STORAGE_PROVIDER=${REINSURANCE_DOCUMENT_STORAGE_PROVIDER}" \
  "REINSURANCE_DOCUMENT_CLOUDINARY_ROOT_FOLDER=${REINSURANCE_DOCUMENT_CLOUDINARY_ROOT_FOLDER}" \
  "REINSURANCE_DOCUMENT_SIGNED_URL_TTL_SECONDS=${REINSURANCE_DOCUMENT_SIGNED_URL_TTL_SECONDS}" \
  "CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}" \
  "CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}" \
  "CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}" \
  "REINSURANCE_TENANT_PROFILE_CACHE_TTL_SECONDS=${REINSURANCE_TENANT_PROFILE_CACHE_TTL_SECONDS}" \
  "REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED=false"

write_env_file "${DEPLOY_PATH}/apps/accounting-service/.env.prod" \
  "PORT=4008" \
  "DEPLOY_ENV=${DEPLOY_ENV}" \
  "NODE_ENV=production" \
  "ENABLE_SWAGGER=false" \
  "DATABASE_URL=$(db_url_for_schema accounting)" \
  "JWT_SECRET=${JWT_SECRET}" \
  "INTERNAL_SERVICE_AUTH_SECRET=${INTERNAL_SERVICE_AUTH_SECRET}" \
  "INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES=${INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES}"
log "✓ Service env files written"

section "Compose Validation"
validate_compose_render
log "✓ docker compose config"

section "Registry Auth"
echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
log "✓ Authenticated with GHCR"

section "Pull Images"
docker_compose pull redis
ensure_image_available "$API_GATEWAY_IMAGE" "api-gateway" "api-gateway"
ensure_image_available "$AUTH_SERVICE_IMAGE" "auth-service" "auth-service"
ensure_image_available "$HR_SERVICE_IMAGE" "hr-service" "hr-service"
ensure_image_available "$NOTIFICATION_SERVICE_IMAGE" "notification-service" "notification-service"
ensure_image_available "$SUBSCRIPTION_SERVICE_IMAGE" "subscription-service" "subscription-service"
ensure_image_available "$MARKETING_SERVICE_IMAGE" "marketing-service" "marketing-service"
ensure_image_available "$REINSURANCE_SERVICE_IMAGE" "reinsurance-service" "reinsurance-service"
ensure_image_available "$ACCOUNTING_SERVICE_IMAGE" "accounting-service" "accounting-service"
ensure_image_available "$NEXTJS_IMAGE" "nextjs-web" "nextjs-web"
log "✓ Required images available"

section "Runtime Env Preflight"
preflight_runtime_env "$API_GATEWAY_IMAGE" "${DEPLOY_PATH}/apps/api-gateway/.env.prod" "dist/config/runtime-env.js" "api-gateway"
preflight_runtime_env "$AUTH_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/auth-service/.env.prod" "dist/config/runtime-env.js" "auth-service"
preflight_runtime_env "$HR_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/hr-service/.env.prod" "dist/config/runtime-env.js" "hr-service"
preflight_runtime_env "$NOTIFICATION_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/notification-service/.env.prod" "dist/config/runtime-env.js" "notification-service"
preflight_runtime_env "$REINSURANCE_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/reinsurance-service/.env.prod" "dist/config/runtime-env.js" "reinsurance-service"
preflight_runtime_env "$ACCOUNTING_SERVICE_IMAGE" "${DEPLOY_PATH}/apps/accounting-service/.env.prod" "dist/config/runtime-env.js" "accounting-service"
log "✓ Runtime env validation passed"

section "Infrastructure Services"
docker_compose up -d --no-build redis
wait_for_container_health redis
log "✓ Infrastructure services healthy"

section "Database Migrations"
docker_compose run --rm --no-deps auth-service sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/auth-service/prisma/schema.prisma"
docker_compose run --rm --no-deps hr-service sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/hr-service/prisma/schema.prisma"
docker_compose run --rm --no-deps notification-service sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/notification-service/prisma/schema.prisma"
docker_compose run --rm --no-deps subscription-service sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/subscription-service/prisma/schema.prisma" || true
docker_compose run --rm --no-deps marketing-service sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/marketing-service/prisma/schema.prisma" || true
docker_compose run --rm --no-deps reinsurance-service sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/reinsurance-service/prisma/schema.prisma"
docker_compose run --rm --no-deps accounting-service sh -c "npx prisma@5.22.0 migrate deploy --schema /app/apps/accounting-service/prisma/schema.prisma"
log "✓ Migrations complete"

section "Deploy"
if ! docker_compose up -d --remove-orphans --no-build; then
  print_compose_failure_diagnostics
  die "Docker Compose rollout failed"
fi
log "✓ Compose rollout finished"

section "Container Health"
wait_for_container_health redis
wait_for_container_health auth-service
wait_for_container_health hr-service
wait_for_container_health notification-service
wait_for_container_health subscription-service
wait_for_container_health marketing-service
wait_for_container_health reinsurance-service
wait_for_container_health accounting-service
wait_for_container_health api-gateway
wait_for_container_health nextjs

section "Production Platform Bootstrap"
if docker_compose_exec \
  -e SUPER_ADMIN_EMAIL="${SUPER_ADMIN_EMAIL}" \
  -e SUPER_ADMIN_PASSWORD="${SUPER_ADMIN_PASSWORD}" \
  -e NODE_ENV=production \
  auth-service \
  node /app/apps/auth-service/dist/prisma/seed.js; then
  log "✓ Production platform seed complete"
else
  die "Production platform seed failed"
fi

section "Reachability"
wait_for_http_ok "prod api-gateway" "http://127.0.0.1:4110/health"
wait_for_http_ok "prod reinsurance via gateway" "http://127.0.0.1:4110/api/v1/operations/reinsurance/health"
wait_for_http_ok "prod accounting via gateway" "http://127.0.0.1:4110/api/v1/accounting/health"
wait_for_http_ok "prod nextjs" "http://127.0.0.1:3100/health"

record_successful_deploy_images

section "Container Status"
docker_compose ps

post_deploy_capacity_maintenance

log ""
log "✓ Production deployment complete at $(date -u +%Y-%m-%dT%H:%M:%SZ)"
log "Safe logs command:"
log "  docker compose --project-name ${COMPOSE_PROJECT_NAME} --env-file ${COMPOSE_ENV_FILE} -f ${COMPOSE_FILE} logs --tail 200 <service>"
