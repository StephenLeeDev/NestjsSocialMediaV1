/**
 * ============================================================================
 *  MessageService unit tests
 * ============================================================================
 *
 * MessageService is built with FAKE dependencies. The important rule: nothing
 * is saved, updated or pushed to sockets unless the sender is a participant.
 *
 * Run with: npm test
 */
import { NotFoundException } from '@nestjs/common';
import { ChatRoomService } from '../chatroom/chatroom.service';
import { ChatGateway } from '../chatroom/gateway/chat.gateway';
import { User } from '../user/user.entity';
import { MessageType } from './message-type';
import { MessageRepository } from './message.repository';
import { MessageService } from './message.service';

const ME = 'me@gmail.com';

/** Builds a user with the fields the mapper reads. */
function makeUser(email: string): User {
  return {
    email,
    username: email.split('@')[0],
    thumbnail: 'thumb.png',
    statusMessage: 'hi',
  } as User;
}

describe('MessageService', () => {
  let messageRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findPage: jest.Mock;
  };
  let chatRoomService: {
    assertParticipant: jest.Mock;
    markActivity: jest.Mock;
  };
  let chatGateway: { emitNewMessage: jest.Mock };
  let service: MessageService;

  const dto = { chatRoomId: 13, content: 'hello', type: MessageType.TEXT };

  beforeEach(() => {
    messageRepository = {
      // `create` returns what it was given, like TypeORM does.
      create: jest.fn((data) => data),
      // `save` pretends the database assigned id 7.
      save: jest.fn(async (m) => Object.assign(m, { id: 7 })),
      findPage: jest.fn(),
    };
    // By default the sender is a participant.
    chatRoomService = {
      assertParticipant: jest.fn().mockResolvedValue(undefined),
      markActivity: jest.fn(),
    };
    chatGateway = { emitNewMessage: jest.fn() };

    service = new MessageService(
      messageRepository as unknown as MessageRepository,
      chatRoomService as unknown as ChatRoomService,
      chatGateway as unknown as ChatGateway,
    );
  });

  describe('sendMessage', () => {
    it('saves the message, updates the room and pushes it to the room', async () => {
      const result = await service.sendMessage(makeUser(ME), dto);

      expect(chatRoomService.assertParticipant).toHaveBeenCalledWith(13, ME);
      expect(messageRepository.save).toHaveBeenCalledTimes(1);
      expect(chatRoomService.markActivity).toHaveBeenCalledWith(
        13,
        expect.any(Date),
      );
      // The SAME object is returned to the sender and pushed to the room.
      expect(chatGateway.emitNewMessage).toHaveBeenCalledWith(13, result);
      expect(result).toMatchObject({
        id: 7,
        chatRoomId: 13,
        content: 'hello',
        type: MessageType.TEXT,
        sender: { email: ME },
      });
    });

    it('does nothing at all for a non-participant (404)', async () => {
      chatRoomService.assertParticipant.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.sendMessage(makeUser(ME), dto),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(messageRepository.save).not.toHaveBeenCalled();
      expect(chatRoomService.markActivity).not.toHaveBeenCalled();
      expect(chatGateway.emitNewMessage).not.toHaveBeenCalled();
    });
  });

  describe('getMessages', () => {
    it('checks participation before reading', async () => {
      chatRoomService.assertParticipant.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.getMessages(makeUser(ME), 13, 1, 10),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(messageRepository.findPage).not.toHaveBeenCalled();
    });

    it('maps the page with the room id', async () => {
      messageRepository.findPage.mockResolvedValue([
        [{ id: 1, content: 'hi', type: 'TEXT', sender: makeUser(ME) }],
        1,
      ]);

      await expect(
        service.getMessages(makeUser(ME), 13, 1, 10),
      ).resolves.toMatchObject({
        messages: [{ id: 1, chatRoomId: 13, sender: { email: ME } }],
        total: 1,
      });
    });
  });
});
