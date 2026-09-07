# WorkPhelo Subscription Service

The Subscription Service is a scaffolded service for future subscription and
billing workflows. It is deployed in the current development environment but is
not deployed in the current production Compose file.

Current environment URLs are listed in the root repository README.

## Gateway Prefix

```text
/api/v1/subscription/*
```

## Local Development

```bash
npm run dev --workspace=apps/subscription-service
```

Default local port: `4005`

Local Swagger: `http://localhost:4005/api/docs`

## Deployed Swagger

| Environment | Swagger                                                  |
| ----------- | -------------------------------------------------------- |
| Dev         | `https://dev-api.workphelo.com/api/v1/subscription/docs` |
| Prod        | Not deployed in current prod compose                     |

## Notes

- The service currently has no Prisma models.
- Do not document subscription production readiness until the service is added
  to `infrastructure/docker-compose.prod.yml` and production workflows.
