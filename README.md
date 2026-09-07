# WorkPhelo ERP

WorkPhelo is a multi-tenant ERP platform built as a NestJS + Next.js
monorepo. The current product surface covers platform authentication, HR,
notifications, scaffolded subscription/marketing services, broker-focused
Reinsurance Operations and standalone Accounting.

The repository is managed with npm workspaces and Turborepo.

## Environments

| Environment    | Frontend                                              | API Gateway                            | Notes                      |
| -------------- | ----------------------------------------------------- | -------------------------------------- | -------------------------- |
| Local          | `http://localhost:3000`                               | `http://localhost:4000/api/v1`         | Developer machine          |
| Development    | `https://dev-app.workphelo.com`                       | `https://dev-api.workphelo.com/api/v1` | Auto-deployed from `dev`   |
| Production app | `https://app.workphelo.com`                           | `https://api.workphelo.com/api/v1`     | Deployed from `prod`       |
| Public landing | `https://workphelo.com` / `https://www.workphelo.com` | n/a                                    | Vercel-managed public site |

Legacy IP-based URLs and `workphelo.com/api/v1` are retired. Do not use them
in new examples, generated links or documentation.

## Monorepo Structure

```text
work-phelo/
├── apps/
│   ├── api-gateway/
│   ├── auth-service/
│   ├── hr-service/
│   ├── notification-service/
│   ├── subscription-service/
│   ├── marketing-service/
│   ├── reinsurance-service/
│   ├── accounting-service/
│   └── web/
│       └── work-phelo-web/
├── packages/
│   ├── config/
│   ├── schemas/
│   ├── types/
│   └── utils/
└── infrastructure/
```

## Services and Ports

| Service              | Local port | Gateway prefix                     | Dev deploy | Prod deploy |
| -------------------- | ---------: | ---------------------------------- | ---------- | ----------- |
| API Gateway          |     `4000` | `/api/v1/*`                        | Yes        | Yes         |
| Auth Service         |     `4001` | `/api/v1/auth/*`                   | Yes        | Yes         |
| HR Service           |     `4002` | `/api/v1/hr/*`                     | Yes        | Yes         |
| Notification Service |     `4004` | `/api/v1/notification/*`           | Yes        | Yes         |
| Subscription Service |     `4005` | `/api/v1/subscription/*`           | Yes        | No          |
| Marketing Service    |     `4006` | `/api/v1/marketing/*`              | Yes        | No          |
| Reinsurance Service  |     `4007` | `/api/v1/operations/reinsurance/*` | Yes        | No          |
| Accounting Service   |     `4008` | `/api/v1/accounting/*`             | Yes        | No          |
| Web app              |     `3000` | same-origin `/api/v1/*`            | Yes        | Yes         |

Production exposure is intentionally narrower than development. Check
[`infrastructure/docker-compose.prod.yml`](infrastructure/docker-compose.prod.yml)
before planning any production release.

## Deployment Capacity Hardening

Development and production deployments run a remote host preflight before SCP
uploads deployment assets. The preflight checks root filesystem capacity, Docker
daemon health, Docker Compose availability, deployment target writability and
required host utilities. The default minimum free space is `15 GiB`, configured
with the non-secret `DEPLOY_MIN_FREE_GIB` workflow environment value.

After a successful rollout and health verification, deploy scripts run
reference-aware WorkPhelo image cleanup. Successful deployments record
environment-specific image history in `.deploy-image-history.dev` or
`.deploy-image-history.prod` using `timestamp<TAB>service<TAB>image_ref` rows.
The cleanup protects every image ID referenced by any container on the shared
Docker host, including stopped dev and production containers. It also protects
current compose image refs and the current plus previous two successful SHA
image refs per service for both dev and production. It only targets old unused
SHA-tagged images under `ghcr.io/datrix-tech-solutions/work-phelo/*` and keeps
non-SHA tags such as `dev` and `prod`.

The deploy scripts never prune Docker volumes and never delete Docker filesystem
internals directly. For emergency disk inspection use:

```bash
df -h /
docker system df
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
docker image ls 'ghcr.io/datrix-tech-solutions/work-phelo/*'
docker builder du
```

Do not run broad destructive cleanup commands such as
`docker system prune -a --volumes`, `docker volume prune` or direct removal
under `/var/lib/docker`.

