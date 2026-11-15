/**
 * ============================================================================
 *  Chat & Message e2e tests
 * ============================================================================
 *
 * Covers the REST endpoints for direct messages (DM):
 *   - POST /chat     : open a chat room with another user (or get the existing one)
 *   - GET  /chat     : the signed-in user's chat rooms
 *   - POST /message  : send a message to a room
 *   - GET  /message  : the messages of a room
 *
 * Not covered here: the real-time Socket.IO gateway (`ChatGateway`). It is not
 * used by the Flutter app yet and needs a socket client to test.
 *
 * The tests run IN ORDER as one conversation between "sender" and "receiver":
 * open a room → open it again (same room) → send a message → read it back.
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

  it('POST /chat creates a room with the receiver as chat partner', async () => {
    const res = await request(server)
      .post('/chat')
      .set(bearer(senderToken))
      .send({ email: 'receiver@gmail.com' })
      .expect(201);

    roomId = res.body.id;
    expect(res.body).toMatchObject({
      id: expect.any(Number),
      participants: ['sender@gmail.com', 'receiver@gmail.com'],
      // "chatPartner" is always the OTHER person, from the caller's point of view.
      chatPartner: { email: 'receiver@gmail.com', username: 'Receiver' },
    });
  });

  it('POST /chat returns the existing room for the same pair of users', async () => {
    // Opening a chat with the same person again must not create a second room.
    const res = await request(server)
      .post('/chat')
      .set(bearer(senderToken))
      .send({ email: 'receiver@gmail.com' })
      .expect(201);

    expect(res.body.id).toBe(roomId);
  });

  it('POST /message sends a message to the room', async () => {
    // `chatRoomId` is sent as a STRING because that is what `CreateMessageDto`
    // declares (and what a client would send); the server converts it.
    const res = await request(server)
      .post('/message')
      .set(bearer(senderToken))
      .send({ chatRoomId: String(roomId), content: 'Hi there', type: 'TEXT' })
      .expect(201);

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

  it("GET /chat lists the receiver's rooms with the latest message", async () => {
    const res = await request(server)
      .get('/chat')
      .query({ page: 1, limit: 10 })
      .set(bearer(receiverToken))
      .expect(200);

    expect(res.body.total).toBe(1);
    // For the receiver, the chat partner is the sender.
    expect(res.body.list[0]).toMatchObject({
      id: roomId,
      latestMessage: 'Hi there',
      chatPartner: { email: 'sender@gmail.com' },
    });
  });
});
