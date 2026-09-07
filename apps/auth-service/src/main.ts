import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { isSwaggerEnabled } from '@work-phelo/config';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger.config';
import { Transport } from '@nestjs/microservices';
import { GlobalExceptionFilter } from './common/prisma-exception.filter';
import { assertAuthRuntimeEnv } from './config/runtime-env';

const ORDINARY_BODY_LIMIT = process.env.HTTP_BODY_LIMIT ?? '1mb';
const DEFAULT_TRUST_PROXY_HOPS = 1;

function authTrustProxyHops(): number {
  const configured = Number(process.env.AUTH_TRUST_PROXY_HOPS);

  if (Number.isInteger(configured) && configured >= 0 && configured <= 5) {
    return configured;
  }

  return DEFAULT_TRUST_PROXY_HOPS;
}

async function bootstrap() {
  assertAuthRuntimeEnv();
  const rabbitMqUrl = process.env.RABBITMQ_URL as string;

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableShutdownHooks();
  app.use(json({ limit: ORDINARY_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: ORDINARY_BODY_LIMIT }));
  app.getHttpAdapter().getInstance().set('trust proxy', authTrustProxyHops());

  app.use(helmet());
  app.use(cookieParser());
  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:8080',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  if (isSwaggerEnabled()) {
    setupSwagger(app);
  }

  // Connect as hybrid microservice to listen to RabbitMQ events
  app.connectMicroservice<any>({
    transport: Transport.RMQ,
    options: {
      urls: [rabbitMqUrl],
      queue: 'auth_queue',
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

  const port = process.env.PORT || 4001;
  await app.listen(port);
  console.log(`Auth service running on port ${port}`);
  // Start RabbitMQ consumer after HTTP is up — connection failures won't block the HTTP server
  app
    .startAllMicroservices()
    .catch((err: Error) =>
      console.error('RabbitMQ microservice failed to start:', err.message),
    );
}

void bootstrap();
