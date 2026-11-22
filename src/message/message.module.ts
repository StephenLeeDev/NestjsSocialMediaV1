/**
 * Wires the message feature together.
 *
 * Imports ChatModule for ChatRoomService (the participant rule and the room's
 * activity time) and ChatGateway (real-time delivery). Imports AuthModule for
 * the JWT guard on the REST endpoints.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ChatModule } from '../chatroom/chatroom.module';
import { MessageController } from './message.controller';
import { MessageRepository } from './message.repository';
import { MessageService } from './message.service';

@Module({
  imports: [AuthModule, ChatModule],
  controllers: [MessageController],
  providers: [MessageService, MessageRepository],
})
export class MessageModule {}
