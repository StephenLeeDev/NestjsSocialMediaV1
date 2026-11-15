import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PostRepository } from './post.repository';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { MulterModule } from '@nestjs/platform-express';
import { CommentRepository } from '../comment/comment.repository';
import { AuthRepository } from '../auth/auth.repository';
import { UserRepository } from '../user/user.repository';

@Module({
  imports: [
    AuthModule,
    MulterModule.register({
      dest: "./static/images",
      limits: {
        fileSize: 1000000, // 1000kb
      },
    }),
  ],
  controllers: [PostController],
  providers: [PostService, PostRepository, CommentRepository, UserRepository, AuthRepository]
})
export class PostModule {}
