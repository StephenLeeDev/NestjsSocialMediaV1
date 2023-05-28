import { User } from "src/auth/user.entity";
import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
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
    @JoinColumn([{ name: 'UserEmail', referencedColumnName: 'email' }])
    user: User;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

}

export class PostResponse {
    posts: PostEntity[];
    total: number;
}