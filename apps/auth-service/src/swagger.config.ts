import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo ERP — Auth Service')
    .setDescription(
      `
## Authentication & Authorization API

Handles all authentication, user management, tenant management, and RBAC.

### Base URL
All requests go through the API Gateway at /api/v1/auth/...

**Example (dev):** POST https://dev-api.workphelo.com/api/v1/auth/login

**Example (prod):** POST https://api.workphelo.com/api/v1/auth/login

### Sprint 1 — Key Flows

**1. SuperAdmin Registration of Tenant**
- POST /auth/admin/login → get token
- POST /auth/tenants/register → creates tenant + sends invite email

**2. Tenant Admin Onboarding**
- GET email invite link → POST /auth/users/accept-invite → auto-login

**3. Tenant Login**
- POST /auth/login with tenantSlug

**4. Forgot Password**
- POST /auth/forgot-password → OTP sent to email
- POST /auth/reset-password with OTP token

**5. Session Management**
- POST /auth/refresh → rotate tokens
- POST /auth/logout → revoke session
- GET /auth/me → get current user

### Authentication
All protected endpoints require a valid JWT token either via:
- **Cookie**: \`access_token\` (set automatically on login)
- **Bearer token**: \`Authorization: Bearer <token>\`

### Token Refresh
Access tokens expire in **15 minutes**. Use \`POST /auth/refresh\` to rotate tokens using the \`refresh_token\` cookie.

### System Roles
| Role | Description |
|---|---|
| SUPER_ADMIN | Datrix platform owner — full platform access |
| TENANT_ADMIN | Company admin — full access within their company |
| EMPLOYEE | Regular user — access controlled by company role |

### Company Roles
Each tenant has 2 default company roles seeded automatically: **Company Admin** and **Employee**.
Tenant Admins can create custom roles with specific permissions.

### Demo Credentials
Use seeded local test accounts or your own tenant credentials. Avoid publishing real credentials inside Swagger documentation.
    `,
    )
    .setVersion('1.0')
    .addServer(
      'https://dev-api.workphelo.com/api/v1/auth',
      'Dev (via API Gateway)',
    )
    .addServer(
      'https://api.workphelo.com/api/v1/auth',
      'Production (via API Gateway)',
    )
    .addTag('Auth', 'Login, logout, token refresh, MFA, social auth')
    .addTag('Tenants', 'Tenant registration and management')
    .addTag(
      'Tenant Document Profile',
      'Private document identity, branding assets, signatories and bank accounts',
    )
    .addTag('Users', 'User management and invitations')
    .addTag('Company Roles', 'Company role management')
    .addTag('Permissions', 'Permission grants and revokes')
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

  console.log('📖 Auth Service docs: http://localhost:4001/docs');
}
