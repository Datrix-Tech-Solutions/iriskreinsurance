import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo ERP — Notification Service')
    .setDescription(
      `
## Notification API

Owns in-app notification storage, notification delivery logs, email delivery, and provider-backed SMS delivery consumers.

### Routes
- Through the API Gateway: \`/api/v1/notification/*\`
- Direct service access: \`/api/*\`

### Authentication
Protected in-app notification endpoints require a valid JWT token via:
- **Cookie**: \`access_token\`
- **Bearer token**: \`Authorization: Bearer <token>\`

RabbitMQ event consumers are intentionally not exposed as HTTP endpoints.

Documentation is enabled for development deployments and local development only,
unless \`ENABLE_SWAGGER=true\` is explicitly set.
      `,
    )
    .setVersion('1.0')
    .addServer(
      '/api/v1/notification',
      'API Gateway (select when opening docs through the gateway)',
    )
    .addServer('/api', 'Direct notification-service')
    .addTag('Health', 'Service and database health checks')
    .addTag('In-App Notifications', 'User-scoped in-app notification APIs')
    .addCookieAuth('access_token')
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
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
      url: 'docs-json',
    },
    customSiteTitle: 'WorkPhelo Notification API Docs',
  });
}
