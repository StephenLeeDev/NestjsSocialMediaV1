/**
 * ============================================================================
 *  CommentController: HTTP endpoints for comments (/comment/...)
 * ============================================================================
 *
 * Responsibility: HTTP only (routes, parsing, Swagger). Every rule lives in
 * CommentService. All routes require a signed-in user.
 *
 * Route order matters: `/reply` and `/test/dummy` are declared before `/:id`.
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
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../auth/get-user.decorator';
import { User } from '../user/user.entity';
import { CommentService } from './comment.service';
import { CommentInfoDto, CommentInfoListDto } from './dto/comment-info.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateDummyCommentDto } from './dto/create-dummy-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { ParseLimitPipe, ParsePagePipe } from '../common/pipes/paging.pipes';

/** Shared Swagger descriptions for the paging query parameters. */
const PostIdQuery = () =>
  ApiQuery({ name: 'postId', description: `The post's ID`, required: true });
const PageQuery = () =>
  ApiQuery({
    name: 'page',
    description: `1-based page number`,
    required: true,
  });
const LimitQuery = () =>
  ApiQuery({ name: 'limit', description: `Comments per page`, required: true });

@ApiTags('COMMENT')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('comment')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @ApiOperation({
    summary: `Write a comment on a post, or a reply to a top-level comment`,
  })
  @ApiBody({ type: CreateCommentDto })
  @ApiResponse({ type: CommentInfoDto, status: 201, description: 'Created' })
  @Post('/')
  createComment(
    @Body() createCommentDto: CreateCommentDto,
    @GetUser() user: User,
  ): Promise<CommentInfoDto> {
    return this.commentService.createComment(createCommentDto, user);
  }

  @ApiOperation({ summary: `The top-level comments of a post, newest first` })
  @PostIdQuery()
  @PageQuery()
  @LimitQuery()
  @ApiResponse({
    type: CommentInfoListDto,
    status: 200,
    description: 'Success',
  })
  @Get('/')
  getComments(
    @GetUser() user: User,
    // ParseIntPipe turns "3" into 3 and answers 400 for non-numbers.
    @Query('postId', ParseIntPipe) postId: number,
    @Query('page', ParsePagePipe) page: number,
    @Query('limit', ParseLimitPipe) limit: number,
  ): Promise<CommentInfoListDto> {
    return this.commentService.getComments(postId, user.email, page, limit);
  }

  @ApiOperation({ summary: `The replies to a comment, newest first` })
  @ApiQuery({
    name: 'parentCommentId',
    description: `The comment whose replies are listed`,
    required: true,
  })
  @PostIdQuery()
  @PageQuery()
  @LimitQuery()
  @ApiResponse({
    type: CommentInfoListDto,
    status: 200,
    description: 'Success',
  })
  @Get('/reply')
  getReplies(
    @GetUser() user: User,
    @Query('parentCommentId', ParseIntPipe) parentCommentId: number,
    @Query('postId', ParseIntPipe) postId: number,
    @Query('page', ParsePagePipe) page: number,
    @Query('limit', ParseLimitPipe) limit: number,
  ): Promise<CommentInfoListDto> {
    return this.commentService.getReplies(
      parentCommentId,
      postId,
      user.email,
      page,
      limit,
    );
  }

  @ApiOperation({ summary: `Edit your own comment` })
  @ApiBody({ type: UpdateCommentDto })
  @ApiResponse({ type: CommentInfoDto, status: 200, description: 'Success' })
  @Patch('/')
  updateComment(
    @Body() updateCommentDto: UpdateCommentDto,
    @GetUser() user: User,
  ): Promise<CommentInfoDto> {
    return this.commentService.updateComment(updateCommentDto, user);
  }

  @ApiOperation({
    summary: `Create 10 dummy comments or replies (development only)`,
  })
  @ApiBody({ type: CreateDummyCommentDto })
  @ApiResponse({ status: 201, description: 'Created' })
  @Post('/test/dummy')
  createDummyComments(
    @Body() createDummyCommentDto: CreateDummyCommentDto,
    @GetUser() user: User,
  ): Promise<void> {
    return this.commentService.createDummyComments(
      createDummyCommentDto,
      user.email,
    );
  }

  @ApiOperation({ summary: `Delete your own comment (and its replies)` })
  @ApiParam({ name: 'id', description: 'The comment ID to delete' })
  @ApiResponse({ status: 200, description: 'Success' })
  @Delete('/:id')
  deleteComment(
    @Param('id', ParseIntPipe) id: number,
    @GetUser() user: User,
  ): Promise<void> {
    return this.commentService.deleteComment(id, user);
  }
}
