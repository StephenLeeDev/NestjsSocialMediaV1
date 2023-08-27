import { Module } from '@nestjs/common';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserRepository } from './user.repository';
import { PassportModule } from '@nestjs/passport';
import { PostRepository } from 'src/post/post.repository';
import { FollowRepository } from 'src/follow/follow.repository';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([UserRepository, PostRepository, FollowRepository]),
    UserModule
  ],
  controllers: [UserController],
  providers: [UserService]
})
export class UserModule {}
