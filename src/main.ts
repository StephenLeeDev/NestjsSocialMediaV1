/**
 * ============================================================================
 *  Server entry point
 * ============================================================================
 *
 * `npm run start` / `npm run start:prod` run this file. It:
 *   1. creates the Nest application from `AppModule`
 *   2. applies the shared app-wide setup (`configureApp` in `app.setup.ts`)
 *   3. starts listening for HTTP and WebSocket connections on PORT (from .env)
 *
 * Keep this file small: anything the e2e tests should also use belongs in
 * `app.setup.ts`, not here.
 */
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { configureApp } from './app.setup';

async function bootstrap() {
  // `NestExpressApplication` gives access to Express-specific features such as
  // `useStaticAssets`, which `configureApp` needs.
  const app = configureApp(
    await NestFactory.create<NestExpressApplication>(AppModule),
  );

  // ConfigService reads values from environment variables / the .env file.
  const configService = app.get(ConfigService);

  const port = configService.get('PORT');
  await app.listen(port);
  Logger.log(`Application running on ${configService.get('SERVER_URL')}`);
}
bootstrap();
