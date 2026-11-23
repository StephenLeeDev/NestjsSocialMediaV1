/**
 * Wires the comment feature together.
 *
 * Imports PostModule to use PostService: the post visibility rule (PRIVATE
 * posts are hidden from other users) is owned by the post module and reused
 * here instead of being written a second time.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CommentRepository } from './comment.repository';
import { PostModule } from '../post/post.module';
import { UserRepository } from '../user/user.repository';

@Module({
  imports: [AuthModule, PostModule],
  controllers: [CommentController],
  providers: [
    CommentService,
    CommentRepository,
    // Used by CommentService.createDummyComments to find or create dummy authors.
    UserRepository,
  ],
})
export class CommentModule {}
