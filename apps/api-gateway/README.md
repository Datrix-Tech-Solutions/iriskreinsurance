# WorkPhelo API Gateway

The API Gateway is the public HTTP entry point for WorkPhelo backend services.
Current environment URLs are listed in the root repository README.

## Responsibilities

- Route `/api/v1/*` requests to downstream services.
- Validate JWT cookies or bearer tokens for protected routes.
- Forward tenant/user context headers to downstream services.
- Fetch and sign dynamic permission headers for non-auth services.
- Stream multipart uploads, including HR employee import CSV uploads.
- Expose gateway Swagger when Swagger is enabled.

## Route Prefixes

| Prefix                             | Downstream service   |
| ---------------------------------- | -------------------- |
| `/api/v1/auth/*`                   | Auth Service         |
| `/api/v1/hr/*`                     | HR Service           |
| `/api/v1/notification/*`           | Notification Service |
| `/api/v1/subscription/*`           | Subscription Service |
| `/api/v1/marketing/*`              | Marketing Service    |
| `/api/v1/operations/reinsurance/*` | Reinsurance Service  |
| `/api/v1/accounting/*`             | Accounting Service   |

Downstreams must be configured for the target environment. A route can exist in
dev but return `503 Service is not configured` in prod if that service is not in
the prod deployment.

## Local Development

```bash
npm run dev --workspace=apps/api-gateway
```

Default local port: `4000`

Local Swagger: `http://localhost:4000/docs`

## Deployed URLs

| Environment | API Gateway                            |
| ----------- | -------------------------------------- |
| Dev         | `https://dev-api.workphelo.com/api/v1` |
| Prod        | `https://api.workphelo.com/api/v1`     |

Browser code should still call same-origin `/api/v1/...` from the app host.

## Key Environment Variables

- `JWT_SECRET`
- `AUTH_SERVICE_URL`
- `HR_SERVICE_URL`
- `NOTIFICATION_SERVICE_URL`
- `SUBSCRIPTION_SERVICE_URL`
- `MARKETING_SERVICE_URL`
- `REINSURANCE_SERVICE_URL`
- `ACCOUNTING_SERVICE_URL`
- `ALLOWED_ORIGINS`
- `ENABLE_SWAGGER`

Do not commit secret values.
