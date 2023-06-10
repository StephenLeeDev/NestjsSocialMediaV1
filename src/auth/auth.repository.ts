import { ConflictException, InternalServerErrorException, Logger } from "@nestjs/common";
import { EntityRepository, Repository } from "typeorm";
import { AuthCredentialsDto } from "./dto/auth-credential.dto";
import { User } from "../user/user.entity";
import * as moment from 'moment-timezone';
import { v4 as uuidv4 } from 'uuid';

@EntityRepository(User)
export class AuthRepository extends Repository<User> {

    private logger = new Logger('AuthRepository');

    async createUser(authCredentialsDto: AuthCredentialsDto): Promise<void> {
        const { username, socialType, email } = authCredentialsDto;

        const createdAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss'); // You can set your time zone here
        const uuid = uuidv4();
        const user =
            this.create({
                uuid,
                username, 
                socialType, 
                email, 
                createdAt,
                bookMarks: [],
            });

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