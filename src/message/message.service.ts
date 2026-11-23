/**
 * ============================================================================
 *  MessageService: the business rules for direct messages
 * ============================================================================
 *
 *   MessageController  → HTTP only
 *        │
 *   MessageService     → rules (THIS FILE)
 *        │               - only participants may read or send (ChatRoomService)
 *        │               - a sent message is saved, the room's activity time is
 *        │                 updated, and the message is pushed to the room's
 *        │                 sockets (ChatGateway)
 *        │
 *   MessageRepository  → database queries only
 *   message.mapper.ts  → entity → response DTO
 *
 * Before this refactor ANY signed-in user could read or post into ANY room by
 * guessing its id, because nothing checked participation.
 */
import { Injectable } from '@nestjs/common';
import { ChatRoomService } from '../chatroom/chatroom.service';
import { ChatGateway } from '../chatroom/gateway/chat.gateway';
import { currentSeoulTimestamp } from '../common/utils/date.util';
import { User } from '../user/user.entity';
import { CreateMessageDto } from './dto/create-message.dto';
import { MessageInfoDto, MessageInfoListDto } from './dto/message-info.dto';
import { toMessageInfoDto } from './message.mapper';
import { MessageRepository } from './message.repository';

@Injectable()
export class MessageService {
  constructor(
    private readonly messageRepository: MessageRepository,
    // Owns the participant rule and the room's activity time.
    private readonly chatRoomService: ChatRoomService,
    // Delivers saved messages in real time.
    private readonly chatGateway: ChatGateway,
  ) {}

  /**
   * Sends a message to a room the sender participates in.
   *
   * Steps:
   *   1. check participation (404 for unknown rooms and other people's rooms)
   *   2. save the message
   *   3. move the room's "last activity" time forward (room list order)
   *   4. push the message to the sockets that joined the room
   *
   * @throws NotFoundException (404) when the sender is not a participant.
   */
  async sendMessage(
    sender: User,
    { chatRoomId, content, type }: CreateMessageDto,
  ): Promise<MessageInfoDto> {
    await this.chatRoomService.assertParticipant(chatRoomId, sender.email);

    // createdAt and updatedAt start out identical.
    const now = new Date(currentSeoulTimestamp()); // see common/utils/date.util.ts
    const message = this.messageRepository.create({
      content,
      type,
      chatRoom: { id: chatRoomId },
      sender,
      createdAt: now,
      updatedAt: now,
    });
    await this.messageRepository.save(message);

    // Awaited now: the old code forgot `await` here, so the room order could
    // be updated after the response, or silently fail.
    await this.chatRoomService.markActivity(chatRoomId, now);

    const dto = toMessageInfoDto(message, chatRoomId);
    this.chatGateway.emitNewMessage(chatRoomId, dto);
    return dto;
  }

  /**
   * One page of a room's messages, newest first.
   *
   * @throws NotFoundException (404) when the viewer is not a participant.
   */
  async getMessages(
    viewer: User,
    chatRoomId: number,
    page: number,
    limit: number,
  ): Promise<MessageInfoListDto> {
    await this.chatRoomService.assertParticipant(chatRoomId, viewer.email);

    const [messages, total] = await this.messageRepository.findPage(
      chatRoomId,
      page,
      limit,
    );
    return {
      messages: messages.map((message) =>
        toMessageInfoDto(message, chatRoomId),
      ),
      total,
    };
  }
}
