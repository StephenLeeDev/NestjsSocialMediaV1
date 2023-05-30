import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { PostRepository } from './post.repository';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { AuthRepository } from 'src/auth/auth.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostRepository, AuthRepository]),
    AuthModule
  ],
  controllers: [PostController],
  providers: [PostService]
})
export class PostModule {}
