import { Controller, Get, Post, Delete, Query, UseGuards, ParseIntPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser } from 'src/auth/get-user.decorator';
import { FollowService } from './follow.service';
import { User } from 'src/user/user.entity';
import { AuthGuard } from '@nestjs/passport';
import { FollowListDto } from './dto/follow-list.dto';

@ApiTags('FOLLOW')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('follow')
export class FollowController {

    constructor(
        private followService: FollowService,
    ) { }

    @ApiResponse({
        status: 201,
        description: 'Success',
    })
    @ApiQuery({
        name: 'following',
        description: `Following user's email`,
        required: true,
    })
    @ApiOperation({ summary: `Create follow` })
    @Post('/')
    createFollow(
        @GetUser() user: User,
        @Query('following') following: string,
    ): Promise<void> {
        return this.followService.createFollow(user, following);
    }

    @ApiResponse({
        type: Number,
        status: 200,
        description: 'Total follower count',
    })
    @ApiOperation({ summary: `Total follower count` })
    @Get('/follower/count')
    followRepository(
        @GetUser() user: User,
    ): Promise<number> {
        return this.followService.getFollowerCount(user.email);
    }

    @ApiResponse({
        type: Number,
        status: 200,
        description: 'Total following count',
    })
    @ApiOperation({ summary: `Total following count` })
    @Get('/following/count')
    getFollowingCount(
        @GetUser() user: User,
    ): Promise<number> {
        return this.followService.getFollowingCount(user.email);
    }

    @ApiResponse({
        status: 200,
        description: 'Total following count',
    })
    @ApiQuery({
        name: 'following',
        description: `Cancel following`,
        required: true,
    })
    @ApiOperation({ summary: `Total following count` })
    @Delete('/following/cancel')
    cancelFollowing(
        @GetUser() user: User,
        @Query('following') following: string,
    ): Promise<void> {
        return this.followService.cancelFollowing(user.email, following);
    }

    @ApiResponse({
        type: FollowListDto,
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
    @ApiOperation({ summary: `Get follower list` })
    @Get('/follower')
    getFollowerList(
        @GetUser() user: User,
        @Query('page', ParseIntPipe) page: number,
        @Query('limit', ParseIntPipe) limit: number,
    ): Promise<FollowListDto> {
        return this.followService.getFollowerList(user.email, page, limit);
    }

    @ApiResponse({
        type: FollowListDto,
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
    @ApiOperation({ summary: `Get following list` })
    @Get('/following')
    getFollowingList(
        @GetUser() user: User,
        @Query('page', ParseIntPipe) page: number,
        @Query('limit', ParseIntPipe) limit: number,
    ): Promise<FollowListDto> {
        return this.followService.getFollowingList(user.email, page, limit);
    }

}
