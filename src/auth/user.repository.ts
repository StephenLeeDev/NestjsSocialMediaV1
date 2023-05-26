import { ConflictException, InternalServerErrorException, Logger } from "@nestjs/common";
import { EntityRepository, Repository } from "typeorm";
import { AuthCredentialsDto } from "./dto/auth-credential.dto";
import { User } from "./user.entity";

@EntityRepository(User)
export class UserRepository extends Repository<User> {

    private logger = new Logger('UserRepository');

    async createUser(authCredentialsDto: AuthCredentialsDto): Promise<void> {
        const { username, socialType, email } = authCredentialsDto;

        const user = this.create({ username, socialType, email });

        try {
            await this.save(user);
            this.logger.verbose(`User ${user.email} account has generated`);
        } catch (error) {
            if (error.code === '23505') {
                throw new ConflictException(`Sign up Failed. ${email} account already exists.`);
            } else {
                throw new InternalServerErrorException();
            }
        }
        
    }
}