/**
 * Wires the post feature together: controller, service, repositories.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PostRepository } from './post.repository';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { MulterModule } from '@nestjs/platform-express';
import { UserRepository } from '../user/user.repository';

@Module({
  imports: [
    AuthModule,
    // Default upload limits for this module's file interceptors.
    // (Where files are stored is set per route, see PostController.)
    MulterModule.register({
      limits: {
        fileSize: 1000000, // 1 MB per image
      },
    }),
  ],
  controllers: [PostController],
  // Other modules may use PostService (e.g. CommentService checks that a post
  // is visible to the viewer before showing or accepting its comments).
  exports: [PostService],
  providers: [
    PostService,
    PostRepository,
    // Used by PostService.createDummyPosts to find or create dummy authors.
    UserRepository,
  ],
})
export class PostModule {}
