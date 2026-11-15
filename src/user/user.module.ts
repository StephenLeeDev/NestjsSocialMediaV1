/**
 * Wires the user feature together.
 *
 * Imports PostModule to use PostService: bookmarks follow the same post
 * visibility rule as everything else (owned by the post module).
 */
import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { PassportModule } from '@nestjs/passport';
import { PostModule } from '../post/post.module';
import { FollowRepository } from '../follow/follow.repository';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), PostModule],
  controllers: [UserController],
  providers: [
    UserService,
    UserRepository,
    // Used for `isFollowing` on profiles (to be revisited in the follow module).
    FollowRepository,
  ],
})
export class UserModule {}
