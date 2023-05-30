import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { PostRepository } from './post.repository';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { AuthRepository } from 'src/auth/auth.repository';
import { MulterModule } from '@nestjs/platform-express';
import { join } from 'path';
import { diskStorage } from 'multer';

@Module({
  imports: [
    TypeOrmModule.forFeature([PostRepository, AuthRepository]),
    AuthModule,
    // MulterModule.register({
    //   // dest: join(__dirname, '..', 'static', 'images'),
    //   dest: './upload',
    //   limits: {
    //     fileSize: 300000, // 300kb
    //   },
    //   fileFilter: (req, file, callback) => {
    //     if (file.mimetype.startsWith('image/')) {
    //       callback(null, true);
    //     } else {
    //       callback(new Error('Only image files are allowed!'), false);
    //     }
    //   },
    // }),

    MulterModule.registerAsync({
      useFactory: () => ({
        storage: diskStorage({
          destination: './upload',
          filename: (req, file, callback) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            callback(null, file.fieldname + '-' + uniqueSuffix);
          },
        }),
        limits: {
          fileSize: 300000, // 300kb
        },
        fileFilter: (req, file, callback) => {
          if (file.mimetype.startsWith('image/')) {
            callback(null, true);
          } else {
            callback(new Error('Only image files are allowed!'), false);
          }
        },
      }),
    }),
  ],
  controllers: [PostController],
  providers: [PostService]
})
export class PostModule {}
