import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostModule } from './post/post.module';
import { typeORMConfig } from './configs/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { ChatGateway } from './chat/gateway/chat.gateway';
import { ChatController } from './chat/chat.controller';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { CommentModule } from './comment/comment.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeORMConfig),
    AuthModule,
    UserModule,
    PostModule,
    CommentModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  providers: [ChatGateway],
  controllers: [ChatController],
})
export class AppModule {}
