import { Body, Controller, Delete, Get, Logger, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CommentInfoDto, CommentInfoListDto } from "./dto/comment-info.dto";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { GetUser } from "src/auth/get-user.decorator";
import { User } from "src/user/user.entity";
import { CommentService } from "./comment.service";
import { UpdateCommentDto } from "./dto/update-comment.dto";

@ApiTags('COMMENT')
@UseGuards(AuthGuard())
@ApiBearerAuth('Secret1234')
@Controller('comment')
export class CommentController {

    private logger = new Logger('CommentController');

    constructor(
        private commentService: CommentService
    ) { }

    @ApiResponse({
        type: CommentInfoDto,
        status: 201,
        description: 'Success',
    })
    @ApiBody({ type: CreateCommentDto })
    @ApiOperation({ summary: `Create a comment` })
    @Post('/')
    createComment(
        @Body() commentInfoDto: CommentInfoDto,
        @GetUser() user: User,
    ): Promise<CommentInfoDto> {
        commentInfoDto.email = user.email;
        return this.commentService.createComment(commentInfoDto, user);
    }

    @ApiResponse({
        type: CommentInfoListDto,
        status: 200,
        description: 'Success',
    })
    @ApiQuery({
        name: 'postId',
        description: `The post's ID`,
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
    @ApiOperation({ summary: `Get comments list of the post` })
    @Get('/')
    getCommentList(
        @Query('postId', ParseIntPipe) postId: number,
        @Query('page', ParseIntPipe) page: number,
        @Query('limit', ParseIntPipe) limit: number,
    ): Promise<CommentInfoListDto> {
        return this.commentService.getCommentList(postId, page, limit);
    }

    @ApiResponse({
        type: CommentInfoDto,
        status: 200,
        description: 'Success',
    })
    @ApiBody({ type: UpdateCommentDto })
    @ApiOperation({ summary: `Get comments list of the post` })
    @Patch('/')
    updateComment(
        @Body() updateCommentDto: UpdateCommentDto,
        @GetUser() user: User,
    ): Promise<CommentInfoDto> {
        return this.commentService.updateComment(updateCommentDto, user);
    }

    @ApiResponse({
        status: 200,
        description: 'Success',
    })
    @ApiParam({
      name: 'id',
      required: true,
      description: 'The comment ID to delete',
    })
    @ApiOperation({ summary: `Delete the comment by ID` })
    @Delete('/:id')
    deleteComment(
        @Param('id', ParseIntPipe) id: number,
        @GetUser() user: User,
    ): Promise<void> {
        return this.commentService.deleteComment(id, user);
    }

}