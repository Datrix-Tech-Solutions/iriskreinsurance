import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { isSwaggerEnabled } from '@work-phelo/config';
import { AppModule } from './app.module';
import { setupSwagger } from './swagger.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api');
  if (isSwaggerEnabled()) {
    setupSwagger(app);
  }
  const port = process.env.PORT || 4005;
  await app.listen(port);
  console.log(`Subscription service running on port ${port}`);
}

void bootstrap();
