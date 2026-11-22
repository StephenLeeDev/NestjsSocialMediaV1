/**
 * Wires the follow feature together.
 *
 * Exports FollowService so other modules can ask "does A follow B?"
 * (UserService uses it for the isFollowing flag on profiles).
 */
import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UserRepository } from '../user/user.repository';
import { FollowController } from './follow.controller';
import { FollowRepository } from './follow.repository';
import { FollowService } from './follow.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [FollowController],
  providers: [
    FollowService,
    FollowRepository,
    // Used by FollowService to check that the user to follow exists.
    UserRepository,
  ],
  exports: [FollowService],
})
export class FollowModule {}
