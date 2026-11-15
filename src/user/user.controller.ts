/**
 * ============================================================================
 *  UserController: HTTP endpoints for users (/user/...)
 * ============================================================================
 *
 * Responsibility: HTTP only (routes, parsing, file upload, Swagger). Every
 * rule lives in UserService. All routes require a signed-in user; `@GetUser()`
 * gives the User entity the JWT belongs to.
 *
 * Route order matters: fixed paths (`/thumbnail`, `/statusMessage`,
 * `/search/users`, `/post/bookmark`) are matched before `/:userEmail` because
 * they are more specific, but keep new fixed routes ABOVE `/:userEmail` anyway.
 */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
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
import { publicImageUrl } from '../common/utils/image-url.util';
import {
  editFileName,
  imageFileFilter,
  uploadDestination,
} from '../lib/multerOptions';
import { PostIdDto } from '../post/dto/post-id.dto';
import { StatusMessageDto } from './dto/status-message.dto';
import { UpdatedUserThumbnailDto } from './dto/updated-user-thumbnail.dto';
import { UserInfoIncludingIsFollowingDto } from './dto/user-info-including-isfollowing.dto';
import { UserInfoDto } from './dto/user-info.dto';
import { UserListDto } from './dto/user-list.dto';
import { User } from './user.entity';
import { UserService } from './user.service';

@ApiTags('USER')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  // ==========================================================================
  //  Profiles
  // ==========================================================================

  @ApiOperation({ summary: `Your own profile (including your bookmarks)` })
  @ApiResponse({ type: UserInfoDto, status: 200, description: 'Success' })
  @Get('/')
  getMyProfile(@GetUser() user: User): Promise<UserInfoDto> {
    return this.userService.getMyProfile(user);
  }

  // ==========================================================================
  //  Search
  // ==========================================================================

  @ApiOperation({ summary: `Find users whose username contains a keyword` })
  @ApiQuery({
    name: 'keyword',
    description: `Text the username must contain (case-sensitive). Empty or missing = everyone.`,
    required: false,
    allowEmptyValue: true,
  })
  @ApiQuery({
    name: 'page',
    description: `1-based page number`,
    required: true,
  })
  @ApiQuery({ name: 'limit', description: `Users per page`, required: true })
  @ApiResponse({ type: UserListDto, status: 200, description: 'Success' })
  @Get('/search/users')
  searchUsers(
    @GetUser() user: User,
    @Query('keyword') keyword: string | undefined,
    @Query('page', ParseIntPipe) page: number,
    @Query('limit', ParseIntPipe) limit: number,
  ): Promise<UserListDto> {
    return this.userService.searchUsers(user, keyword, page, limit);
  }

  // ==========================================================================
  //  Bookmarks
  // ==========================================================================

  @ApiOperation({ summary: `Bookmark a post, or remove the bookmark` })
  @ApiBody({ type: PostIdDto })
  @ApiResponse({ status: 201, description: 'Success' })
  @Post('/post/bookmark')
  toggleBookmark(
    @GetUser() user: User,
    @Body() postIdDto: PostIdDto,
  ): Promise<void> {
    return this.userService.toggleBookmark(user, postIdDto.postId);
  }

  // ==========================================================================
  //  Profile picture and status message
  // ==========================================================================

  @ApiOperation({ summary: 'Upload a new profile picture' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'The new profile picture (jpg/jpeg/png)',
        },
      },
    },
  })
  @ApiResponse({
    type: UpdatedUserThumbnailDto,
    status: 200,
    description: 'Success',
  })
  // Multer receives the file from the `file` form field, renames it and
  // writes it to disk before the handler runs.
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDestination,
        filename: editFileName,
      }),
      fileFilter: imageFileFilter,
    }),
  )
  @Patch('thumbnail')
  updateThumbnail(
    @GetUser() user: User,
    // `undefined` when the request contains no file.
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<UpdatedUserThumbnailDto> {
    // Checked here because it is about the shape of the HTTP request. It used
    // to fail later on `file.filename` with a 500.
    if (!file) {
      throw new BadRequestException('An image file is required');
    }
    return this.userService.updateThumbnail(
      user,
      publicImageUrl(file.filename),
    );
  }

  @ApiOperation({ summary: `Go back to the default profile picture` })
  @ApiResponse({
    type: UpdatedUserThumbnailDto,
    status: 200,
    description: 'Success',
  })
  @Delete('/thumbnail')
  resetThumbnail(@GetUser() user: User): Promise<UpdatedUserThumbnailDto> {
    return this.userService.resetThumbnail(user);
  }

  @ApiOperation({ summary: `Change your status message` })
  @ApiBody({ type: StatusMessageDto })
  @ApiResponse({ status: 200, description: 'Success' })
  @Patch('/statusMessage')
  updateStatusMessage(
    @GetUser() user: User,
    @Body() statusMessageDto: StatusMessageDto,
  ): Promise<void> {
    return this.userService.updateStatusMessage(
      user,
      statusMessageDto.statusMessage,
    );
  }

  // ==========================================================================
  //  Another user's profile (keep this route LAST: `/:userEmail` matches any
  //  single path segment)
  // ==========================================================================

  @ApiOperation({
    summary: `Another user's profile (+ whether you follow them)`,
  })
  @ApiParam({ name: 'userEmail', description: `The user's email` })
  @ApiQuery({
    name: 'userEmail',
    description: `Same email; takes precedence over the path (the Flutter app sends it here)`,
    required: false,
  })
  @ApiResponse({
    type: UserInfoIncludingIsFollowingDto,
    status: 200,
    description: 'Success',
  })
  @Get('/:userEmail')
  getProfile(
    @GetUser() user: User,
    @Param('userEmail') emailInPath: string,
    @Query('userEmail') emailInQuery: string | undefined,
  ): Promise<UserInfoIncludingIsFollowingDto> {
    // The Flutter app sends the literal text "{userEmail}" in the path and the
    // real email in the query, so the query wins. Normal REST clients can just
    // put the email in the path.
    return this.userService.getProfile(emailInQuery ?? emailInPath, user.email);
  }
}
