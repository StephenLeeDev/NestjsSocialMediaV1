/**
 * Wires the user feature together.
 *
 * Imports:
 *   - PostModule   → PostService: bookmarks follow the same post visibility
 *                    rule as everything else (owned by the post module)
 *   - FollowModule → FollowService: the isFollowing flag on profiles
 */
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
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
  providers: [UserService, UserRepository],
})
export class UserModule {}
