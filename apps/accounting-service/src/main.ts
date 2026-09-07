import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { isSwaggerEnabled } from '@work-phelo/config';
import { AppModule } from './app.module';
import {
  ACCOUNTING_GLOBAL_PREFIX,
  ACCOUNTING_GLOBAL_PREFIX_EXCLUSIONS,
} from './config/global-prefix';
import { assertAccountingRuntimeEnv } from './config/runtime-env';
import { setupSwagger } from './swagger.config';

const ORDINARY_BODY_LIMIT = process.env.HTTP_BODY_LIMIT ?? '1mb';

async function bootstrap() {
  assertAccountingRuntimeEnv();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.enableShutdownHooks();
  app.use(json({ limit: ORDINARY_BODY_LIMIT }));
  app.use(urlencoded({ extended: true, limit: ORDINARY_BODY_LIMIT }));
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.setGlobalPrefix(ACCOUNTING_GLOBAL_PREFIX, {
    exclude: ACCOUNTING_GLOBAL_PREFIX_EXCLUSIONS,
  });
  if (isSwaggerEnabled()) setupSwagger(app);

  const port = process.env.PORT || 4008;
  await app.listen(port);
  console.log(`Accounting service running on port ${port}`);
}

void bootstrap();
