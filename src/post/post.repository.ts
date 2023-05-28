import { User } from "src/user/user.entity";
import { EntityRepository, Repository } from "typeorm";
import { PostStatus } from "./post-status.enum";
import { PostEntity } from "./post.entity";
import { CreatePostDto } from "./dto/create-post.dto";
import * as moment from 'moment-timezone';

@EntityRepository(PostEntity)
export class PostRepository extends Repository<PostEntity> {

    async createPost(createPostDto: CreatePostDto, user: User) : Promise<PostEntity> {
        const {title, description} = createPostDto;

        const createdAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');
        const post = this.create({ 
            title, 
            description,
            status: PostStatus.PUBLIC,
            user,
            createdAt,
            updatedAt: createdAt
        })

        await this.save(post);
        return post;
    }
}