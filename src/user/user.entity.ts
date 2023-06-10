import { PostEntity } from "src/post/post.entity";
import { BaseEntity, Column, Entity, JoinColumn, OneToMany, Unique } from "typeorm";

const serverUrl = 'http://192.168.1.251:3001'

@Entity()
@Unique(['email'])
export class User extends BaseEntity {

    @Column({ primary: true })
    email: string;

    @Column()
    uuid: string;

    @Column()
    socialType: string;

    @Column()
    username: string;

    @OneToMany(type => PostEntity, post => post.user, { eager: true })
    @JoinColumn([{ name: 'PostID', referencedColumnName: 'id' }])
    posts: PostEntity[];

    // @CreateDateColumn() // UTC
    @Column()
    createdAt: Date;

    @Column({ default: `${serverUrl}/images/default/dafault_thumbnail.png` })
    thumbnail: string;

    @Column('int', { array: true, nullable: false })
    bookMarks: number[];

}