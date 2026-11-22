/**
 * ============================================================================
 *  ChatRoomRepository: database access for chat rooms and their members
 * ============================================================================
 *
 * Responsibility: talking to the database, and nothing else. Rules (who may
 * open a room, who may read it) live in ChatRoomService.
 *
 * Three tables are involved:
 *   chat_room_entity       one row per room
 *   user_chat_room_entity  one row per (user, room) membership
 *   messages               the messages, each pointing at a room
 *
 * This class used to be split with a separate UserChatRoomRepository; the
 * membership queries are part of "rooms", so they now live here together.
 */
import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { MessageEntity } from '../message/message.entity';
import { User } from '../user/user.entity';
import { ChatRoomEntity } from './chatroom.entity';
import { UserChatRoomEntity } from './user-chatroom.entity';

/** A room plus everything the room list shows for it. */
export interface RoomWithDetails {
  room: ChatRoomEntity;
  /** The other participant (null only if the data is broken). */
  partner: User | null;
  /** The newest message's text, or "" when the room has no messages. */
  latestMessage: string;
}

@Injectable()
export class ChatRoomRepository extends Repository<ChatRoomEntity> {
  constructor(private readonly dataSource: DataSource) {
    super(ChatRoomEntity, dataSource.createEntityManager());
  }

  // ==========================================================================
  //  Membership
  // ==========================================================================

  /** Whether `email` is a participant of room `chatRoomId`. */
  async isParticipant(chatRoomId: number, email: string): Promise<boolean> {
    return this.manager.getRepository(UserChatRoomEntity).existsBy({
      chatRoom: { id: chatRoomId },
      user: { email },
    });
  }

