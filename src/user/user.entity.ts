import { PostEntity } from "src/post/post.entity";
import { BaseEntity, Column, Entity, OneToMany, Unique } from "typeorm";

const port = process.env.PORT || 3001;
const serverUrl = process.env.SERVER_URL || 'http://192.168.1.251'

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

    @Column({ default: `${serverUrl}:${port}/public/images/default_thumbnail.png` })
    thumbnail: string;

}