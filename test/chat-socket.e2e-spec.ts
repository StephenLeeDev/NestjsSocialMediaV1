/**
 * ============================================================================
 *  Chat real-time (Socket.IO) e2e tests
 * ============================================================================
 *
 * How the real-time chat is meant to work:
 *
 *   1. Connect with a JWT:  io(url, { auth: { token } })
 *      → connections without a valid token are refused ("connect_error").
 *   2. Join a room:         socket.emitWithAck('joinRoom', { chatRoomId })
 *      → only participants of that chat room are let in.
 *   3. Messages are SENT over REST (POST /message), where they are validated,
 *      permission-checked and saved. The server then pushes them as a
 *      'newMessage' event to the sockets in that room, and nowhere else.
 *
 * Unlike the REST tests, Socket.IO needs a real network port, so this file
 * starts the app with `app.listen(0)` (0 = "any free port").
 */
import { NestExpressApplication } from '@nestjs/platform-express';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { bearer, createTestApp, resetDatabase, signIn } from './utils/test-app';

describe('Chat real-time (e2e)', () => {
  let app: NestExpressApplication;
  let server: ReturnType<NestExpressApplication['getHttpServer']>;
  // e.g. "http://[::1]:53412", the address the app listens on.
  let url: string;
  // Every socket opened by a test, so they can all be closed afterwards.
  const sockets: Socket[] = [];

  let aliceToken: string;
  let bobToken: string;
  let carolToken: string;
  // Alice ↔ Bob. Carol is NOT part of this room.
  let aliceBobRoomId: number;
  // Carol ↔ Bob, a second room used to prove messages stay in their room.
  let carolBobRoomId: number;

  /**
   * Connects a Socket.IO client and resolves once the server accepted it.
   * Rejects with the server's error when the connection is refused.
   */
  function connect(token?: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = io(url, {
        // The JWT travels in the handshake's `auth` payload.
        auth: token === undefined ? {} : { token },
        // Plain WebSocket, no HTTP long-polling fallback: faster and simpler in tests.
        transports: ['websocket'],
        // A refused test connection should fail once, not retry forever.
        reconnection: false,
      });
      sockets.push(socket);
      socket.on('connect', () => resolve(socket));
      socket.on('connect_error', (error) => reject(error));
    });
  }

  /**
   * Resolves with the next `event` the socket receives, or with `null` if
   * nothing arrives within `ms` milliseconds (used to prove "nothing came").
   */
  function nextEvent<T>(socket: Socket, event: string, ms = 1000) {
    return new Promise<T | null>((resolve) => {
      const timer = setTimeout(() => resolve(null), ms);
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    // Socket.IO needs a real port (supertest alone works without one).
    await app.listen(0);
    url = await app.getUrl();
    server = app.getHttpServer();
    await resetDatabase(app);

    aliceToken = await signIn(app, 'alice@gmail.com', 'Alice');
    bobToken = await signIn(app, 'bob@gmail.com', 'Bob');
    carolToken = await signIn(app, 'carol@gmail.com', 'Carol');

    aliceBobRoomId = (
      await request(server)
        .post('/chat')
        .set(bearer(aliceToken))
        .send({ email: 'bob@gmail.com' })
        .expect(201)
    ).body.id;
    carolBobRoomId = (
      await request(server)
        .post('/chat')
        .set(bearer(carolToken))
        .send({ email: 'bob@gmail.com' })
        .expect(201)
    ).body.id;
  });

  afterAll(async () => {
    sockets.forEach((socket) => socket.disconnect());
    await app.close();
  });

  describe('connecting', () => {
    it('refuses a connection without a token', async () => {
      await expect(connect()).rejects.toThrow();
    });

    it('refuses a connection with an invalid token', async () => {
      await expect(connect('not-a-real-token')).rejects.toThrow();
    });

    it('accepts a connection with a valid token', async () => {
      const socket = await connect(aliceToken);

      expect(socket.connected).toBe(true);
    });
  });

  describe('joining rooms', () => {
    it('lets a participant join their room', async () => {
      const socket = await connect(aliceToken);

      await expect(
        socket.timeout(2000).emitWithAck('joinRoom', {
          chatRoomId: aliceBobRoomId,
        }),
      ).resolves.toEqual({ ok: true });
    });

    it('does not let an outsider join', async () => {
      const socket = await connect(carolToken);

      await expect(
        socket.timeout(2000).emitWithAck('joinRoom', {
          chatRoomId: aliceBobRoomId,
        }),
      ).resolves.toMatchObject({ ok: false });
    });
  });

  describe('receiving messages', () => {
    it('pushes a new message to the room, and only to that room', async () => {
      // Bob joins the Alice room; Carol joins her own room with Bob.
      const bob = await connect(bobToken);
      await bob.timeout(2000).emitWithAck('joinRoom', {
        chatRoomId: aliceBobRoomId,
      });
      const carol = await connect(carolToken);
      await carol.timeout(2000).emitWithAck('joinRoom', {
        chatRoomId: carolBobRoomId,
      });

      const bobReceives = nextEvent<{ content: string }>(bob, 'newMessage');
      const carolReceives = nextEvent(carol, 'newMessage');

      // Alice sends over REST; the server pushes it to the room.
      await request(server)
        .post('/message')
        .set(bearer(aliceToken))
        .send({ chatRoomId: aliceBobRoomId, content: 'Hi Bob', type: 'TEXT' })
        .expect(201);

      await expect(bobReceives).resolves.toMatchObject({
        chatRoomId: aliceBobRoomId,
        content: 'Hi Bob',
        sender: { email: 'alice@gmail.com' },
      });
      // Carol is connected but in another room: she must get nothing.
      // (The old gateway broadcast every message to EVERY connected client.)
      await expect(carolReceives).resolves.toBeNull();
    });
  });
});
