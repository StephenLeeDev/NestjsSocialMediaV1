import { Body, Controller, Delete, Get, Logger, Param, ParseIntPipe, Patch, Post, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { PostService } from './post.service';
import { PostEntity } from "./post.entity";
import { PostStatus } from './post-status.enum';
import { CreatePostDto } from './dto/create-post.dto';
import { PostStatusValidationPipe } from './pipes/post-status-validation.pipe';
import { AuthGuard } from '@nestjs/passport';
import { GetUser } from 'src/auth/get-user.decorator';
import { User } from 'src/auth/user.entity';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';

@Controller('post')
@UseGuards(AuthGuard())
export class PostController {

    private logger = new Logger('PostController');

    constructor(private postService: PostService) { }
    
    @Get('/')
    getPostList(
        @GetUser() user: User,
    ): Promise<PostEntity[]> {
        this.logger.verbose(`User ${user.email} trying to get posts`);
        return this.postService.getPostList(user);
    }

    @ApiParam({
        name: 'title',
        required: true,
        description: "Post's title",
    })
    @ApiParam({
        name: 'description',
        required: true,
        description: "Post's description",
    })
    @ApiResponse({
        type: PostEntity,
        status: 200,
        description: 'Success',
    })
    @ApiOperation({ summary: 'Create a new post' })
    @Post()
    @UsePipes(ValidationPipe)
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
