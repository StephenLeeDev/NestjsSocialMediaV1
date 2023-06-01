import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { SocketIoAdapter } from './chat/socket-io.adapters';
import { DocumentBuilder, SwaggerCustomOptions, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {

  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const swaggerCustomOptions: SwaggerCustomOptions = {
    swaggerOptions: {
      persistAuthorization: true,
    },
  };
  
  const config = new DocumentBuilder()
    .setTitle('Swagger API')
    .setDescription('Swagger API Document')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header',}, 'Secret1234')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, swaggerCustomOptions);
  
  const configService = app.get(ConfigService);

  const port = configService.get('PORT');
  app.useStaticAssets(join(__dirname, '..', 'static'));
  app.useWebSocketAdapter(new SocketIoAdapter(app));
  await app.listen(port);
  Logger.log(`Application running on ${configService.get('SERVER_URL')}`);

}
bootstrap();
