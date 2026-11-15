/**
 * ============================================================================
 *  Application-wide setup
 * ============================================================================
 *
 * Everything that configures the Nest application object itself (as opposed to
 * modules, controllers and providers, which live in `AppModule`) is collected here.
 *
 * Why a separate file instead of keeping it in `main.ts`:
 *   - `main.ts` starts the real server.
 *   - The e2e tests (`test/utils/test-app.ts`) build their own app instance.
 *   Both call `configureApp`, so the tests run with EXACTLY the same setup as
 *   production. If a new global setting is added here later (for example a
 *   global ValidationPipe), the tests pick it up automatically.
 */
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import {
  DocumentBuilder,
  SwaggerCustomOptions,
  SwaggerModule,
} from '@nestjs/swagger';
import { join } from 'path';
import { SocketIoAdapter } from './chatroom/socket-io.adapters';

/**
 * Applies the app-wide configuration and returns the same app instance,
 * so it can be used inline: `const app = configureApp(await NestFactory.create(...))`.
 */
export function configureApp(
  app: NestExpressApplication,
): NestExpressApplication {
  // -------------------------------------------------------------------------
  // Request validation for EVERY endpoint
  // -------------------------------------------------------------------------
  // Request DTO classes declare rules with class-validator decorators, e.g.
  //
  //   class CreateCommentDto {
  //     @IsNotEmpty() content: string;
  //   }
  //
  // A ValidationPipe checks incoming request data (body, query, params) against
  // those rules and answers 400 Bad Request, listing the problems, when they are
  // broken. Registering it globally means no endpoint can forget it; previously
  // only POST /auth/signin had one, so the rules on every other DTO were ignored
  // and invalid input reached the database (500 errors or empty values saved).
  //
  // Options intentionally left at their defaults for now:
  //   - whitelist: true  → would REMOVE every request field that has no
  //                        validation decorator. Many DTOs have no decorators
  //                        yet, so this would silently drop real data.
  //   - transform: true  → would convert payloads into DTO class instances and
  //                        cast types. Changes what services receive.
  // Both are planned once every request DTO declares its rules (per-module PRs).
  app.useGlobalPipes(new ValidationPipe());

  // -------------------------------------------------------------------------
  // Swagger (interactive API documentation) at http://<host>:<port>/api
  // -------------------------------------------------------------------------
  const swaggerCustomOptions: SwaggerCustomOptions = {
    swaggerOptions: {
      // Keep the JWT entered in the "Authorize" dialog after a page reload.
      persistAuthorization: true,
    },
  };

  const config = new DocumentBuilder()
    .setTitle('Swagger API')
    .setDescription('Swagger API Document')
    .setVersion('1.0')
    // Adds the "Authorize" button for Bearer tokens.
    // 'Secret1234' is only the NAME of this security scheme inside the Swagger
    // document (controllers refer to it with @ApiBearerAuth('Secret1234')).
    // It is not a secret and has nothing to do with the JWT signing key.
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'Secret1234',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, swaggerCustomOptions);

  // -------------------------------------------------------------------------
  // Static files
  // -------------------------------------------------------------------------
  // Serves everything inside the `static/` folder at the root URL, e.g.
  //   static/images/default/dafault_thumbnail.png → /images/default/dafault_thumbnail.png
  // Uploaded post images and profile pictures are served this way.
  // `__dirname` is `dist/` at runtime, so '..' points back to the project root.
  app.useStaticAssets(join(__dirname, '..', 'static'));

  // -------------------------------------------------------------------------
  // WebSockets
  // -------------------------------------------------------------------------
  // Use Socket.IO for the `@WebSocketGateway()` classes (the DM chat gateway).
  app.useWebSocketAdapter(new SocketIoAdapter(app));

  return app;
}
