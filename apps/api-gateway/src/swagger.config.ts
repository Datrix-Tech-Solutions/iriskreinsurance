import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo ERP — API Gateway')
    .setDescription(
      `
## API Gateway — Single Entry Point

All frontend requests go through this gateway at port **4000**.

### URL Convention
\`/api/v1/{service}/{path}\` → proxied to the owning service

### Service Routes
| Prefix | Service | Port |
|---|---|---|
| \`/api/v1/auth/*\` | Auth endpoints | 4001 |
| \`/api/v1/auth/tenants/*\` | Tenant management | 4001 |
| \`/api/v1/auth/users/*\` | User management | 4001 |
| \`/api/v1/auth/permissions/*\` | Permissions | 4001 |
| \`/api/v1/hr/employees/*\` | Employees | 4002 |
| \`/api/v1/hr/departments/*\` | Departments | 4002 |
| \`/api/v1/hr/leave/*\` | Leave management | 4002 |
| \`/api/v1/hr/time/*\` | Time tracking | 4002 |
| \`/api/v1/hr/payroll/*\` | Payroll | 4002 |
| \`/api/v1/hr/appraisals/*\` | Appraisals | 4002 |
| \`/api/v1/hr/projects/*\` | Projects and tasks | 4002 |
| \`/api/v1/notification/*\` | Notification endpoints | 4004 |
| \`/api/v1/subscription/*\` | Development subscription scaffold | 4005 |
| \`/api/v1/marketing/*\` | Development marketing scaffold | 4006 |
| \`/api/v1/operations/reinsurance/*\` | Reinsurance operations | 4007 |
| \`/api/v1/accounting/*\` | Accounting ledger | 4008 |

### Public Endpoints (no auth required)
- \`POST /api/v1/auth/login\`
- \`POST /api/v1/auth/admin/login\`
- \`POST /api/v1/auth/refresh\`
- \`POST /api/v1/auth/verify-email\`
- \`POST /api/v1/auth/forgot-password\`
- \`POST /api/v1/auth/reset-password\`
- \`POST /api/v1/auth/force-reset-password\`
- \`POST /api/v1/auth/tenants/register\`
- \`POST /api/v1/auth/users/accept-invite\`

### Rate Limits
- 10 requests/second per IP
- 50 requests/10 seconds per IP
- 200 requests/minute per IP
    `,
    )
    .setVersion('1.0')
    .addTag('Gateway', 'Health and gateway endpoints')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        in: 'header',
      },
      'access-token',
    )
    .addCookieAuth('access_token')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      url: 'docs-json',
    },
  });

  console.log(' API Gateway docs: http://localhost:4000/docs');
}
