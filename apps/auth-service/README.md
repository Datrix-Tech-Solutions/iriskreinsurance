# WorkPhelo Auth Service

The Auth Service owns platform authentication, tenants, users, roles,
permissions, invite flows, OAuth callbacks and tenant branding metadata.

Current environment URLs are listed in the root repository README.

## Responsibilities

- Login, refresh, logout and profile/session APIs.
- Platform and tenant user management.
- Tenant creation and tenant admin invitation flows.
- Invite resend and accept-invite flows.
- Password reset and account activation links.
- RBAC/permission resources and user permission sets.
- Tenant branding foundation.
- OAuth callback handling for Google and Microsoft.

## Gateway Prefix

```text
/api/v1/auth/*
```

## Local Development

```bash
npm run dev --workspace=apps/auth-service
```

Default local port: `4001`

Local Swagger: `http://localhost:4001/docs`

## Deployed Swagger

| Environment | Swagger                                          |
| ----------- | ------------------------------------------------ |
| Dev         | `https://dev-api.workphelo.com/api/v1/auth/docs` |
| Prod        | Normally disabled                                |

## Key Environment Variables

- `DATABASE_URL`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `JWT_SECRET`
- `RABBITMQ_URL`
- `REDIS_URL`
- `FRONTEND_BASE_URL`
- `APP_URL`
- `FRONTEND_URL`
- `COOKIE_SECURE`
- `COOKIE_SAME_SITE`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_CALLBACK_URL`
- `MICROSOFT_CLIENT_ID`
- `MICROSOFT_CLIENT_SECRET`
- `MICROSOFT_CALLBACK_URL`
- `SUPER_ADMIN_EMAIL`
- `SUPER_ADMIN_PASSWORD` for local seed scripts
- `INTERNAL_SERVICE_AUTH_SECRET`
- `INTERNAL_SERVICE_AUTH_ALLOWED_SERVICES`
- `INTERNAL_SERVICE_AUTH_MAX_CLOCK_SKEW_SECONDS`
- `AUTH_TENANT_ASSET_STORAGE_PROVIDER`
- `AUTH_TENANT_ASSET_S3_BUCKET`
- `AUTH_TENANT_ASSET_S3_REGION`
- `AUTH_TENANT_ASSET_S3_PREFIX`
- `AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS`
- `AUTH_TENANT_ASSET_CLOUDINARY_ROOT_FOLDER` when using Cloudinary
- `CLOUDINARY_CLOUD_NAME` when using Cloudinary
- `CLOUDINARY_API_KEY` when using Cloudinary
- `CLOUDINARY_API_SECRET` when using Cloudinary

Production app links should use `https://app.workphelo.com`. Development app
links should use `https://dev-app.workphelo.com`.

Tenant document profile and branding APIs store private tenant identity assets,
signatories and bank details for downstream document rendering. Asset storage
uses the configured tenant asset provider; API responses and docs must not
expose private object keys or credentials.

## Tenant Asset Storage Providers

`AUTH_TENANT_ASSET_STORAGE_PROVIDER` supports:

- `s3` for the existing private S3-backed tenant assets.
- `cloudinary` for new private Cloudinary-backed tenant assets.

S3 remains supported for historical tenant document profile and branding assets.
Existing untagged object keys are resolved as S3 keys even when the active
provider is Cloudinary. New Cloudinary uploads store provider-tagged object keys
using authenticated image delivery so signed access can be generated server-side
without exposing permanent public CDN URLs.

Cloudinary uploads require:

- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

Optional Cloudinary folder scoping:

- `AUTH_TENANT_ASSET_CLOUDINARY_ROOT_FOLDER`, default empty. For hosted
  environments use a stable value such as `workphelo`.

`AUTH_TENANT_ASSET_SIGNED_URL_TTL_SECONDS` applies to both providers. Values are
capped at 900 seconds.
