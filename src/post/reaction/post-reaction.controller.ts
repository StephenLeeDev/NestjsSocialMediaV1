/**
 * ============================================================================
 *  PostReactionController: likes and bookmarks on a post
 * ============================================================================
 *
 * Responsibility: HTTP only. The rules are in PostReactionService.
 *
 *   PUT    /post/:id/like        like            → PostLikeStateDto
 *   DELETE /post/:id/like        remove the like → PostLikeStateDto
 *   PUT    /post/:id/bookmark    bookmark        → PostBookmarkStateDto
 *   DELETE /post/:id/bookmark    remove it       → PostBookmarkStateDto
 *   POST   /post/:postId/like    OLD toggle (deprecated, see below)
 *
 * Why PUT and DELETE instead of one POST toggle:
 *   PUT means "make it so" and DELETE means "undo it". Both are idempotent:
 *   repeating the request (double tap, automatic retry) does not change the
 *   result. A toggle cannot be repeated safely: the second request undoes
 *   the first. All four answer 200 OK with the resulting state.
 *
 * Shares the `/post` prefix with PostController. Nest allows several
 * controllers on one prefix; these paths do not overlap with PostController's.
 *
 * The "my bookmarks" list is GET /user/bookmarks (UserController), next to the
 * other "my ..." data of the signed-in user.
 */
import {
  Body,
  Controller,
  Delete,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../../auth/get-user.decorator';
import { User } from '../../user/user.entity';
import { PostIdDto } from '../dto/post-id.dto';
import { PostLikeCountDto } from '../dto/post-like-count.dto';
import {
  PostBookmarkStateDto,
  PostLikeStateDto,
} from './dto/post-reaction-state.dto';
import { PostReactionService } from './post-reaction.service';

/** Swagger description of the `:id` path parameter, shared by all routes. */
const PostIdParam = () =>
  ApiParam({ name: 'id', description: 'The post ID', example: 7 });

@ApiTags('POST')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('post')
export class PostReactionController {
  constructor(private readonly reactionService: PostReactionService) {}

  // ==========================================================================
  //  Likes
  // ==========================================================================

  @Put('/:id/like')
  @ApiOperation({ summary: 'Like the post (liking again changes nothing)' })
  @PostIdParam()
  @ApiOkResponse({ type: PostLikeStateDto })
  @ApiNotFoundResponse({ description: 'Unknown post, or a hidden one' })
  likePost(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PostLikeStateDto> {
    return this.reactionService.likePost(id, user.email);
  }

  @Delete('/:id/like')
  @ApiOperation({ summary: 'Remove your like (no like: nothing changes)' })
  @PostIdParam()
  @ApiOkResponse({ type: PostLikeStateDto })
  @ApiNotFoundResponse({ description: 'Unknown post, or a hidden one' })
  unlikePost(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PostLikeStateDto> {
    return this.reactionService.unlikePost(id, user.email);
  }

  /**
   * OLD toggle endpoint, kept so the current Flutter app keeps working.
   * Remove it once the app uses PUT / DELETE /post/:id/like.
   *
   * Note: `:postId` in the path is NOT read; the id comes from the body
   * (PostIdDto). The app sends the literal text "{postId}" in the path.
   */
  @Post('/:postId/like')
  @ApiOperation({
    summary: 'OLD: toggle your like. Use PUT / DELETE /post/{id}/like',
    deprecated: true,
  })
  @ApiBody({ type: PostIdDto })
  @ApiCreatedResponse({ type: PostLikeCountDto })
  toggleLike(
    @GetUser() user: User,
    @Body() postIdDto: PostIdDto,
  ): Promise<PostLikeCountDto> {
    return this.reactionService.toggleLike(postIdDto.postId, user.email);
  }

  // ==========================================================================
  //  Bookmarks
  // ==========================================================================

  @Put('/:id/bookmark')
  @ApiOperation({ summary: 'Bookmark the post (again: nothing changes)' })
  @PostIdParam()
  @ApiOkResponse({ type: PostBookmarkStateDto })
  @ApiNotFoundResponse({ description: 'Unknown post, or a hidden one' })
  bookmarkPost(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PostBookmarkStateDto> {
    return this.reactionService.bookmarkPost(id, user.email);
  }

  @Delete('/:id/bookmark')
  @ApiOperation({ summary: 'Remove the bookmark (none: nothing changes)' })
  @PostIdParam()
  @ApiOkResponse({ type: PostBookmarkStateDto })
  @ApiNotFoundResponse({ description: 'Unknown post, or a hidden one' })
  unbookmarkPost(
    @GetUser() user: User,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<PostBookmarkStateDto> {
    return this.reactionService.unbookmarkPost(id, user.email);
  }
}
