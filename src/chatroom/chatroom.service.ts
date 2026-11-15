import { Injectable } from '@nestjs/common';
import { ChatRoomRepository } from './chatroom.repository';
import { UserRepository } from '../user/user.repository';
import { User } from '../user/user.entity';
import { ChatRoomDto, ChatRoomListDto } from './dto/chatroom.dto';
import { UserChatRoomRepository } from './user-chatroom.repository';
import { currentSeoulTimestamp } from '../common/utils/date.util';
import { MessageRepository } from '../message/message.repository';
import { UserSimpleInfoIncludingStatusMessageDto } from '../user/dto/user-simple-info-including-status-message.dto';

@Injectable()
export class ChatRoomService {
  constructor(
    private chatRoomRepository: ChatRoomRepository,
    private userRepository: UserRepository,
    private userChatRepository: UserChatRoomRepository,
    private messageRepository: MessageRepository,
  ) {}

  async createChatRoom(
    sender: User,
    receiverEmail: string,
  ): Promise<ChatRoomDto> {
    const receiver = await this.userRepository.findOneBy({
      email: receiverEmail,
    });

    const found = await this.userChatRepository.findChatRoomByParticipants(
      sender,
      receiver,
    );

    /// The chatroom already exists
    /// Return this directly
    if (found) {
      const room = new ChatRoomDto();
      room.id = found.id;
      room.name = receiver.username;
      room.participants = [sender.email, receiverEmail];
      room.chatPartner = new UserSimpleInfoIncludingStatusMessageDto();
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
      const createdAt = currentSeoulTimestamp(); // Seoul local time, see common/utils/date.util.ts

      const chatroom = this.chatRoomRepository.create({
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

      const room = new ChatRoomDto();
      room.id = chatroom.id;
      room.name = receiver.username;
      room.participants = [sender.email, receiverEmail];
      room.chatPartner = new UserSimpleInfoIncludingStatusMessageDto();
      room.chatPartner.email = receiverEmail;
      room.chatPartner.username = receiver.username;
      room.chatPartner.thumbnail = receiver.thumbnail;
      room.chatPartner.statusMessage = receiver.statusMessage;
      room.createdAt = chatroom.createdAt;
      room.updatedAt = chatroom.updatedAt;
      return room;
    }
  }

  async getChatRoomList(
    user: User,
    page: number,
    limit: number,
  ): Promise<ChatRoomListDto> {
    const chatRooms = await this.userChatRepository.getChatRoomList(
      user,
      page,
      limit,
    );

    /// Find latest message
    for (const chatRoomDto of chatRooms.list) {
      const latestMessage =
        await this.messageRepository.findLastMessageByChatRoomId(
          chatRoomDto.id,
        );
      chatRoomDto.latestMessage = latestMessage;
    }

    /// Find chat partner
    for (const chatRoomDto of chatRooms.list) {
      const partner = await this.userChatRepository.findChatPartnerByChatRoomId(
        chatRoomDto.id,
        user,
      );
      chatRoomDto.chatPartner = new UserSimpleInfoIncludingStatusMessageDto();
      chatRoomDto.chatPartner.email = partner.email;
      chatRoomDto.chatPartner.username = partner.username;
      chatRoomDto.chatPartner.thumbnail = partner.thumbnail;
      chatRoomDto.chatPartner.statusMessage = partner.statusMessage;
    }

    return chatRooms;
  }
}
