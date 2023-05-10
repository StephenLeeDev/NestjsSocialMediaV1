import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { SocketIoAdapter } from './chat/socket-io.adapters';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const port = 3001;
  app.useStaticAssets(join(__dirname, '..', 'static'));
  app.useWebSocketAdapter(new SocketIoAdapter(app));
  await app.listen(port);
  Logger.log(`Application running on port ${port}`);
}
bootstrap();
