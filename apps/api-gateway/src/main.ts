import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { isSwaggerEnabled } from '@work-phelo/config';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger.config';
import { assertGatewayRuntimeEnv } from './config/runtime-env';

const ORDINARY_BODY_LIMIT = process.env.HTTP_BODY_LIMIT ?? '1mb';
const DEFAULT_TRUST_PROXY_HOPS = 1;

function gatewayTrustProxyHops(): number {
  const configured = Number(process.env.GATEWAY_TRUST_PROXY_HOPS);

  if (Number.isInteger(configured) && configured >= 0 && configured <= 5) {
    return configured;
  }

  return DEFAULT_TRUST_PROXY_HOPS;
}

async function bootstrap() {
  assertGatewayRuntimeEnv();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableShutdownHooks();
  app.use(json({ limit: ORDINARY_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: ORDINARY_BODY_LIMIT }));
  app
    .getHttpAdapter()
    .getInstance()
    .set('trust proxy', gatewayTrustProxyHops());

  app.use(
    helmet({
      // Swagger's local HTTP requests would otherwise be upgraded to HTTPS by
      // Helmet, while the development Gateway intentionally has no TLS.
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production'
          ? undefined
          : { directives: { upgradeInsecureRequests: null } },
    }),
  );
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  if (isSwaggerEnabled()) {
    setupSwagger(app);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`API Gateway running on port ${port}`);
  console.log(`Auth Service:  ${process.env.AUTH_SERVICE_URL}`);
  console.log(`HR Service:    ${process.env.HR_SERVICE_URL}`);
}

void bootstrap();
