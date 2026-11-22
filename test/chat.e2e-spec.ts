/**
 * ============================================================================
 *  Chat & Message e2e tests (REST)
 * ============================================================================
 *
 * Covers the REST endpoints for direct messages (DM):
 *   - POST /chat     : open a chat room with another user (or get the existing one)
 *   - GET  /chat     : the signed-in user's chat rooms, most recently active first
 *   - POST /message  : send a message to a room (participants only)
 *   - GET  /message  : the messages of a room (participants only)
 *
 * The real-time part (Socket.IO) is covered in chat-socket.e2e-spec.ts.
 *
 * The first block runs IN ORDER as one conversation between "sender" and
 * "receiver": open a room → open it again (same room) → send a message →
 * read it back. The second block covers edge cases and permissions.
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { bearer, createTestApp, resetDatabase, signIn } from './utils/test-app';

describe('Chat & Message (e2e)', () => {
  let app: NestExpressApplication;
  // The in-memory HTTP server that supertest sends requests to.
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  let senderToken: string;
  let receiverToken: string;
  // Filled in by the first test and reused by the following ones.
  let roomId: number;

  /** Opens (or gets) the chat room between the token's owner and `email`. */
  const openRoom = (token: string, email?: string) =>
    request(server)
      .post('/chat')
      .set(bearer(token))
      .send(email === undefined ? {} : { email });

  /** Sends a message as the token's owner. */
  const sendMessage = (token: string, body: object) =>
    request(server).post('/message').set(bearer(token)).send(body);

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    await resetDatabase(app);
    senderToken = await signIn(app, 'sender@gmail.com', 'Sender');
    receiverToken = await signIn(app, 'receiver@gmail.com', 'Receiver');
  });

  afterAll(async () => {
    await app.close();
  });

  describe('one conversation (in order)', () => {
    it('POST /chat creates a room with the receiver as chat partner', async () => {
      const res = await openRoom(senderToken, 'receiver@gmail.com').expect(201);

      roomId = res.body.id;
      expect(res.body).toMatchObject({
        id: expect.any(Number),
        // The room is named after the other person.
        name: 'Receiver',
        participants: ['sender@gmail.com', 'receiver@gmail.com'],
        // "chatPartner" is always the OTHER person, from the caller's point of view.
        chatPartner: { email: 'receiver@gmail.com', username: 'Receiver' },
      });
    });

    it('POST /chat returns the existing room for the same pair of users', async () => {
      // Opening a chat with the same person again must not create a second
      // room, no matter who opens it.
      const res = await openRoom(receiverToken, 'sender@gmail.com').expect(201);

      expect(res.body.id).toBe(roomId);
    });

    it('POST /message sends a message to the room', async () => {
      const res = await sendMessage(senderToken, {
        chatRoomId: roomId,
        content: 'Hi there',
        type: 'TEXT',
      }).expect(201);

      expect(res.body).toMatchObject({
        content: 'Hi there',
        type: 'TEXT',
        sender: { email: 'sender@gmail.com' },
      });
    });

    it('GET /message lists the messages of the room', async () => {
      // Read as the RECEIVER, to check the other participant can see the message.
      const res = await request(server)
        .get('/message')
        .query({ chatRoomId: roomId, page: 1, limit: 10 })
        .set(bearer(receiverToken))
        .expect(200);

      expect(res.body.total).toBe(1);
      expect(res.body.messages[0].content).toBe('Hi there');
    });

    it("GET /chat lists the receiver's rooms in the same shape as POST /chat", async () => {
      const res = await request(server)
        .get('/chat')
        .query({ page: 1, limit: 10 })
        .set(bearer(receiverToken))
        .expect(200);

      expect(res.body.total).toBe(1);
      // For the receiver, the chat partner (and the room name) is the sender.
      // `name` and `participants` used to be missing from list items.
      expect(res.body.list[0]).toMatchObject({
        id: roomId,
        name: 'Sender',
        participants: ['receiver@gmail.com', 'sender@gmail.com'],
        latestMessage: 'Hi there',
        chatPartner: { email: 'sender@gmail.com' },
      });
    });
  });

  describe('edge cases and permissions', () => {
    it('returns 404 when opening a room with an unknown user', async () => {
      // Previously the server crashed reading `receiver.email` of null → 500.
      await openRoom(senderToken, 'nobody@gmail.com').expect(404);
    });

    it('rejects opening a room with yourself', async () => {
      await openRoom(senderToken, 'sender@gmail.com').expect(400);
    });

    it('rejects opening a room without a valid email', async () => {
      await openRoom(senderToken).expect(400);
      await openRoom(senderToken, 'not-an-email').expect(400);
    });

    it("does not let outsiders read a room's messages", async () => {
      // Previously ANY signed-in user could read any room by guessing its id.
      // Outsiders get 404 so they cannot even tell whether the room exists.
      const outsiderToken = await signIn(app, 'outsider@gmail.com');

      await request(server)
        .get('/message')
        .query({ chatRoomId: roomId, page: 1, limit: 10 })
        .set(bearer(outsiderToken))
        .expect(404);
    });

    it('does not let outsiders send messages to a room', async () => {
      const outsiderToken = await signIn(app, 'outsider@gmail.com');

      await sendMessage(outsiderToken, {
        chatRoomId: roomId,
        content: 'spam',
        type: 'TEXT',
      }).expect(404);
    });

    it('returns 404 for an unknown room', async () => {
      // Previously `chatRoom.updatedAt` was read from null → 500.
      await sendMessage(senderToken, {
        chatRoomId: 999999,
        content: 'hello?',
        type: 'TEXT',
      }).expect(404);
    });

    it('rejects invalid messages', async () => {
      const valid = { chatRoomId: roomId, content: 'ok', type: 'TEXT' };

      await sendMessage(senderToken, { ...valid, content: '' }).expect(400);
      await sendMessage(senderToken, { ...valid, type: 'VIDEO' }).expect(400);
      await sendMessage(senderToken, { ...valid, chatRoomId: 'abc' }).expect(
        400,
      );
    });

    it('lists the most recently active room first', async () => {
      // A second room for "sender", then a new message in the FIRST room:
      // the first room must move back to the top.
      await signIn(app, 'friend@gmail.com', 'Friend');
      const friendRoom = await openRoom(senderToken, 'friend@gmail.com').expect(
        201,
      );
      await sendMessage(senderToken, {
        chatRoomId: friendRoom.body.id,
        content: 'hi friend',
        type: 'TEXT',
      }).expect(201);
      await sendMessage(senderToken, {
        chatRoomId: roomId,
        content: 'back to you',
        type: 'TEXT',
      }).expect(201);

      const res = await request(server)
        .get('/chat')
        .query({ page: 1, limit: 10 })
        .set(bearer(senderToken))
        .expect(200);

      expect(res.body.list.map((room) => room.latestMessage)).toEqual([
        'back to you',
        'hi friend',
      ]);
    });
  });
});
