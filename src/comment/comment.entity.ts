import { BaseEntity, Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import { User } from "src/user/user.entity";
import { CommentType } from "./comment-type.enum";
import { PostEntity } from "src/post/post.entity";

@Entity()
export class CommentEntity extends BaseEntity {

    @PrimaryGeneratedColumn()
    id: number;

    @Column()
    content: string;

    @Column({ type: 'enum', enum: CommentType })
    type: CommentType;

    @Column({ nullable: true })
    parentCommentId: number;

    @Column({ nullable: true })
    parentCommentAuthor: string;

    @ManyToOne(() => CommentEntity, comment => comment.childComments)
    @JoinColumn({ name: 'parentCommentId' })
    parentComment: CommentEntity;
  
    @OneToMany(() => CommentEntity, comment => comment.parentComment)
    childComments: CommentEntity[];
    
    @ManyToOne(() => PostEntity, (post) => post.comments, { eager: false })
    @JoinColumn([{ name: 'postId', referencedColumnName: 'id' }])
    post: PostEntity;
    
    @ManyToOne(() => User, (user) => user.posts, { eager: false })
    @JoinColumn([{ name: 'userEmail', referencedColumnName: 'email' }])
    user: User;

    @Column()
    createdAt: Date;

    @Column()
    updatedAt: Date;

    childrenCount: number;
}