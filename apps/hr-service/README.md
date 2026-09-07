# WorkPhelo HR Service

The HR Service owns tenant HR operations: employees, departments, branches,
leave, payroll, appraisals, assets, projects/tasks, announcements and employee
import dry-run workflows.

Current environment URLs are listed in the root repository README.

## Responsibilities

- Employee lifecycle and profile data.
- Departments, branches, job titles and HR settings.
- Leave management and balances.
- Payroll calculation and payslip workflows.
- Appraisal and performance workflows.
- Company assets, projects and tasks.
- HR announcements with in-app/email/SMS delivery channels.
- Employee CSV import template and dry-run validation.

## Gateway Prefix

```text
/api/v1/hr/*
```

## Local Development

```bash
npm run dev --workspace=apps/hr-service
```

Default local port: `4002`

Local Swagger: `http://localhost:4002/docs`

## Deployed Swagger

| Environment | Swagger                                        |
| ----------- | ---------------------------------------------- |
| Dev         | `https://dev-api.workphelo.com/api/v1/hr/docs` |
| Prod        | Normally disabled                              |

## Employee Import

Current import support is dry-run only:

- `GET /api/v1/hr/imports/employees/template`
- `POST /api/v1/hr/imports/employees/dry-run`

Dry-run accepts `multipart/form-data` with field `file`. It validates rows and
does not create employees, auth users, leave balances or notification events.

## Key Environment Variables

- `DATABASE_URL`
- `RABBITMQ_URL`
- `REDIS_URL`
- `FRONTEND_BASE_URL`
- `FIELD_ENCRYPTION_KEY`
- `FIELD_HMAC_KEY`
- Cloudinary variables for optional avatar/media uploads

Do not commit secret values.
