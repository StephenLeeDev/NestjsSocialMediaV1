/**
 * Wires the post feature together: controller, service, repositories.
 */
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PostRepository } from './post.repository';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { MulterModule } from '@nestjs/platform-express';
import { AuthRepository } from '../auth/auth.repository';
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
  providers: [
    PostService,
    PostRepository,
    // Used by PostService.createDummyPosts to find or create dummy authors.
    UserRepository,
    AuthRepository,
  ],
})
export class PostModule {}
