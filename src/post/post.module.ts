import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { PostRepository } from './post.repository';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { AuthRepository } from 'src/auth/auth.repository';
import { MulterModule } from '@nestjs/platform-express';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostRepository, AuthRepository]),
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