The Compose files currently do not define container log rotation. Host-level
hardening should be handled separately through approved server management:
Docker log rotation, journald caps, external disk monitoring and alerts, SSH key
hardening, firewall review, automatic security updates and backup/restore
verification.

## Architecture Principles

- Each backend service owns its schema, migrations, API contracts and business
  boundaries.
- Auth owns tenants, users, RBAC, permissions and tenant branding/document
  profile metadata.
- Accounting remains independently usable for manual journals, chart of
  accounts, fiscal periods, reports, posting rules and source-event processing.
- Operational modules may integrate with Accounting through source events,
  transactional outboxes, signed internal transport, idempotency and posting
  rules; this is optional and must not make Accounting depend on a source
  module.
- Reinsurance owns broker operational facts. Accounting owns financial
  confirmation, posting rules, journal creation and reconciliation.
- Browser code should call same-origin `/api/v1/...`; the frontend proxy and
  gateway route requests to services.

## Setup

### Prerequisites

- Node.js 20+
- npm 10+
- Docker Desktop or compatible Docker runtime
- PostgreSQL 16
- Redis and RabbitMQ for local integration flows

### Install

```bash
npm install
```

### Start Local Infrastructure

```bash
npm run dev:infra
```

This starts Redis and RabbitMQ from
[`infrastructure/docker-compose.dev.yml`](infrastructure/docker-compose.dev.yml).
PostgreSQL is expected through service `DATABASE_URL` values.

### Environment Configuration

Each service reads its own `.env`/`.env.dev` file. Never commit real secret
values.

Common variables:

| Variable                                                  | Services                                        | Purpose                                                                                    | Secret                         |
| --------------------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------ |
| `DATABASE_URL`                                            | Auth, HR, Notification, Reinsurance, Accounting | Service-owned PostgreSQL schema connection                                                 | Yes                            |
| `JWT_SECRET` / `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Gateway/Auth/services                           | JWT verification and issuing                                                               | Yes                            |
| `RABBITMQ_URL`                                            | Auth, HR, Notification, Reinsurance             | Async messaging                                                                            | Yes                            |
| `REDIS_URL`                                               | HR and cache/session infrastructure             | Redis connection                                                                           | Yes                            |
| `ALLOWED_ORIGINS`                                         | Gateway/Auth/HR                                 | CORS allow-list                                                                            | No                             |
| `FRONTEND_BASE_URL` / `APP_URL` / `FRONTEND_URL`          | Auth/HR/Notification                            | Generated application links                                                                | No                             |
| `ENABLE_SWAGGER`                                          | Backend services                                | Explicitly enables Swagger                                                                 | No                             |
| `DEPLOY_ENV`                                              | Backend services                                | Enables dev/prod Swagger defaults                                                          | No                             |
| `INTERNAL_SERVICE_AUTH_SECRET`                            | Auth, Accounting, Reinsurance integrations      | HMAC signing for internal calls                                                            | Yes                            |
| `ACCOUNTING_SERVICE_URL`                                  | Gateway, Reinsurance                            | Optional Accounting route/integration target                                               | No                             |
| `AUTH_SERVICE_URL`                                        | Gateway, Reinsurance document profile client    | Auth routing and profile lookups                                                           | No                             |
| `REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_*`              | Reinsurance                                     | Optional outbox dispatcher enabled, interval, batch, timeout, retry delay and max attempts | No                             |
| `REINSURANCE_DOCUMENT_S3_*`                               | Reinsurance                                     | Private document storage                                                                   | Yes where credentials are used |
| `REINSURANCE_MAILBOX_TOKEN_ENCRYPTION_KEY`                | Reinsurance                                     | Mailbox token encryption                                                                   | Yes                            |
| `SMS_PROVIDER`, `TERMII_*`, `PILOSMS_*`                   | Notification                                    | SMS provider selection and credentials                                                     | Yes for API keys               |
| `RESEND_API_KEY`, `RESEND_FROM_EMAIL`                     | Notification                                    | Email provider                                                                             | Yes for API key                |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_BASE_URL`         | Web                                             | Browser-visible API/app base URLs                                                          | No                             |

