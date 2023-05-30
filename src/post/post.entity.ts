import { User } from "src/user/user.entity";
import { BaseEntity, Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { PostStatus } from "./post-status.enum";

@Entity()
export class PostEntity extends BaseEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    title: string;

    @Column()
    description: string;

    @Column()
    status: PostStatus;

    @ManyToOne(() => User, (user) => user.posts, { eager: false })
    user: User;

}

export class PostResponse {
    posts: PostEntity[];
    total: number;
}