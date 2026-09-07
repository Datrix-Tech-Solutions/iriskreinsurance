# WorkPhelo Marketing Service

The Marketing Service is a scaffolded service for future marketing workflows.
It is deployed in the current development environment but is not deployed in the
current production Compose file.

Current environment URLs are listed in the root repository README.

## Gateway Prefix

```text
/api/v1/marketing/*
```

## Local Development

```bash
npm run dev --workspace=apps/marketing-service
```

Default local port: `4006`

Local Swagger: `http://localhost:4006/api/docs`

## Deployed Swagger

| Environment | Swagger                                               |
| ----------- | ----------------------------------------------------- |
| Dev         | `https://dev-api.workphelo.com/api/v1/marketing/docs` |
| Prod        | Not deployed in current prod compose                  |

## Notes

- The service currently has no Prisma models.
- Keep documentation and Postman examples conservative until product endpoints
  are finalized.
