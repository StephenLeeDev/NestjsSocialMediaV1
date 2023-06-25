import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { PostRepository } from './post.repository';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { MulterModule } from '@nestjs/platform-express';
import { CommentRepository } from 'src/comment/comment.repository';
import { CommentEntity } from 'src/comment/comment.entity';
import { AuthRepository } from 'src/auth/auth.repository';
import { UserRepository } from 'src/user/user.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostRepository, CommentRepository, CommentEntity, UserRepository, AuthRepository]),
    AuthModule,
    MulterModule.register({
      dest: "./static/images",
      limits: {
        fileSize: 300000, // 300kb
      },
    }),
  ],
  controllers: [PostController],
  providers: [PostService]
})
export class PostModule {}
