import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostModule } from './post/post.module';
import { typeORMConfig } from './configs/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { ChatGateway } from './chat/gateway/chat.gateway';
import { ChatController } from './chat/chat.controller';
import { UserModule } from './user/user.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeORMConfig),
    PostModule,
    AuthModule,
    UserModule,
  ],
  providers: [ChatGateway],
  controllers: [ChatController],
})
export class AppModule {}
