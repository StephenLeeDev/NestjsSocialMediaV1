import { Module } from "@nestjs/common";
import { ChatRoomRepository } from "./chatroom.repository";
import { ChatRoomService } from './chatroom.service';
import { ChatRoomController } from './chatroom.controller';
import { UserRepository } from "../user/user.repository";
import { AuthModule } from "../auth/auth.module";
import { UserChatRoomRepository } from "./user-chatroom.repository";
import { MessageRepository } from "../message/message.repository";

@Module({
    imports: [
      AuthModule,
    ],
    controllers: [ChatRoomController],
    providers: [ChatRoomService, ChatRoomRepository, UserRepository, UserChatRoomRepository, MessageRepository]
  })
  export class ChatModule {}