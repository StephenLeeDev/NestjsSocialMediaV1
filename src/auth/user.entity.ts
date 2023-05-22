import { PostEntity } from "src/post/post.entity";
import { BaseEntity, Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";

@Entity()
@Unique(['email'])
export class User extends BaseEntity {

    @Column({ primary: true })
    email: string;

    @Column()
    socialType: string;

    @Column()
    username: string;

    @OneToMany(type => PostEntity, post => post.user, { eager: true })
    posts: PostEntity[];

}