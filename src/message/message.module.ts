import { Module } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { ChatRoomRepository } from '../chatroom/chatroom.repository';
import { MessageRepository } from './message.repository';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    AuthModule,
  ],
  controllers: [MessageController],
  providers: [MessageService, ChatRoomRepository, MessageRepository]
})
export class MessageModule {}
