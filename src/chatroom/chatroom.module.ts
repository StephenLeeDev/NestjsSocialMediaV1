import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ChatRoomRepository } from "./chatroom.repository";
import { ChatRoomService } from './chatroom.service';
import { ChatRoomController } from './chatroom.controller';
import { UserRepository } from "src/user/user.repository";
import { AuthModule } from "src/auth/auth.module";
import { UserChatRoomRepository } from "./user-chatroom.repository";

@Module({
    imports: [
      TypeOrmModule.forFeature([
        ChatRoomRepository,
        UserRepository,
        UserChatRoomRepository,
      ]),
      AuthModule,
    ],
    controllers: [ChatRoomController],
    providers: [ChatRoomService]
  })
  export class ChatModule {}