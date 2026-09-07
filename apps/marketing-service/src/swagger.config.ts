import { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('WorkPhelo ERP — Marketing Service')
    .setDescription(
      '## Marketing API\n\n' +
        'Scaffolded service reserved for future marketing campaigns, audience and CRM workflows.\n\n' +
        '### Base URL\n' +
        'All requests are served under the global prefix /api.\n\n' +
        '**Example:** GET http://localhost:4006/api/health when health routes are available.\n\n' +
        '### Authentication\n' +
        'Protected endpoints require a valid JWT token via:\n' +
        '- **Bearer token**: Authorization: Bearer <token>\n' +
        '- **Cookie**: access_token\n\n' +
        '### Swagger Docs\n' +
        'Use the docs page to explore available marketing endpoints and test request bodies.',
    )
    .setVersion('1.0')
    .addServer('http://localhost:4006/api', 'Local Dev')
    .addTag(
      'Marketing',
      'Future campaigns, announcements and audience targeting',
    )
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
    useGlobalPrefix: true,
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      url: 'docs-json',
    },
    customSiteTitle: 'WorkPhelo Marketing API Docs',
  });

  console.log('📖 Marketing service docs: http://localhost:4006/api/docs');
}
