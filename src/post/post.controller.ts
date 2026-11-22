/**
 * ============================================================================
 *  PostController: HTTP endpoints for posts (/post/...)
 * ============================================================================
 *
 * Responsibility: HTTP only.
 *   - which URL + method maps to which action
 *   - reading and converting request data (body, query, path, files)
 *   - documenting the endpoint for Swagger (/api)
 * Every decision about the data itself is delegated to PostService.
 *
 * All routes require a signed-in user (`@UseGuards(AuthGuard())`); `@GetUser()`
 * gives the user that the JWT belongs to.
 *
 * Route order matters: fixed paths such as `/my` and `/user` are declared
 * BEFORE `/:id`, otherwise "my" would be treated as an id.
 */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { GetUser } from '../auth/get-user.decorator';
import {
  editFileName,
  imageFileFilter,
  uploadDestination,
} from '../lib/multerOptions';
import { User } from '../user/user.entity';
import { CreatePostDto } from './dto/create-post.dto';
import { PostInfoDto, PostResponse } from './dto/post-info.dto';
import { UpdatePostDescriptionDto } from './dto/update-post-description.dto';
import { PostService } from './post.service';
import { ParseLimitPipe, ParsePagePipe } from '../common/pipes/paging.pipes';

/** The most images one post may have. */
const MAX_IMAGES_PER_POST = 4;

/**
 * Swagger description of the `page` / `limit` query parameters, shared by all
 * paginated endpoints so the wording stays identical.
 */
const PageQuery = () =>
  ApiQuery({
    name: 'page',
    description: `1-based page number`,
    required: true,
  });
const LimitQuery = () =>
  ApiQuery({ name: 'limit', description: `Posts per page`, required: true });

@ApiTags('POST')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('post')
export class PostController {
  constructor(private readonly postService: PostService) {}

  // ==========================================================================
  //  POST /post: create a post with images
  // ==========================================================================

  @ApiOperation({ summary: 'Create a new post' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['description', 'files'],
      properties: {
        description: { type: 'string', example: 'Write a description here' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: `Post's images (1 to ${MAX_IMAGES_PER_POST}, jpg/jpeg/png)`,
        },
      },
    },
  })
  @ApiResponse({ type: PostInfoDto, status: 201, description: 'Created' })
  // Multer receives the uploaded files from the `files` form field, renames
  // them and writes them to disk BEFORE the handler runs. If validation fails
  // afterwards, NestJS deletes those files again automatically.
  @UseInterceptors(
    FilesInterceptor('files', MAX_IMAGES_PER_POST, {
      storage: diskStorage({
        destination: uploadDestination,
        filename: editFileName,
      }),
      fileFilter: imageFileFilter,
    }),
  )
  @Post()
  createPost(
    @Body() createPostDto: CreatePostDto,
    @GetUser() user: User,
    // Undefined (not an empty list) when the request contains no files.
    @UploadedFiles() files: Express.Multer.File[] = [],
  ): Promise<PostInfoDto> {
    return this.postService.createPost(
      createPostDto,
      user,
      // The saved files' new names are their image paths (stored as-is;
      // the response URLs are built by the mapper).
      files.map((file) => file.filename),
    );
  }

  // ==========================================================================
  //  Lists
  // ==========================================================================

  @ApiOperation({ summary: `The feed: everyone's public posts, newest first` })
  @PageQuery()
  @LimitQuery()
  @ApiResponse({ type: PostResponse, status: 200, description: 'Success' })
  @Get('/')
  getFeed(
    @GetUser() user: User,
    // ParseIntPipe turns "2" into 2 and answers 400 for non-numbers.
    @Query('page', ParsePagePipe) page: number,
    @Query('limit', ParseLimitPipe) limit: number,
  ): Promise<PostResponse> {
    return this.postService.getFeed(user.email, page, limit);
  }

  @ApiOperation({ summary: `The signed-in user's public posts` })
  @PageQuery()
  @LimitQuery()
  @ApiResponse({ type: PostResponse, status: 200, description: 'Success' })
  @Get('/my')
  getMyPosts(
    @GetUser() user: User,
    @Query('page', ParsePagePipe) page: number,
    @Query('limit', ParseLimitPipe) limit: number,
  ): Promise<PostResponse> {
    // The viewer is also the author here.
    return this.postService.getPostsByAuthor(
      user.email,
      user.email,
      page,
      limit,
    );
  }

  @ApiOperation({ summary: `A user's public posts, by the user's email` })
  @ApiQuery({
    name: 'email',
    description: `The author's email`,
    required: true,
  })
  @PageQuery()
  @LimitQuery()
  @ApiResponse({ type: PostResponse, status: 200, description: 'Success' })
  @Get('/user')
  getPostsByAuthor(
    @GetUser() user: User,
    @Query('email') authorEmail: string,
    @Query('page', ParsePagePipe) page: number,
    @Query('limit', ParseLimitPipe) limit: number,
  ): Promise<PostResponse> {
    return this.postService.getPostsByAuthor(
      authorEmail,
      user.email,
      page,
      limit,
    );
  }

  // ==========================================================================
  //  Update
  // ==========================================================================

  @ApiOperation({ summary: `Edit the description of your own post` })
  @ApiResponse({ type: PostInfoDto, status: 200, description: 'Success' })
  @Patch('/description')
  updateDescription(
    @GetUser() user: User,
    @Body() updatePostDescriptionDto: UpdatePostDescriptionDto,
  ): Promise<PostInfoDto> {
    return this.postService.updateDescription(
      user.email,
      updatePostDescriptionDto,
    );
  }

  @ApiOperation({ summary: `Switch your own post between PUBLIC and PRIVATE` })
  @ApiParam({ name: 'id', description: 'The post ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @Patch('/:id/status')
  togglePostStatus(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<void> {
    return this.postService.togglePostStatus(id, user.email);
  }

  // ==========================================================================
  //  Single post
  // ==========================================================================

  @ApiOperation({ summary: 'Get one post by its ID' })
  @ApiParam({ name: 'id', description: 'The post ID' })
  @ApiResponse({ type: PostInfoDto, status: 200, description: 'Success' })
  @Get('/:id')
  getPost(
    @GetUser() user: User,
    // Without ParseIntPipe, "abc" reached the SQL query and caused a 500.
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PostInfoDto> {
    return this.postService.getPost(id, user.email);
  }

  @ApiOperation({ summary: 'Delete your own post (and its comments)' })
  @ApiParam({ name: 'id', description: 'The post ID to delete' })
  @ApiResponse({ status: 200, description: 'Success' })
  @Delete('/:id')
  deletePost(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<void> {
    return this.postService.deletePost(id, user);
  }

  // ==========================================================================
  //  Development helper
  // ==========================================================================

  @ApiOperation({ summary: 'Create 10 dummy posts (development only)' })
  @ApiQuery({
    name: 'email',
    description: `Author of the dummy posts; when empty, random dummy users are used`,
    required: false,
  })
  @ApiResponse({ status: 201, description: 'Created' })
  @Post('/test/dummy')
  createDummyPosts(@Query('email') email?: string): Promise<void> {
    return this.postService.createDummyPosts(email);
  }
}
