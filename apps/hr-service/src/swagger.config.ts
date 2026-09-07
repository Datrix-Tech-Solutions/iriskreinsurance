import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo ERP — HR Service')
    .setDescription(
      `
## Human Resources API

Handles all HR operations: employees, departments, leave, time tracking, payroll, and appraisals.

### Base URL
All requests go through the API Gateway at /api/v1/hr/...

**Example (dev):** GET https://dev-api.workphelo.com/api/v1/hr/dashboard/summary

**Example (prod):** GET https://api.workphelo.com/api/v1/hr/dashboard/summary

### How to Authenticate in Swagger
1. Login via POST /auth/login using your tenant credentials
2. Open browser DevTools → Application → Cookies → copy the access_token value
3. Click the Authorize button above → paste token → click Authorize

### Demo Credentials
Use seeded local test accounts or your own tenant credentials. Avoid publishing real credentials inside Swagger documentation.

### Available Modules

**Dashboard**
- GET /hr/dashboard/summary — Company Admin dashboard stats

**Employees**
- POST /hr/employees — Create employee profile
- GET /hr/employees — List all employees
- GET /hr/employees/me — My profile
- GET /hr/employees/:id — Get employee
- PATCH /hr/employees/:id — Update employee
- PATCH /hr/employees/:id/offboard — Offboard employee

**Departments**
- POST /hr/departments — Create department
- GET /hr/departments — List departments
- PATCH /hr/departments/:id — Update department
- DELETE /hr/departments/:id — Delete department

**Leave**
- POST /hr/leave/types — Create leave type
- GET /hr/leave/types — List leave types
- POST /hr/leave/requests — Submit leave request
- GET /hr/leave/requests/my — My leave requests
- PATCH /hr/leave/requests/:id/review — Approve/reject

**Time & Attendance**
- POST /hr/time/clock-in — Clock in
- POST /hr/time/clock-out — Clock out
- GET /hr/time/today — Today status
- GET /hr/time/attendance — Attendance records

**Payroll** (Ghana GRA compliant)
- POST /hr/payroll/run — Run payroll
- GET /hr/payroll — List payroll runs
- PATCH /hr/payroll/:id/approve — Approve payroll
- GET /hr/payroll/my-payslips — My payslips

**Appraisals**
- POST /hr/appraisals/cycles — Create cycle
- POST /hr/appraisals/cycles/:id/start — Start cycle
- PATCH /hr/appraisals/:id/self-assessment — Submit self review

### Authentication
All endpoints require a valid JWT token via:
- **Cookie**: \`access_token\`
- **Bearer token**: \`Authorization: Bearer <token>\`

### Ghana Payroll Calculations
- **Tier 1**: 0.5% employee, 13% employer contribution
- **Tier 2**: 5% employee contribution on basic salary
- **PAYE**: configured Ghana Revenue Authority tax bands
- All monetary values use Decimal precision (no floating point)

### Response Format
\`\`\`json
{
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 100, "totalPages": 5 }
}
\`\`\`
    `,
    )
    .setVersion('1.0')
    .addServer(
      'https://dev-api.workphelo.com/api/v1/hr',
      'Dev (via API Gateway)',
    )
    .addServer(
      'https://api.workphelo.com/api/v1/hr',
      'Production (via API Gateway)',
    )
    .addTag('Departments', 'Department management')
    .addTag('Employees', 'Employee profiles and documents')
    .addTag('Imports', 'CSV import dry-runs and validation results')
    .addTag('Leave', 'Leave types, balances, requests and approvals')
    .addTag('Time', 'Clock-in/out, timesheets, corrections, schedules')
    .addTag('Payroll', 'Payroll processing with Ghana GRA calculations')
    .addTag('Appraisals', 'Performance appraisal cycles and reviews')
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

  console.log('📖 HR Service docs: http://localhost:4002/docs');
}
