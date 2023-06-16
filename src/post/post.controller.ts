import { Body, Controller, Delete, Get, Logger, Param, ParseIntPipe, Patch, Post, Query, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { PostService } from './post.service';
import { PostEntity } from "./post.entity";
import { PostStatus } from './post-status.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { PostStatusValidationPipe } from './pipe/post-status-validation.pipe';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/get-user.decorator';
import { User } from 'src/user/user.entity';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { FilesInterceptor } from '@nestjs/platform-express';
import { editFileName, imageFileFilter } from "../lib/multerOptions";
import { diskStorage } from 'multer';
import { ConfigService } from '@nestjs/config';
import { ApiImplicitFile } from '@nestjs/swagger/dist/decorators/api-implicit-file.decorator';
import { CommentInfoDto, CommentInfoListDto } from '../comment/dto/comment-info.dto';
import { CreateCommentDto } from '../comment/dto/create-comment.dto';
import { PostInfoDto, PostResponse } from './dto/post-info.dto';
import { UpdateCommentDto } from 'src/comment/dto/update-comment.dto';

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
        type: PostInfoDto,
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
    ): Promise<PostInfoDto> {

        return this.postService.createPost(
            createPostDto,
            user,
            files.map(file => `${this.configService.get('SERVER_URL')}/images/${file.filename}`)
        );
    }

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
    @ApiOperation({ summary: `Get post list` })
    @Get('/')
    getPostList(
        @Query('page', ParseIntPipe) page: number,
        @Query('limit', ParseIntPipe) limit: number,
    ): Promise<PostResponse> {
        return this.postService.getPostList(page, limit);
    }

    @ApiResponse({
        type: PostResponse,
        status: 200,
        description: 'Success',
    })
    @ApiQuery({
        name: 'email',
        description: `The post's author to call`,
        required: true,
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
    @Get('/user/post')
    getPostListByUser(
        @Query('email') email: string,
        @Query('page', ParseIntPipe) page: number,
        @Query('limit', ParseIntPipe) limit: number,
    ): Promise<PostResponse> {
        return this.postService.getPostListByUser(email, page, limit);
    }

    @ApiResponse({
        type: [String],
        status: 201,
        description: 'Success',
    })
    @ApiQuery({
        name: 'postId',
        description: `The ID of the post to add/remove a like to`,
        required: true,
    })
    @ApiOperation({ summary: 'Add or remove a like to the post' })
    @Post('/:postId/like')
    likePost(
        @GetUser() user: User,
        @Query('postId', ParseIntPipe) postId: number,
    ): Promise<string[]> {
        return this.postService.likeUnlikePost(
            postId,
            user.email,
        );
    }

    @ApiResponse({
        type: PostInfoDto,
        status: 200,
        description: 'Success',
    })
    @ApiOperation({ summary: 'Get the post infomation by id' })
    @Get('/:id')
    getPostById(@Param('id') id: number): Promise<PostInfoDto> {
        return this.postService.getPostById(id);
    }

    @ApiResponse({
        status: 200,
        description: 'Success',
    })
    @ApiParam({
      name: 'id',
      required: true,
      description: 'The post ID to delete',
    })
    @Delete('/:id')
    @ApiOperation({ summary: 'Delete the post by id' })
    deletePost(
        @Param('id', ParseIntPipe) id,
        @GetUser() user: User
    ): Promise<void> {
        return this.postService.deletePost(id, user);
    }

    @ApiResponse({
        status: 200,
        description: 'Success',
    })
    @ApiOperation({ summary: `Modify the post status` })
    @Patch('/:id/status')
    updatePostStatus(
        @Param('id', ParseIntPipe) id: number,
    ): Promise<void> {
        return this.postService.updatePostStatus(id);
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

