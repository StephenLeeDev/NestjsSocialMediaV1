import { User } from "src/user/user.entity";
import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { PostStatus } from "./post-status.enum";

@Entity()
export class PostEntity extends BaseEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    description: string;

    @Column()
    status: PostStatus;

    @ManyToOne(() => User, (user) => user.posts, { eager: false })
    @JoinColumn([{ name: 'UserEmail', referencedColumnName: 'email' }])
    user: User;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    @Column('text', { array: true, nullable: false })
    imageUrls: string[];

    @Column('text', { array: true, nullable: false })
    likes: string[];

}

export class PostResponse {
    posts: PostEntity[];
    total: number;
}