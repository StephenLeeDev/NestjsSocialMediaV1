import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostModule } from './post/post.module';
import { typeORMConfig } from './configs/typeorm.config';
import { AuthModule } from './auth/auth.module';
import { ChatGateway } from './chatroom/gateway/chat.gateway';
import { UserModule } from './user/user.module';
import { ConfigModule } from '@nestjs/config';
import { CommentModule } from './comment/comment.module';
import { FollowModule } from './follow/follow.module';
import { ChatModule } from './chatroom/chatroom.module';
import { MessageModule } from './message/message.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(typeORMConfig),
    AuthModule,
    UserModule,
    PostModule,
    CommentModule,
    ChatModule,
    MessageModule,
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    FollowModule,
  ],
  providers: [ChatGateway],
})
export class AppModule {}
