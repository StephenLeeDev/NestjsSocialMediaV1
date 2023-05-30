import { EntityRepository, Repository } from "typeorm";
import { User } from "./user.entity";
import { UserInfoDto } from "./dto/user-info.dto";
import { NotFoundException } from "@nestjs/common";

@EntityRepository(User)
export class UserRepository extends Repository<User> {
    
    async getUserInfo(email: string): Promise<UserInfoDto> {
        
        const user = await this.findOne({ email });

        if (user) {
            const { email, username, thumbnail } = user;
            return { email, username, thumbnail };
        } else {
            throw new NotFoundException(`User not found.`);
        }
    }
}