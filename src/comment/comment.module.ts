import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CommentRepository } from './comment.repository';
import { PostRepository } from '../post/post.repository';
import { UserRepository } from '../user/user.repository';
import { AuthRepository } from '../auth/auth.repository';

@Module({
  imports: [AuthModule],
  controllers: [CommentController],
  providers: [
    CommentService,
    PostRepository,
    CommentRepository,
    UserRepository,
    AuthRepository,
  ],
})
export class CommentModule {}
