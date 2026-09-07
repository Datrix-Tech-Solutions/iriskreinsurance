# WorkPhelo Web

The web workspace contains the WorkPhelo Next.js application at
`apps/web/work-phelo-web`.

Current frontend/API domains are listed in the root repository README.

## Active Hosts

| Environment | App host                        | API host                               |
| ----------- | ------------------------------- | -------------------------------------- |
| Local       | `http://localhost:3000`         | same-origin `/api/v1` or local gateway |
| Development | `https://dev-app.workphelo.com` | `https://dev-api.workphelo.com/api/v1` |
| Production  | `https://app.workphelo.com`     | `https://api.workphelo.com/api/v1`     |

The public landing page uses `https://workphelo.com` and
`https://www.workphelo.com`; application routes belong on the app host.

## API Calls

Browser code should call same-origin `/api/v1/...`. The app host and Next.js
rewrite/proxy path route requests to the API gateway. Avoid direct browser
credentialed calls to the API subdomain unless auth/cookie/CORS behavior is
redesigned.

## Local Development

```bash
cd apps/web/work-phelo-web
npm run dev
```

## Build-Time Environment

```bash
NEXT_PUBLIC_API_URL=https://dev-api.workphelo.com/api/v1
NEXT_PUBLIC_APP_BASE_URL=https://dev-app.workphelo.com
```

Production uses:

```bash
NEXT_PUBLIC_API_URL=https://api.workphelo.com/api/v1
NEXT_PUBLIC_APP_BASE_URL=https://app.workphelo.com
```
