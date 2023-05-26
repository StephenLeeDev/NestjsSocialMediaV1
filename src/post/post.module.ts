import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { PostRepository } from './post.repository';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { UserRepository } from 'src/auth/user.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostRepository, UserRepository]),
    AuthModule
  ],
  controllers: [PostController],
  providers: [PostService]
})
export class PostModule {}
