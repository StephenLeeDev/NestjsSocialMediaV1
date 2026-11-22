/**
 * Wires the user feature together.
 *
 * Imports:
 *   - PostModule   → PostReactionService: the bookmark routes under /user
 *                    (GET /user/bookmarks, the old toggle) and the old
 *                    `bookMarks` profile field; bookmarks are stored by the
 *                    post module (post_bookmark table)
 *   - FollowModule → FollowService: the isFollowing flag on profiles
 */
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { ImageStorage } from '../common/storage/image-storage.service';
import { PassportModule } from '@nestjs/passport';
import { PostModule } from '../post/post.module';
import { FollowModule } from '../follow/follow.module';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    PostModule,
    FollowModule,
  ],
  controllers: [UserController],
  providers: [
    UserService,
    UserRepository,
    // Deletes a replaced profile picture's file.
    ImageStorage,
  ],
})
export class UserModule {}
