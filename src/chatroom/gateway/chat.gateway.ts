/**
 * ============================================================================
 *  ChatGateway: real-time chat over Socket.IO
 * ============================================================================
 *
 * How a client uses it:
 *
 *   const socket = io(SERVER_URL, { auth: { token: '<JWT>' } });   // 1. connect
 *   await socket.emitWithAck('joinRoom', { chatRoomId: 13 });       // 2. join
 *   socket.on('newMessage', (message) => { ... });                  // 3. receive
 *
 * Sending a message is NOT done over the socket: the client calls
 * POST /message. That request is validated, permission-checked and saved by
 * MessageService, which then calls `emitNewMessage` below to push it to the
 * room. One place for all rules, and every pushed message is already stored.
 *
 * Security (all of this was missing before):
 *   - connections must carry a valid JWT (checked once, in a middleware)
 *   - a socket can only join rooms its user participates in
 *   - messages are delivered only to the sockets in that room
 * The old gateway accepted anyone, and re-broadcast whatever a client sent to
 * EVERY connected client.
 */
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../../auth/jwt-payload.interface';
import { MessageInfoDto } from '../../message/dto/message-info.dto';
import { User } from '../../user/user.entity';
import { UserRepository } from '../../user/user.repository';
import { ChatRoomService } from '../chatroom.service';

/** The answer a client gets for `joinRoom` / `leaveRoom` (its "ack"). */
export type RoomAck = { ok: true } | { ok: false; error: string };

/** What a socket remembers about its user after authentication. */
interface AuthenticatedSocketData {
  user: User;
}

/**
 * Socket.IO room name for a chat room. Prefixed so these rooms can never
 * collide with other room names (each socket is also automatically in a room
 * named after its own id).
 */
export const socketRoomName = (chatRoomId: number) => `chat-room:${chatRoomId}`;

@WebSocketGateway()
export class ChatGateway implements OnGatewayInit {
  private readonly logger = new Logger(ChatGateway.name);

  // The underlying Socket.IO server, injected by NestJS.
  @WebSocketServer() server: Server;

  constructor(
    // Verifies the JWT sent in the handshake (same secret as the REST API).
    private readonly jwtService: JwtService,
    // Loads the user the JWT belongs to.
    private readonly userRepository: UserRepository,
    // Owns the "is this user in the room?" rule.
    private readonly chatRoomService: ChatRoomService,
  ) {}

  // ==========================================================================
  //  1. Connecting: authenticate every socket
  // ==========================================================================

  /**
   * Runs once when the gateway starts. Registers a Socket.IO MIDDLEWARE: a
   * function that runs for every new connection BEFORE it is accepted.
   * Calling `next(error)` refuses the connection; the client then receives a
   * "connect_error" event and is never connected.
   */
  afterInit(server: Server): void {
    server.use(async (socket, next) => {
      try {
        socket.data = { user: await this.authenticate(socket) };
        next();
      } catch {
        next(new Error('Unauthorized'));
      }
    });
  }

  /**
   * Returns the user that the handshake's JWT belongs to, or throws.
   * The token is expected in `auth.token` (see the usage example at the top).
   */
  private async authenticate(socket: Socket): Promise<User> {
    const token: unknown = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length === 0) {
      throw new Error('Missing token');
    }

    // Throws if the token is malformed, signed with another secret or expired.
    // The payload shape is shared with AuthService and JwtStrategy.
    const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

    const user = await this.userRepository.findOneBy({ email: payload.email });
    if (!user) {
      throw new Error('Unknown user');
    }
    return user;
  }

  // ==========================================================================
  //  2. Joining / leaving chat rooms
  // ==========================================================================

  /**
   * `socket.emitWithAck('joinRoom', { chatRoomId })` → `{ ok: true }` or
   * `{ ok: false, error }`. The return value is sent back to the client as
   * the acknowledgement.
   *
   * Only participants of the chat room are let in; for everyone else the room
   * "does not exist" (same answer as the REST API's 404).
   */
  @SubscribeMessage('joinRoom')
  async joinRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { chatRoomId?: unknown },
  ): Promise<RoomAck> {
    const chatRoomId = Number(body?.chatRoomId);
    if (!Number.isInteger(chatRoomId)) {
      return { ok: false, error: 'chatRoomId must be a whole number' };
    }

    const { user } = socket.data as AuthenticatedSocketData;
    if (!(await this.chatRoomService.isParticipant(chatRoomId, user.email))) {
      return { ok: false, error: 'Chat room not found' };
    }

    await socket.join(socketRoomName(chatRoomId));
    return { ok: true };
  }

  /** `socket.emitWithAck('leaveRoom', { chatRoomId })`: stop receiving messages. */
  @SubscribeMessage('leaveRoom')
  async leaveRoom(
    @ConnectedSocket() socket: Socket,
    @MessageBody() body: { chatRoomId?: unknown },
  ): Promise<RoomAck> {
    const chatRoomId = Number(body?.chatRoomId);
    if (!Number.isInteger(chatRoomId)) {
      return { ok: false, error: 'chatRoomId must be a whole number' };
    }

    await socket.leave(socketRoomName(chatRoomId));
    return { ok: true };
  }

  // ==========================================================================
  //  3. Delivering messages (called by MessageService, not by clients)
  // ==========================================================================

  /**
   * Pushes a saved message to every socket that joined its chat room, and to
   * nobody else.
   */
  emitNewMessage(chatRoomId: number, message: MessageInfoDto): void {
    this.server.to(socketRoomName(chatRoomId)).emit('newMessage', message);
    this.logger.verbose(`newMessage ${message.id} → room ${chatRoomId}`);
  }
}
