/**
 * ============================================================================
 *  FollowController: HTTP endpoints for following users (/follow/...)
 * ============================================================================
 *
 * Responsibility: HTTP only (routes, parsing, Swagger). Every rule lives in
 * FollowService. All routes require a signed-in user.
 *
 * Query emails are read through EmailQueryDto, so a missing or malformed
 * `?email=` is rejected with 400 by the global ValidationPipe.
 */
import {
  applyDecorators,
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GetUser } from '../auth/get-user.decorator';
import { EmailDto } from '../user/dto/email.dto';
import { UserListDto } from '../user/dto/user-list.dto';
import { User } from '../user/user.entity';
import { EmailQueryDto } from './dto/email-query.dto';
import { IsFollowingDto } from './dto/is-following.dto';
import { SingleIntegerDto } from './dto/single-integer.dto';
import { FollowService } from './follow.service';
import { ParseLimitPipe, ParsePagePipe } from '../common/pipes/paging.pipes';

/**
 * Shared Swagger descriptions for the paginated list endpoints.
 * `applyDecorators` bundles several decorators into one reusable decorator.
 */
const ListQueries = () =>
  applyDecorators(
    ApiQuery({
      name: 'email',
      description: `The user whose list is shown`,
      required: true,
    }),
    ApiQuery({
      name: 'page',
      description: `1-based page number`,
      required: true,
    }),
    ApiQuery({ name: 'limit', description: `Users per page`, required: true }),
  );

@ApiTags('FOLLOW')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('follow')
export class FollowController {
  constructor(private readonly followService: FollowService) {}

  // ==========================================================================
  //  Follow / unfollow
  // ==========================================================================

  @ApiOperation({ summary: `Follow a user` })
  @ApiBody({ type: EmailDto })
  @ApiResponse({
    type: SingleIntegerDto,
    status: 201,
    description: `The followed user's new follower count`,
  })
  @Post('/')
  follow(
    @GetUser() user: User,
    @Body() emailDto: EmailDto,
  ): Promise<SingleIntegerDto> {
    return this.followService.follow(user, emailDto.email);
  }

  @ApiOperation({ summary: `Unfollow a user` })
  @ApiQuery({
    name: 'email',
    description: `The user to unfollow`,
    required: true,
  })
  @ApiResponse({
    type: SingleIntegerDto,
    status: 200,
    description: `The user's follower count afterwards`,
  })
  @Delete('/following/cancel')
  unfollow(
    @GetUser() user: User,
    @Query() query: EmailQueryDto,
  ): Promise<SingleIntegerDto> {
    return this.followService.unfollow(user, query.email);
  }

  // ==========================================================================
  //  Small helpers (not used by the Flutter app; profiles contain the same data)
  // ==========================================================================

  @ApiOperation({ summary: `Whether you follow a user` })
  @ApiQuery({ name: 'email', description: `The other user`, required: true })
  @ApiResponse({ type: IsFollowingDto, status: 200, description: 'Success' })
  @Get('/isFollowing')
  async isFollowing(
    @GetUser() user: User,
    @Query() query: EmailQueryDto,
  ): Promise<IsFollowingDto> {
    return {
      isFollowing: await this.followService.isFollowing(
        user.email,
        query.email,
      ),
    };
  }

  @ApiOperation({ summary: `Your follower count` })
  @ApiResponse({ type: SingleIntegerDto, status: 200, description: 'Success' })
  @Get('/follower/count')
  async getMyFollowerCount(@GetUser() user: User): Promise<SingleIntegerDto> {
    return SingleIntegerDto.of(
      await this.followService.countFollowers(user.email),
    );
  }

  @ApiOperation({ summary: `How many users you follow` })
  @ApiResponse({ type: SingleIntegerDto, status: 200, description: 'Success' })
  @Get('/following/count')
  async getMyFollowingCount(@GetUser() user: User): Promise<SingleIntegerDto> {
    return SingleIntegerDto.of(
      await this.followService.countFollowings(user.email),
    );
  }

  // ==========================================================================
  //  Lists
  // ==========================================================================

  @ApiOperation({ summary: `A user's followers, newest first` })
  @ListQueries()
  @ApiResponse({ type: UserListDto, status: 200, description: 'Success' })
  @Get('/follower')
  getFollowers(
    @Query() query: EmailQueryDto,
    @Query('page', ParsePagePipe) page: number,
    @Query('limit', ParseLimitPipe) limit: number,
  ): Promise<UserListDto> {
    return this.followService.getFollowers(query.email, page, limit);
  }

  @ApiOperation({ summary: `The users a user follows, newest first` })
  @ListQueries()
  @ApiResponse({ type: UserListDto, status: 200, description: 'Success' })
  @Get('/following')
  getFollowings(
    @Query() query: EmailQueryDto,
    @Query('page', ParsePagePipe) page: number,
    @Query('limit', ParseLimitPipe) limit: number,
  ): Promise<UserListDto> {
    return this.followService.getFollowings(query.email, page, limit);
  }
}
