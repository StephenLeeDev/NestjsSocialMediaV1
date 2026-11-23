/**
 * ============================================================================
 *  ChatGateway unit tests
 * ============================================================================
 *
 * The connection-level behaviour (refusing sockets without a valid JWT,
 * delivering only to the right room) needs a real Socket.IO server and is
 * covered by test/chat-socket.e2e-spec.ts.
 *
 * These unit tests cover the decisions inside the handlers, using a fake
 * socket object: when is a socket allowed to join a room, and which
 * Socket.IO room name does it join.
 *
 * Run with: npm test
 */
import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { User } from '../../user/user.entity';
import { UserRepository } from '../../user/user.repository';
import { ChatRoomService } from '../chatroom.service';
import { ChatGateway, socketRoomName } from './chat.gateway';

describe('ChatGateway', () => {
  let chatRoomService: { isParticipant: jest.Mock };
  let socket: { data: { user: User }; join: jest.Mock; leave: jest.Mock };
  let gateway: ChatGateway;

  beforeEach(() => {
    chatRoomService = { isParticipant: jest.fn() };
    // A fake socket that was already authenticated as "me".
    socket = {
      data: { user: { email: 'me@gmail.com' } as User },
      join: jest.fn(),
      leave: jest.fn(),
    };

    gateway = new ChatGateway(
      {} as JwtService, // only used by the connection middleware
      {} as UserRepository, // only used by the connection middleware
      chatRoomService as unknown as ChatRoomService,
    );
  });

  describe('joinRoom', () => {
    it('joins the Socket.IO room of a chat room the user is in', async () => {
      chatRoomService.isParticipant.mockResolvedValue(true);

      await expect(
        gateway.joinRoom(socket as unknown as Socket, { chatRoomId: 13 }),
      ).resolves.toEqual({ ok: true });

      expect(chatRoomService.isParticipant).toHaveBeenCalledWith(
        13,
        'me@gmail.com',
      );
      expect(socket.join).toHaveBeenCalledWith(socketRoomName(13));
    });

    it('refuses a chat room the user is not in', async () => {
      chatRoomService.isParticipant.mockResolvedValue(false);

      await expect(
        gateway.joinRoom(socket as unknown as Socket, { chatRoomId: 13 }),
      ).resolves.toMatchObject({ ok: false });
      expect(socket.join).not.toHaveBeenCalled();
    });

    it('refuses an id that is not a whole number without asking the database', async () => {
      await expect(
        gateway.joinRoom(socket as unknown as Socket, { chatRoomId: 'abc' }),
      ).resolves.toMatchObject({ ok: false });
      expect(chatRoomService.isParticipant).not.toHaveBeenCalled();
    });
  });

  it('uses a prefixed room name so chat rooms cannot collide with socket ids', () => {
    expect(socketRoomName(13)).toBe('chat-room:13');
  });
});
