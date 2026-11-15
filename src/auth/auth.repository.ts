import {
  Injectable,
  ConflictException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { AuthCredentialsDto } from './dto/auth-credential.dto';
import { User } from '../user/user.entity';
import { currentSeoulTimestamp } from '../common/utils/date.util';
import { randomUUID } from 'crypto';
import { AuthSocialType } from './auth-social-type-validation.enum';
import {
  defaultThumbnailUrl,
  publicImageUrl,
} from '../common/utils/image-url.util';

@Injectable()
export class AuthRepository extends Repository<User> {
  constructor(dataSource: DataSource) {
    super(User, dataSource.createEntityManager());
  }

  private logger = new Logger('AuthRepository');

  async createUser(authCredentialsDto: AuthCredentialsDto): Promise<void> {
    const { username, socialType, email } = authCredentialsDto;

    const createdAt = currentSeoulTimestamp(); // Seoul local time, see common/utils/date.util.ts
    const uuid = randomUUID();
    const user = this.create({
      uuid,
      username,
      socialType,
      email,
      createdAt,
      // Every new account starts with the bundled default profile picture.
      thumbnail: defaultThumbnailUrl(),
      bookMarks: [],
    });

    try {
      await this.save(user);
      this.logger.verbose(`User ${user.email} account has generated`);
    } catch (error: any) {
      if (error.code === '23505') {
        throw new ConflictException(
          `Sign up Failed. ${email} account already exists.`,
        );
      } else {
        throw new InternalServerErrorException();
      }
    }
  }

  async createDummyUsers(): Promise<void> {
    const thumbnailsCount = 20;

    const usernames = [
      'Mike',
      'Ash',
      'Jack',
      'Kate',
      'Max',
      'Rose',
      'John',
      'Smith',
      'Susan',
      'Sam',
    ];

    for (let i = 0; i < usernames.length; i++) {
      const username = usernames[i];
      const email = `${username.charAt(0).toLowerCase()}${username.slice(1)}@gmail.com`;
      const thumbnailNumber = Math.floor(Math.random() * thumbnailsCount) + 1;
      const thumbnail = publicImageUrl(`dummy/${thumbnailNumber}.jpeg`);

      const createdAt = currentSeoulTimestamp(); // Seoul local time, see common/utils/date.util.ts
      const uuid = randomUUID();

      const words = [
        'Lorem',
        'ipsum',
        'dolor',
        'sit',
        'amet',
        'consectetur',
        'adipiscing',
        'elit',
        'sed',
        'do',
        'eiusmod',
        'tempor',
        'incididunt',
        'ut',
        'labore',
        'et',
        'dolore',
        'magna',
        'aliqua',
      ];

      function generateRandomSentence(): string {
        const sentenceLength = Math.floor(Math.random() * 10) + 3;

        let sentence = '';

        for (let i = 0; i < sentenceLength; i++) {
          const randomIndex = Math.floor(Math.random() * words.length);
          const word = words[randomIndex];
          sentence += word + ' ';
        }

        sentence = sentence.trim();
        sentence += '.';

        return sentence;
      }

      const user = this.create({
        uuid,
        username,
        socialType: AuthSocialType.GOOGLE,
        email,
        createdAt,
        thumbnail,
        bookMarks: [],
        statusMessage: generateRandomSentence(),
      });

      try {
        await new Promise((resolve) => setTimeout(resolve, 1));
        await this.save(user);
        this.logger.verbose(`User ${user.email} account has been generated`);
      } catch (error: any) {
        if (error.code === '23505') {
          throw new ConflictException(
            `Sign up Failed. ${user.email} account already exists.`,
          );
        } else {
          throw new InternalServerErrorException();
        }
      }
    }
  }
}
