import { Body, Controller, Delete, Get, Logger, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { PostService } from './post.service';
import { PostEntity, PostResponse } from "./post.entity";
import { PostStatus } from './post-status.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { PostStatusValidationPipe } from './pipe/post-status-validation.pipe';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/get-user.decorator';
import { User } from 'src/user/user.entity';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { editFileName, imageFileFilter } from "../lib/multerOptions";
import { diskStorage } from 'multer';
import { ConfigService } from '@nestjs/config';
import { ApiImplicitFile } from '@nestjs/swagger/dist/decorators/api-implicit-file.decorator';

@ApiTags('POST')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('post')
export class PostController {

    private logger = new Logger('PostController');

    constructor(
        private postService: PostService,
        private readonly configService: ConfigService
    ) { }

    @ApiResponse({
        type: PostResponse,
        status: 200,
        description: 'Success',
    })
    @ApiQuery({
        name: 'page',
        description: `The page's number to call`,
        required: true,
    })
    @ApiQuery({
        name: 'limit',
        description: `The number of items on a single page`,
        required: true,
    })
    @ApiOperation({ summary: `Get user's post list` })
    @Get('/')
    getPostList(
        @GetUser() user: User,
        @Query('page', ParseIntPipe) page: number,
        @Query('limit', ParseIntPipe) limit: number,
    ): Promise<PostResponse> {
        this.logger.verbose(`User ${user.email} trying to get posts`);
        return this.postService.getPostList(user, page, limit);
    }

    @ApiResponse({
        type: PostEntity,
        status: 200,
        description: 'Success',
    })
    @ApiConsumes('multipart/form-data')
    @ApiImplicitFile({ name: 'files', description: `Post's images`, required: true })
    @ApiBody({ type: CreatePostDto })
    @ApiOperation({ summary: 'Create a new post' })
    @UseInterceptors(FilesInterceptor("files", 3, {
      storage: diskStorage({
        destination: `./static/images`,
        filename: editFileName
      }),
      fileFilter: imageFileFilter
    }))
    @Post()
    createPost(
        @Body() createPostDto: CreatePostDto,
        @GetUser() user: User,
        @UploadedFiles() files: Array<Express.Multer.File>,
    ): Promise<PostEntity> {

        return this.postService.createPost(
            createPostDto,
            user,
            files.map(file => `${this.configService.get('SERVER_URL')}/images/${file.filename}`)
        );
    }

    @Get('/:id')
    getPostById(@Param('id') id: number): Promise<PostEntity> {
        return this.postService.getPostById(id);
    }

    @Delete('/:id')
    deletePost(
        @Param('id', ParseIntPipe) id,
        @GetUser() user: User
    ): Promise<void> {
        return this.postService.deletePost(id, user);
    }

    @Patch('/:id/status')
    updatePostStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body('status', PostStatusValidationPipe) status: PostStatus,
    ): Promise<PostEntity> {
        return this.postService.updatePostStatus(id, status);
    }

    @ApiResponse({
        status: 201,
        description: 'Success',
    })
    @ApiOperation({ summary: 'Create 10 dummy posts' })
    @Post('/test/dummy')
    createDummyPosts(
        @GetUser() user: User,
    ): Promise<void> {
        const count = 10
        this.logger.verbose(`User ${user.email} creating ${count} dummy posts.`);
        return this.postService.createDummyPosts(count, user);
    }

}

