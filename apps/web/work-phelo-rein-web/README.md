# WorkPhelo Web App

`work-phelo-web` is the tenant-facing Next.js App Router application for
WorkPhelo.

## Responsibilities

- Tenant login and module navigation.
- HR, Accounting, Marketing and Reinsurance user interfaces.
- Same-origin API calls through `/api/v1/*`.
- React Query cache management for backend-owned business state.
- Tenant/module themed shell layouts.

The frontend should not invent official financial, document or lifecycle truth
when backend endpoints already provide it. Reinsurance and Accounting workflows
must display backend-derived state and preserve module ownership boundaries.

## Local Development

```bash
cd apps/web/work-phelo-web
npm run dev
```

Default local URL: `http://localhost:3000`

The API Gateway and any required downstream services must be running locally for
authenticated module pages.

## Environment Variables

| Variable                              | Purpose                                                                                                  | Secret |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------ |
| `NEXT_PUBLIC_API_URL`                 | Browser-visible API base URL, usually `/api/v1` through same-origin rewrites or the deployed API gateway | No     |
| `NEXT_PUBLIC_APP_BASE_URL`            | Browser-visible app base URL for generated links                                                         | No     |
| `NEXT_PUBLIC_MSAL_CLIENT_ID`          | Optional Microsoft auth client ID                                                                        | No     |
| `NEXT_PUBLIC_MSAL_TENANT_ID`          | Optional Microsoft auth tenant ID                                                                        | No     |
| `NEXT_PUBLIC_MSAL_REDIRECT_URI`       | Optional Microsoft auth redirect URI                                                                     | No     |
| `NEXT_PUBLIC_MAPTILER_KEY`            | Optional map tile key                                                                                    | No     |
| `NEXT_PUBLIC_ENABLE_ANNOUNCEMENT_SMS` | Enables SMS option in HR announcement UI when configured                                                 | No     |

Do not place secrets in `NEXT_PUBLIC_*` variables.

## Validation

```bash
npm run lint
npx tsc --noEmit
npm run build
```

Run these from `apps/web/work-phelo-web`.

## Deployment

The app is built by the dev/prod GitHub Actions workflows. Build args provide
the public API/app URLs for the target environment.
