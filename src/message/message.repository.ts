/**
 * ============================================================================
 *  MessageRepository: database access for messages
 * ============================================================================
 *
 * Responsibility: talking to the database, and nothing else. Who may read or
 * send messages is decided in MessageService (via ChatRoomService).
 *
 * (The "latest message per room" query for the room list lives in
 * ChatRoomRepository, because it serves the room list.)
 */
import { Injectable } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { MessageEntity } from './message.entity';

@Injectable()
export class MessageRepository extends Repository<MessageEntity> {
  constructor(dataSource: DataSource) {
    super(MessageEntity, dataSource.createEntityManager());
  }

  /**
   * One page of a room's messages, newest first, each with its sender.
   *
   * @returns `[messages on this page, total number of messages in the room]`
   */
  async findPage(
    chatRoomId: number,
    page: number,
    limit: number,
  ): Promise<[MessageEntity[], number]> {
    return (
      this.createQueryBuilder('message')
        .innerJoin('message.sender', 'sender')
        // Message columns plus only the PUBLIC columns of the sender.
        .select([
          'message',
          'sender.email',
          'sender.username',
          'sender.thumbnail',
          'sender.statusMessage',
        ])
        .where('message."chatRoomId" = :chatRoomId', { chatRoomId })
        // Newest first; id breaks ties between messages with the same time.
        .orderBy('message.createdAt', 'DESC')
        .addOrderBy('message.id', 'DESC')
        .skip((page - 1) * limit)
        .take(limit)
        .getManyAndCount()
    );
  }
}
