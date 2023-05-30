import { User } from "src/user/user.entity";
import { EntityRepository, Repository } from "typeorm";
import { PostStatus } from "./post-status.enum";
import { PostEntity, PostResponse } from "./post.entity";
import { CreatePostDto } from "./dto/create-post.dto";
import * as moment from 'moment-timezone';
import { Logger } from "@nestjs/common";
import { join } from "path";
import { promises } from 'fs';
import { v4 as uuidv4 } from 'uuid';

@EntityRepository(PostEntity)
export class PostRepository extends Repository<PostEntity> {

    private logger = new Logger('PostRepository');

    async createPost(createPostDto: CreatePostDto, user: User, images: Express.Multer.File[]) : Promise<PostEntity> {
        const { title, description } = createPostDto;
        // const { title, description } = createPostDto;
        const imageUrls = [];

        this.logger.verbose(`title : ${title}`);
        this.logger.verbose(`description : ${description}`);
        this.logger.verbose(`images : ${images}`);
        this.logger.verbose(`images[0].buffer : ${images[0].buffer}`);
        this.logger.verbose(`images[0].mimetype : ${images[0].mimetype}`);
        this.logger.verbose(`images[0].fieldname : ${images[0].fieldname}`);
        this.logger.verbose(`images[0].path : ${images[0].path}`);
        this.logger.verbose(`images[0].destination : ${images[0].destination}`);
        this.logger.verbose(`images[0].size : ${images[0].size}`);

        // Save image files
        await Promise.all(images.map(async (image) => {
            const imagePath = join(__dirname, '..', 'static', 'images', 'uuidv4');
            await promises.writeFile(imagePath, image.buffer);
            imageUrls.push(imagePath);
        }));
  
        const createdAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');
        const post = this.create({ 
            title, 
            description,
            status: PostStatus.PUBLIC,
            user,
            createdAt,
            updatedAt: createdAt,
            imageUrls,
        })

        await this.save(post);
        return post;
    }

    async createPostTest(createPostDto: CreatePostDto, user: User, images: Express.Multer.File) : Promise<PostEntity> {
        const { title, description } = createPostDto;
        const imageUrls = [];

        this.logger.verbose(`title : ${title}`);
        this.logger.verbose(`description : ${description}`);
        this.logger.verbose(`images : ${images}`);
        this.logger.verbose(`images.buffer : ${images.buffer}`);
        this.logger.verbose(`images.mimetype : ${images.mimetype}`);
        this.logger.verbose(`images.fieldname : ${images.fieldname}`);
        this.logger.verbose(`images.path : ${images.path}`);
        this.logger.verbose(`images.destination : ${images.destination}`);
        this.logger.verbose(`images.size : ${images.size}`);

        // Save image files
        // const imagePath = join(__dirname, '..', 'static', 'images', 'uuidv4');
        const imagePath = './upload'
        await promises.writeFile(imagePath, images.buffer);
        imageUrls.push(imagePath);
  
        const createdAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');
        const post = this.create({ 
            title, 
            description,
            status: PostStatus.PUBLIC,
            user,
            createdAt,
            updatedAt: createdAt,
            imageUrls,
        })

        await this.save(post);
        return post;
    }

    async getPostList(user: User, page: number, limit: number): Promise<PostResponse> {

        const query = this.createQueryBuilder('post');
        query
            .where('post.user.email = :email', { email: user.email })
            .andWhere('post.status = :status', { status: PostStatus.PUBLIC })
            .leftJoinAndSelect('post.user', 'user')
            .select(['post.id', 'post.title', 'post.description', 'post.status', 'post.createdAt', 'user.username', 'user.email'])
            .skip((page - 1) * limit)
            .take(limit);

            const [posts, total] = await query.getManyAndCount();

            this.logger.verbose(`post list length : ${posts.length}`);
            this.logger.verbose(`total : ${total}`);
    
            return { posts, total };
    }

}