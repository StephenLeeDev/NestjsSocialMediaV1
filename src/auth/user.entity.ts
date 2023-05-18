import { PostEntity } from "src/post/post.entity";
import { BaseEntity, Column, Entity, OneToMany, PrimaryGeneratedColumn, Unique } from "typeorm";
import * as bcrypt from 'bcryptjs';


@Entity()
@Unique(['socialToken', 'email'])
export class User extends BaseEntity {

    @Column({ primary: true })
    socialToken: string;
  
    @Column()
    socialType: string;

    @Column()
    username: string;

    @Column()
    email: string;

    @OneToMany(type => PostEntity, post => post.user, { eager: true })
    posts: PostEntity[];

}