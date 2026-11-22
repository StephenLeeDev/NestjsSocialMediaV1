/**
 * ============================================================================
 *  ChatRoomService unit tests
 * ============================================================================
 *
 * ChatRoomService is built with FAKE repositories, so only its own rules are
 * tested here (no database): who you may open a room with, the response shape
 * as seen by each participant, and the participant rule.
 *
 * Not covered here (needs a real database, see the e2e tests):
 *   - that the transaction + advisory lock really prevent duplicate rooms
 *   - the three-query room list itself
 *
 * Run with: npm test
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { User } from '../user/user.entity';
import { UserRepository } from '../user/user.repository';
import { ChatRoomEntity } from './chatroom.entity';
import { ChatRoomRepository } from './chatroom.repository';
import { ChatRoomService } from './chatroom.service';

const ME = 'me@gmail.com';
const FRIEND = 'friend@gmail.com';

/** Builds a user with the fields the service and the mappers read. */
function makeUser(email: string): User {
  return {
    email,
    username: email.split('@')[0],
    thumbnail: 'thumb.png',
    statusMessage: 'hi',
  } as User;
}

/** A room as the repository returns it. */
function makeRoom(id = 13): ChatRoomEntity {
  return {
    id,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
  } as ChatRoomEntity;
}

describe('ChatRoomService', () => {
  let chatRoomRepository: {
    findOrCreateRoomBetween: jest.Mock;
    findRoomsPage: jest.Mock;
    isParticipant: jest.Mock;
    touch: jest.Mock;
  };
  let userRepository: { findOneBy: jest.Mock };
  let service: ChatRoomService;

  beforeEach(() => {
    chatRoomRepository = {
      findOrCreateRoomBetween: jest.fn().mockResolvedValue(makeRoom()),
      findRoomsPage: jest.fn(),
      isParticipant: jest.fn(),
      touch: jest.fn(),
    };
    // By default the partner exists.
    userRepository = {
      findOneBy: jest.fn().mockResolvedValue(makeUser(FRIEND)),
    };

    service = new ChatRoomService(
      chatRoomRepository as unknown as ChatRoomRepository,
      userRepository as unknown as UserRepository,
    );
  });

  describe('openRoom', () => {
    it('returns the room named after the partner, viewer first in participants', async () => {
      const room = await service.openRoom(makeUser(ME), FRIEND);

      expect(chatRoomRepository.findOrCreateRoomBetween).toHaveBeenCalledWith(
        ME,
        FRIEND,
        expect.any(Date),
      );
      expect(room).toMatchObject({
        id: 13,
        name: 'friend',
        latestMessage: '',
        participants: [ME, FRIEND],
        chatPartner: { email: FRIEND, statusMessage: 'hi' },
      });
    });

    it('rejects a room with yourself (400) without touching the database', async () => {
      await expect(service.openRoom(makeUser(ME), ME)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(chatRoomRepository.findOrCreateRoomBetween).not.toHaveBeenCalled();
    });

    it('rejects an unknown partner (404)', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(
        service.openRoom(makeUser(ME), FRIEND),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(chatRoomRepository.findOrCreateRoomBetween).not.toHaveBeenCalled();
    });
  });

  describe('getRooms', () => {
    it('maps every room with its partner and latest message', async () => {
      chatRoomRepository.findRoomsPage.mockResolvedValue([
        [
          {
            room: makeRoom(1),
            partner: makeUser(FRIEND),
            latestMessage: 'hey',
          },
        ],
        1,
      ]);

      const result = await service.getRooms(makeUser(ME), 1, 10);

      expect(result.total).toBe(1);
      expect(result.list[0]).toMatchObject({
        id: 1,
        name: 'friend',
        latestMessage: 'hey',
        participants: [ME, FRIEND],
      });
    });

    it('skips a room without a partner instead of crashing', async () => {
      chatRoomRepository.findRoomsPage.mockResolvedValue([
        [{ room: makeRoom(1), partner: null, latestMessage: '' }],
        1,
      ]);

      const result = await service.getRooms(makeUser(ME), 1, 10);

      expect(result.list).toEqual([]);
    });
  });

  describe('assertParticipant', () => {
    it('passes for a participant', async () => {
      chatRoomRepository.isParticipant.mockResolvedValue(true);

      await expect(service.assertParticipant(13, ME)).resolves.toBeUndefined();
    });

    it('throws 404 for everyone else (room existence is not revealed)', async () => {
      chatRoomRepository.isParticipant.mockResolvedValue(false);

      await expect(service.assertParticipant(13, ME)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
