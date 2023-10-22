import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ChatRoomRepository } from './chatroom.repository';
import { UserRepository } from 'src/user/user.repository';
import { User } from 'src/user/user.entity';
import { ChatRoomDto, ChatRoomListDto } from './dto/chatroom.dto';
import { UserChatRoomRepository } from './user-chatroom.repository';
import * as moment from 'moment-timezone';
import { MessageRepository } from 'src/message/message.repository';
import { UserSimpleInfoIncludingStatusMessageDto } from 'src/user/dto/user-simple-info-including-status-message.dto';

@Injectable()
export class ChatRoomService {
    constructor(
        @InjectRepository(ChatRoomRepository)
        private chatRoomRepository: ChatRoomRepository,
        @InjectRepository(UserRepository)
        private userRepository: UserRepository,
        @InjectRepository(UserChatRoomRepository)
        private userChatRepository: UserChatRoomRepository,
        @InjectRepository(MessageRepository)
        private messageRepository: MessageRepository,
    ) { }

    async createChatRoom(sender: User, receiverEmail: string): Promise<ChatRoomDto> {
        const receiver = await this.userRepository.findOne({ email: receiverEmail });

        const found = await this.userChatRepository.findChatRoomByParticipants(sender, receiver);

        /// The chatroom already exists
        /// Return this directly
        if (found) {
            var room = new ChatRoomDto();
            room.id = found.id;
            room.name = receiver.username;
            room.participants = [sender.email, receiverEmail];
            room.chatPartner = new UserSimpleInfoIncludingStatusMessageDto;
            room.chatPartner.email = receiverEmail;
            room.chatPartner.username = receiver.username;
            room.chatPartner.thumbnail = receiver.thumbnail;
            room.chatPartner.statusMessage = receiver.statusMessage;
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
            room.id = chatroom.id;
            room.name = receiver.username;
            room.participants = [sender.email, receiverEmail];
            room.chatPartner = new UserSimpleInfoIncludingStatusMessageDto;
            room.chatPartner.email = receiverEmail;
            room.chatPartner.username = receiver.username;
            room.chatPartner.thumbnail = receiver.thumbnail;
            room.chatPartner.statusMessage = receiver.statusMessage;
            room.createdAt = chatroom.createdAt;
            room.updatedAt = chatroom.updatedAt;
            return room;
        }
    }

    async getChatRoomList(user: User, page: number, limit: number): Promise<ChatRoomListDto> {
        var chatRooms = await this.userChatRepository.getChatRoomList(user, page, limit);

        /// Find latest message
        for (var chatRoomDto of chatRooms.list) {
            const latestMessage = await this.messageRepository.findLastMessageByChatRoomId(chatRoomDto.id);
            chatRoomDto.latestMessage = latestMessage;
        }

        /// Find chat partner
        for (var chatRoomDto of chatRooms.list) {
            const partner = await this.userChatRepository.findChatPartnerByChatRoomId(chatRoomDto.id, user);
            chatRoomDto.chatPartner = new UserSimpleInfoIncludingStatusMessageDto;
            chatRoomDto.chatPartner.email = partner.email;
            chatRoomDto.chatPartner.username = partner.username;
            chatRoomDto.chatPartner.thumbnail = partner.thumbnail;
            chatRoomDto.chatPartner.statusMessage = partner.statusMessage;
        }

        return chatRooms;
    }

}
