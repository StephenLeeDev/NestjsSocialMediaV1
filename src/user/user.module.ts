import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { PassportModule } from '@nestjs/passport';
import { PostRepository } from '../post/post.repository';
import { FollowRepository } from '../follow/follow.repository';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [UserController],
  providers: [UserService, UserRepository, PostRepository, FollowRepository],
})
export class UserModule {}
