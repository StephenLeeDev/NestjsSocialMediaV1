import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CommentRepository } from 'src/comment/comment.repository';
import { CommentEntity } from 'src/comment/comment.entity';
import { PostRepository } from 'src/post/post.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostRepository, CommentRepository, CommentEntity]),
    AuthModule,
  ],
  controllers: [CommentController],
  providers: [CommentService]
})
export class CommentModule {}