  /**
   * Opens the room between the two users, or returns the existing one.
   *
   * Everything happens in ONE transaction:
   *   1. a transaction-level lock for this pair of users
   *   2. look for an existing room
   *   3. otherwise create the room and both memberships
   *
   * Why the lock: without it, two requests at the same moment ("A opens chat
   * with B" and "B opens chat with A") could both see "no room yet" and both
   * create one. `pg_advisory_xact_lock` makes the second request wait until
   * the first transaction has finished; it then finds the new room. The lock
   * key is the two emails in sorted order, so A→B and B→A use the same lock.
   * (A UNIQUE constraint cannot express "one room per pair" here, because the
   * pair is spread over two membership rows.)
   *
   * @param now Timestamp for createdAt / updatedAt of a new room.
   * @returns The existing or newly created room.
   */
  async findOrCreateRoomBetween(
    emailA: string,
    emailB: string,
    now: Date,
  ): Promise<ChatRoomEntity> {
    return this.dataSource.transaction(async (manager) => {
      const lockKey = [emailA, emailB].sort().join('|');
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        lockKey,
      ]);

      // Same query as findRoomIdBetween, but through this transaction's
      // manager, so it runs AFTER the lock was taken.
      const existingId = await this.queryRoomIdBetween(manager, emailA, emailB);
      if (existingId !== null) {
        return manager.findOneByOrFail(ChatRoomEntity, { id: existingId });
      }

      const room = await manager.save(
        manager.create(ChatRoomEntity, { createdAt: now, updatedAt: now }),
      );
      await manager.insert(UserChatRoomEntity, [
        { user: { email: emailA }, chatRoom: { id: room.id } },
        { user: { email: emailB }, chatRoom: { id: room.id } },
      ]);
      return room;
    });
  }

  /** Moves the room's "last activity" time forward (e.g. after a new message). */
  async touch(chatRoomId: number, at: Date): Promise<void> {
    await this.update({ id: chatRoomId }, { updatedAt: at });
  }

  // ==========================================================================
  //  Room list
  // ==========================================================================

  /**
   * One page of `email`'s rooms, most recently active first, each with its
   * partner and latest message.
   *
   * Uses exactly THREE queries for the whole page, however many rooms it has:
   *   1. the page of rooms
   *   2. the partners of all those rooms
   *   3. the latest message of all those rooms
   * The old code ran two extra queries PER ROOM (the "N+1 query" problem): 20
   * rooms meant 42 queries.
   *
   * @returns `[rooms with details, total number of rooms]`
   */
  async findRoomsPage(
    email: string,
    page: number,
    limit: number,
  ): Promise<[RoomWithDetails[], number]> {
    // 1. The rooms `email` is a member of.
    const [memberships, total] = await this.manager
      .getRepository(UserChatRoomEntity)
      .createQueryBuilder('membership')
      .innerJoinAndSelect('membership.chatRoom', 'room')
      .where('membership."userEmail" = :email', { email })
      // Most recently active first; id as a tie-breaker for a stable order.
      .orderBy('room.updatedAt', 'DESC')
      .addOrderBy('room.id', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    const rooms = memberships.map((membership) => membership.chatRoom);
    if (rooms.length === 0) {
      return [[], total];
    }
    const roomIds = rooms.map((room) => room.id);

    // 2. The OTHER member of each of those rooms (public columns only).
    const partnerMemberships = await this.manager
      .getRepository(UserChatRoomEntity)
      .createQueryBuilder('membership')
      .innerJoin('membership.user', 'user')
      .innerJoin('membership.chatRoom', 'room')
      .select([
        'membership.id',
        'room.id',
        'user.email',
        'user.username',
        'user.thumbnail',
        'user.statusMessage',
      ])
      .where('room.id IN (:...roomIds)', { roomIds })
      .andWhere('user.email <> :email', { email })
      .getMany();
    const partnerByRoomId = new Map(
      partnerMemberships.map((m) => [m.chatRoom.id, m.user]),
    );

    // 3. The newest message of each room, using PostgreSQL's DISTINCT ON:
    //    "for each chatRoomId, keep only the FIRST row in this order", and the
    //    order puts the newest message first within each room.
    const latestRows: { chatRoomId: number; content: string }[] =
      await this.manager
        .getRepository(MessageEntity)
        .createQueryBuilder('message')
        .select('message."chatRoomId"', 'chatRoomId')
        .addSelect('message.content', 'content')
        .distinctOn(['message."chatRoomId"'])
        .where('message."chatRoomId" IN (:...roomIds)', { roomIds })
        .orderBy('message."chatRoomId"')
        .addOrderBy('message.createdAt', 'DESC')
        .addOrderBy('message.id', 'DESC')
        .getRawMany();
    const latestByRoomId = new Map(
      latestRows.map((row) => [Number(row.chatRoomId), row.content]),
    );

    return [
      rooms.map((room) => ({
        room,
        partner: partnerByRoomId.get(room.id) ?? null,
        latestMessage: latestByRoomId.get(room.id) ?? '',
      })),
      total,
    ];
  }

  // ==========================================================================
  //  Internal helpers
  // ==========================================================================

  /**
   * Finds the room shared by `emailA` and `emailB` with ONE SQL query: the
   * membership table is joined with ITSELF, so each result row pairs
   * "A is in room R" with "B is in room R".
   *
   * @param manager Which connection to use: the normal one, or a transaction's.
   */
  private async queryRoomIdBetween(
    manager: EntityManager,
    emailA: string,
    emailB: string,
  ): Promise<number | null> {
    const row: { chatRoomId: number } | undefined = await manager
      .getRepository(UserChatRoomEntity)
      .createQueryBuilder('a')
      .innerJoin(
        UserChatRoomEntity,
        'b',
        'b."chatRoomId" = a."chatRoomId" AND b."userEmail" = :emailB',
        { emailB },
      )
      .select('a."chatRoomId"', 'chatRoomId')
      .where('a."userEmail" = :emailA', { emailA })
      .limit(1)
      .getRawOne();

    // Raw query results may come back as strings, hence Number().
    return row ? Number(row.chatRoomId) : null;
  }
}
