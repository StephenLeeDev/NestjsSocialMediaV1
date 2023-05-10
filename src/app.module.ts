import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BoardsModule } from './boards/boards.module';
import { typeORMConfig } from './configs/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { ChatGateway } from './chat/gateway/chat.gateway';
import { ChatController } from './chat/chat.controller';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeORMConfig),
    BoardsModule,
    AuthModule,
  ],
  providers: [ChatGateway],
  controllers: [ChatController],
})
export class AppModule {}
