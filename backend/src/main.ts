import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {
  BadRequestException,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import cookieParser from 'cookie-parser'; // ← default import (no * as)
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { NestExpressApplication } from '@nestjs/platform-express'
import { join } from 'path'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)
  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' })
  app.use(cookieParser()); // ← must be here
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      stopAtFirstError: true,
      exceptionFactory: (errors) => {
        const formatted: Record<string, string> = {};

        errors.forEach((error) => {
          formatted[error.property] = Object.values(error.constraints ?? {})[0];
        });

        return new BadRequestException({
          message: 'Validation failed',
          errors: formatted,
          code: HttpStatus.BAD_REQUEST,
        });
      },
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap().catch((err) => {
  console.error(err);
  process.exit(1);
});
