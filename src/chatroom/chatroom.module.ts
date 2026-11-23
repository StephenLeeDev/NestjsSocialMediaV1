/**
 * Wires the chat room feature together: REST controller, Socket.IO gateway,
 * service and repository.
 *
 * Exports:
 *   - ChatRoomService → MessageService uses the participant rule
 *   - ChatGateway     → MessageService pushes new messages to the room
 *
 * Imports AuthModule for the JWT guard (REST) and JwtService (socket handshake).
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { UserRepository } from '../user/user.repository';
import { ChatRoomController } from './chatroom.controller';
import { ChatRoomRepository } from './chatroom.repository';
import { ChatRoomService } from './chatroom.service';
import { ChatGateway } from './gateway/chat.gateway';

@Module({
  imports: [AuthModule],
  controllers: [ChatRoomController],
  providers: [
    ChatRoomService,
    ChatRoomRepository,
    ChatGateway,
    // Loads chat partners (service) and the socket's user (gateway).
    UserRepository,
  ],
  exports: [ChatRoomService, ChatGateway],
})
export class ChatModule {}
