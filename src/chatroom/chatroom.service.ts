import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ChatRoomRepository } from './chatroom.repository';
import { UserRepository } from 'src/user/user.repository';
import { User } from 'src/user/user.entity';
import { ChatRoomDto } from './dto/chatroom.dto';
import { UserChatRoomRepository } from './user-chatroom.repository';
import * as moment from 'moment-timezone';

@Injectable()
export class ChatRoomService {
    constructor(
        @InjectRepository(ChatRoomRepository)
        private chatRoomRepository: ChatRoomRepository,
        @InjectRepository(UserRepository)
        private userRepository: UserRepository,
        @InjectRepository(UserChatRoomRepository)
        private userChatRepository: UserChatRoomRepository,
    ) { }

    async createChatRoom(sender: User, receiverEmail: string): Promise<ChatRoomDto> {
        const receiver = await this.userRepository.findOne({ email: receiverEmail });
        // return await this.chatRepository.createChatRoom(sender, receiver);

        const found = await this.userChatRepository.findChatRoomByParticipants(sender, receiver);

        /// The chatroom already exists
        /// Return this directly
        if (found) {
            var room = new ChatRoomDto();
            room.name = receiver.username;
            room.participants = [sender, receiver];
            room.createdAt = found.createdAt;
            room.updatedAt = found.updatedAt;
            return room;
        }
        /// The chatroom doesn't exists
        /// Create it first, and then return
        else {
            const createdAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss.SSS'); // You can set your time zone here
            
            let chatroom = this.chatRoomRepository.create({
                createdAt,
                updatedAt: createdAt,
            });
            await this.chatRoomRepository.save(chatroom);

            const senderUserChatroom = this.userChatRepository.create({
                user: sender,
                chatRoom: chatroom,
            });

            const receiverUserChatroom = this.userChatRepository.create({
                user: receiver,
                chatRoom: chatroom,
            });

            chatroom.userChatRooms = [senderUserChatroom, receiverUserChatroom];

            await this.userChatRepository.save(senderUserChatroom);
            await this.userChatRepository.save(receiverUserChatroom);

            var room = new ChatRoomDto();
            room.name = receiver.username;
            room.participants = [sender, receiver];
            room.createdAt = room.createdAt;
            room.updatedAt = room.updatedAt;
            return room;
        }
    }

}
