import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { join } from 'path';
import { isSwaggerEnabled } from '@work-phelo/config';
import { GlobalExceptionFilter } from './common/prisma-exception.filter';
import { assertNotificationRuntimeEnv } from './config/runtime-env';
import { setupSwagger } from './swagger.config';

const ORDINARY_BODY_LIMIT = process.env.HTTP_BODY_LIMIT ?? '1mb';

async function bootstrap() {
  assertNotificationRuntimeEnv();
  const rabbitMqUrl = process.env.RABBITMQ_URL as string;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.enableShutdownHooks();
  app.use(json({ limit: ORDINARY_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: ORDINARY_BODY_LIMIT }));
  app.useStaticAssets(join(__dirname, 'public'), { prefix: '/public' });
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.connectMicroservice<MicroserviceOptions>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitMqUrl],
      queue: 'notification_queue',
      queueOptions: {
        durable: true,
        arguments: {
          'x-message-ttl': 3600000,
        },
      },
      noAck: false,
      prefetchCount: 10,
    },
  });
  app.setGlobalPrefix('api');
  if (isSwaggerEnabled()) {
    setupSwagger(app);
  }
  const port = process.env.PORT || 4004;
  await app.listen(port);
  console.log(`Notification service running on port ${port}`);
  // Start RabbitMQ consumer after HTTP is up — connection failures won't block the HTTP server
  app
    .startAllMicroservices()
    .catch((err: unknown) =>
      console.error(
        'RabbitMQ microservice failed to start:',
        err instanceof Error ? err.message : String(err),
      ),
    );
}
void bootstrap();
