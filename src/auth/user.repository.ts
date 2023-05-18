import { ConflictException, InternalServerErrorException, Logger } from "@nestjs/common";
import { EntityRepository, Repository } from "typeorm";
import { AuthCredentialsDto } from "./dto/auth-credential.dto";
import { User } from "./user.entity";
import * as bcrypt from 'bcryptjs';

@EntityRepository(User)
export class UserRepository extends Repository<User> {

    private logger = new Logger('UserRepository');

    async createUser(authCredentialsDto: AuthCredentialsDto): Promise<void> {
        const { username, socialType, socialToken, email } = authCredentialsDto;

        const salt = await bcrypt.genSalt();
        const hashedSocialToken = await bcrypt.hash(socialToken, salt);

        const user = this.create({ username, socialType, socialToken: hashedSocialToken, email });

        try {
            await this.save(user);
            this.logger.verbose(`User ${user.email} account has generated`);
        } catch (error) {
            if (error.code === '23505') {
                throw new ConflictException('Existing username');
            } else {
                throw new InternalServerErrorException();
            }
        }
        
    }
}