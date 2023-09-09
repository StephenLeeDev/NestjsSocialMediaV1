import { User } from "src/user/user.entity";
import { Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Follow {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => User, user => user.followings)
  follower: User;

  @ManyToOne(() => User, user => user.followers)
  following: User;
}