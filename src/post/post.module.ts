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
import { PostReactionController } from './reaction/post-reaction.controller';
import { PostReactionRepository } from './reaction/post-reaction.repository';
import { PostReactionService } from './reaction/post-reaction.service';

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
  // Likes and bookmarks have their own controller and service (in
  // ./reaction), but belong to this module: they are things you do TO a post.
  controllers: [PostController, PostReactionController],
  exports: [
    // Other modules may use PostService (e.g. CommentService checks that a
    // post is visible to the viewer before showing or accepting its comments).
    PostService,
    // UserController serves GET /user/bookmarks and the old bookmark toggle.
    PostReactionService,
  ],
  providers: [
    PostService,
    PostRepository,
    PostReactionService,
    PostReactionRepository,
    // Used by PostService.createDummyPosts to find or create dummy authors.
    UserRepository,
  ],
})
export class PostModule {}
