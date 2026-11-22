/**
 * ============================================================================
 *  ChatRoomService: the business rules for direct-message rooms
 * ============================================================================
 *
 * Layering (same pattern as the other modules):
 *
 *   ChatRoomController / ChatGateway  → HTTP / WebSocket only
 *        │
 *   ChatRoomService                   → rules (THIS FILE)
 *        │                              - the partner must exist (404), not be you (400)
 *        │                              - one room per pair of users
 *        │                              - ONLY participants may use a room
 *        │                                (assertParticipant / isParticipant)
 *        │
 *   ChatRoomRepository                → database queries only
 *
 * The participant rule is used by THREE callers: this service, MessageService
 * (reading / sending messages) and ChatGateway (joining a socket room). It lives
 * here only, and ChatModule exports this service, so it cannot drift apart.
 */
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { currentSeoulTimestamp } from '../common/utils/date.util';
import { User } from '../user/user.entity';
import { toUserSummaryDto } from '../user/user.mapper';
import { UserRepository } from '../user/user.repository';
import { ChatRoomEntity } from './chatroom.entity';
import { ChatRoomRepository } from './chatroom.repository';
import { ChatRoomDto, ChatRoomListDto } from './dto/chatroom.dto';

@Injectable()
export class ChatRoomService {
  constructor(
    private readonly chatRoomRepository: ChatRoomRepository,
    // Only used to load the chat partner when opening a room.
    private readonly userRepository: UserRepository,
  ) {}

  // ==========================================================================
  //  Rooms
  // ==========================================================================

  /**
   * Opens the direct-message room between the viewer and `partnerEmail`, or
   * returns the existing one. There is never more than one room per pair.
   *
   * @throws BadRequestException (400) when opening a room with yourself.
   * @throws NotFoundException   (404) when the partner does not exist.
   *         (Previously the server crashed on the missing user → 500.)
   */
  async openRoom(viewer: User, partnerEmail: string): Promise<ChatRoomDto> {
    if (partnerEmail === viewer.email) {
      throw new BadRequestException('You cannot open a chat with yourself');
    }

    const partner = await this.userRepository.findOneBy({
      email: partnerEmail,
    });
    if (!partner) {
      throw new NotFoundException(`User not found`);
    }

    const room = await this.chatRoomRepository.findOrCreateRoomBetween(
      viewer.email,
      partner.email,
      this.now(),
    );

    // The response does not include the latest message (as before); the
    // room list shows it.
    return this.toChatRoomDto(room, viewer, partner, '');
  }

  /**
   * One page of the viewer's rooms, most recently active first.
   * (Three queries in total; see ChatRoomRepository.findRoomsPage.)
   */
  async getRooms(
    viewer: User,
    page: number,
    limit: number,
  ): Promise<ChatRoomListDto> {
    const [rooms, total] = await this.chatRoomRepository.findRoomsPage(
      viewer.email,
      page,
      limit,
    );

    return {
      list: rooms
        // A room without a partner can only come from broken data; it cannot
        // be shown meaningfully, so it is skipped instead of crashing.
        .filter(({ partner }) => partner !== null)
        .map(({ room, partner, latestMessage }) =>
          this.toChatRoomDto(room, viewer, partner as User, latestMessage),
        ),
      total,
    };
  }

  // ==========================================================================
  //  The participant rule (also used by MessageService and ChatGateway)
  // ==========================================================================

  /** Whether `email` is a participant of room `chatRoomId`. */
  async isParticipant(chatRoomId: number, email: string): Promise<boolean> {
    return this.chatRoomRepository.isParticipant(chatRoomId, email);
  }

  /**
   * Throws unless `email` is a participant of room `chatRoomId`.
   *
   * Unknown rooms and other people's rooms both answer 404, so outsiders
   * cannot even find out which room ids exist.
   *
   * @throws NotFoundException (404)
   */
  async assertParticipant(chatRoomId: number, email: string): Promise<void> {
    if (!(await this.isParticipant(chatRoomId, email))) {
      throw new NotFoundException(`Can't find chat room with id ${chatRoomId}`);
    }
  }

  /** Records activity in a room (e.g. a new message) for the room order. */
  async markActivity(chatRoomId: number, at: Date): Promise<void> {
    await this.chatRoomRepository.touch(chatRoomId, at);
  }

  // ==========================================================================
  //  Private helpers
  // ==========================================================================

  /**
   * Builds the response for one room as seen by `viewer`. Used by BOTH
   * endpoints, so creating and listing rooms return the same shape.
   */
  private toChatRoomDto(
    room: ChatRoomEntity,
    viewer: User,
    partner: User,
    latestMessage: string,
  ): ChatRoomDto {
    const dto = new ChatRoomDto();
    dto.id = room.id;
    // A direct message room is named after the other person.
    dto.name = partner.username;
    dto.latestMessage = latestMessage;
    // The viewer first, then the partner.
    dto.participants = [viewer.email, partner.email];
    dto.chatPartner = toUserSummaryDto(partner);
    dto.createdAt = room.createdAt;
    dto.updatedAt = room.updatedAt;
    return dto;
  }

  /** The current time as stored in chat timestamps (Seoul local time). */
  private now(): Date {
    // See common/utils/date.util.ts for why timestamps are stored this way.
    return new Date(currentSeoulTimestamp());
  }
}
