import { User } from "src/auth/user.entity";
import { EntityRepository, Repository } from "typeorm";
import { PostStatus } from "./post-status.enum";
import { PostEntity } from "./post.entity";
import { CreatePostDto } from "./dto/create-post.dto";

@EntityRepository(PostEntity)
export class PostRepository extends Repository<PostEntity> {

    async createPost(createPostDto: CreatePostDto, user: User) : Promise<PostEntity> {
        const {title, description} = createPostDto;

        const post = this.create({ 
            title, 
            description,
            status: PostStatus.PUBLIC,
            user
        })

        await this.save(post);
        return post;
    }
}