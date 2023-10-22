import { Controller, Get, Post, Delete, Query, UseGuards, ParseIntPipe, Body } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GetUser } from 'src/auth/get-user.decorator';
import { FollowService } from './follow.service';
import { User } from 'src/user/user.entity';
import { AuthGuard } from '@nestjs/passport';
import { UserListDto } from '../user/dto/user-list.dto';
import { SingleIntegerDto } from './dto/single-integer.dto';
import { EmailDto } from 'src/user/dto/email.dto';

@ApiTags('FOLLOW')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('follow')
export class FollowController {

    constructor(
        private followService: FollowService,
    ) { }

    @ApiResponse({
        type: Number,
        status: 201,
        description: 'Total follower count',
    })
    @ApiBody({ type: EmailDto })
    @ApiOperation({ summary: `Create follow` })
    @Post('/')
    createFollow(
        @GetUser() user: User,
        @Body() emailDto: EmailDto,
    ): Promise<SingleIntegerDto> {
        return this.followService.createFollow(user, emailDto.email);
    }

    /// It returns the current user following the user, or not
    @ApiResponse({
        status: 200,
        description: 'Success',
    })
    @ApiQuery({
        name: 'email',
        description: `The other user's email`,
        required: true,
    })
    @ApiOperation({ summary: `Get is following the user, or not` })
    @Get('/isFollowing')
    getIsFollowing(
        @GetUser() user: User,
        @Query('email') email: string,
    ): Promise<boolean> {
        return this.followService.getIsFollowing(user.email, email);
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
        type: Number,
        status: 200,
        description: 'Total follower count',
    })
    @ApiQuery({
        name: 'email',
        description: `The email address of the following user to unfollow`,
        required: true,
    })
    @ApiOperation({ summary: `Unfollow the user` })
    @Delete('/following/cancel')
    cancelFollowing(
        @GetUser() user: User,
        @Query('email') email: string,
    ): Promise<SingleIntegerDto> {
        return this.followService.cancelFollowing(user.email, email);
    }

    @ApiResponse({
        type: UserListDto,
        status: 200,
        description: 'Success',
    })
    @ApiQuery({
        name: 'email',
        description: `The user's email address to fetch`,
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
    @ApiOperation({ summary: `Get follower list` })
    @Get('/follower')
    getFollowerList(
        @Query('email') email: string,
        @Query('page', ParseIntPipe) page: number,
        @Query('limit', ParseIntPipe) limit: number,
    ): Promise<UserListDto> {
        return this.followService.getFollowerList(email, page, limit);
    }

    @ApiResponse({
        type: UserListDto,
        status: 200,
        description: 'Success',
    })
    @ApiQuery({
        name: 'email',
        description: `The user's email address to fetch`,
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
    @ApiOperation({ summary: `Get following list` })
    @Get('/following')
    getFollowingList(
        @Query('email') email: string,
        @Query('page', ParseIntPipe) page: number,
        @Query('limit', ParseIntPipe) limit: number,
    ): Promise<UserListDto> {
        return this.followService.getFollowingList(email, page, limit);
    }

}