The outbox dispatcher variables currently supported by Reinsurance are:
`REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_ENABLED`,
`REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_POLL_INTERVAL_MS`,
`REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_BATCH_SIZE`,
`REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_PROCESSING_TIMEOUT_MS`,
`REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_RETRY_DELAY_MS` and
`REINSURANCE_ACCOUNTING_OUTBOX_DISPATCHER_MAX_ATTEMPTS`.

## Database and Prisma

Generate Prisma clients:

```bash
npm run db:generate:all
```

Run migrations service-by-service when needed:

```bash
npm run db:migrate --workspace=apps/auth-service
npm run db:migrate --workspace=apps/hr-service
npm run db:migrate --workspace=apps/reinsurance-service
npm run db:migrate --workspace=apps/accounting-service
```

Subscription and Marketing currently have no Prisma models and their
`db:generate` scripts intentionally no-op.

## Running Locally

```bash
# all workspace dev scripts
npm run dev

# selected services
npm run dev:gateway
npm run dev:auth
npm run dev:hr
npm run dev:notify
npm run dev:reinsurance
npm run dev:accounting

# frontend
cd apps/web/work-phelo-web
npm run dev
```

The API Gateway needs the downstream service URL variables for any service you
want to reach. Missing optional downstreams return controlled service
configuration errors instead of silently routing elsewhere.

## Swagger/OpenAPI

Swagger is enabled by default outside production unless disabled by environment
configuration. Production Swagger should remain disabled unless explicitly
opened for a controlled support window.

| Service      | Local Swagger                    | Dev Swagger                                                        |
| ------------ | -------------------------------- | ------------------------------------------------------------------ |
| API Gateway  | `http://localhost:4000/docs`     | `https://dev-api.workphelo.com/docs`                               |
| Auth         | `http://localhost:4001/docs`     | `https://dev-api.workphelo.com/api/v1/auth/docs`                   |
| HR           | `http://localhost:4002/docs`     | `https://dev-api.workphelo.com/api/v1/hr/docs`                     |
| Notification | `http://localhost:4004/api/docs` | `https://dev-api.workphelo.com/api/v1/notification/docs`           |
| Subscription | `http://localhost:4005/api/docs` | `https://dev-api.workphelo.com/api/v1/subscription/docs`           |
| Marketing    | `http://localhost:4006/api/docs` | `https://dev-api.workphelo.com/api/v1/marketing/docs`              |
| Reinsurance  | `http://localhost:4007/api/docs` | `https://dev-api.workphelo.com/api/v1/operations/reinsurance/docs` |
| Accounting   | `http://localhost:4008/api/docs` | `https://dev-api.workphelo.com/api/v1/accounting/docs`             |

## Validation

Common checks:

```bash
npm run lint
npm run check-types
npm run build
npm run test
npm run check-rbac
git diff --check
```

Service-focused examples:

```bash
npm run test --workspace=apps/reinsurance-service
npm run lint --workspace=apps/accounting-service
npm run db:validate --workspace=apps/reinsurance-service
```

Web checks:

```bash
cd apps/web/work-phelo-web
npm run lint
npx tsc --noEmit
npm run build
```

## Deployment

| Branch | Workflow                            | Target                  |
| ------ | ----------------------------------- | ----------------------- |
| `dev`  | `.github/workflows/deploy-dev.yml`  | Development environment |
| `prod` | `.github/workflows/deploy-prod.yml` | Production environment  |

Do not merge directly to `prod` casually. Production changes require an
explicit release plan, migration review, environment review and rollback notes.

## Contribution Workflow

1. Branch from latest `origin/dev` unless a release task says otherwise.
2. Keep changes scoped to one business or infrastructure milestone.
3. Preserve module ownership boundaries.
4. Update tracked READMEs and Swagger decorators when APIs, ports, env vars,
   workflows or integration contracts change.
5. Run focused validation first, then broader checks before pushing.
6. Open PRs into `dev` unless the release plan explicitly targets another
   branch.

## Documentation Policy

Tracked, maintained documentation should live in READMEs, Swagger/OpenAPI
decorators, DTO metadata, schemas, examples and code-adjacent comments.
Directories named `docs/` are local working/reference areas and are not the
canonical delivery surface for fresh clones after the local-docs policy is
merged.
