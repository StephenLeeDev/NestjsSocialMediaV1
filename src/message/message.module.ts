import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatRoomRepository } from 'src/chatroom/chatroom.repository';
import { MessageRepository } from './message.repository';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatRoomRepository,
      MessageRepository,
    ]),
    AuthModule,
  ],
  controllers: [MessageController],
  providers: [MessageService]
})
export class MessageModule {}
