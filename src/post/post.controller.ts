import { Body, Controller, Delete, Get, Logger, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { PostService } from './post.service';
import { PostEntity, PostResponse } from "./post.entity";
import { PostStatus } from './post-status.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { PostStatusValidationPipe } from './pipe/post-status-validation.pipe';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/get-user.decorator';
import { User } from 'src/auth/user.entity';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('POST')
@Controller('post')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
export class PostController {

    private logger = new Logger('PostController');

    constructor(private postService: PostService) { }

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
    @ApiOperation({ summary: 'Create a new post' })
    @Post()
    createPost(
        @Body() createPostDto: CreatePostDto,
        @GetUser() user: User,
    ): Promise<PostEntity> {
        this.logger.verbose(`User ${user.email} creating a new post.
        Payload: ${JSON.stringify(createPostDto)} `);
        return this.postService.createPost(createPostDto, user);
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

}
