/**
 * ============================================================================
 *  Dummy users (development only)
 * ============================================================================
 *
 * Ten sample accounts that make an empty development database usable:
 *   - POST /auth/test/dummy       creates them directly
 *   - POST /post/test/dummy       creates them when there are too few authors
 *   - POST /comment/test/dummy    creates them when there are too few authors
 *
 * This file only BUILDS the rows; `UserRepository.insertIfMissing` stores
 * them and skips every email that already exists. So calling any of the
 * endpoints above again is harmless, and a real account that happens to use
 * one of these emails is never overwritten.
 *
 * (Before this refactor the data lived inside AuthRepository, together with
 * its own copy of the "Lorem ipsum" sentence generator.)
 */
import { randomUUID } from 'crypto';
import { AuthSocialType } from '../../auth/auth-social-type.enum';
import { currentSeoulTimestamp } from '../../common/utils/date.util';
import { publicImageUrl } from '../../common/utils/image-url.util';
import { randomInt, randomSentence } from '../../common/utils/random.util';
import { User } from '../user.entity';
import { NewUser, UserRepository } from '../user.repository';

/** The dummy users' names. Each email is the lower-cased name + "@gmail.com". */
const DUMMY_USERNAMES = [
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

/** How many bundled dummy pictures exist (static/images/dummy/1..N.jpeg). */
const DUMMY_IMAGE_COUNT = 20;

/**
 * Builds the ten dummy user rows (not saved yet).
 *
 * Each user gets:
 *   - a random bundled picture as profile thumbnail
 *     (two users may get the same picture; that is fine for sample data)
 *   - a random "Lorem ipsum" status message of 3 to 12 words
 *   - a creation time one millisecond after the previous user, so the users
 *     keep a stable order when sorted by `createdAt`. (The old code achieved
 *     the same by waiting 1 ms between two `save()` calls.)
 */
export function buildDummyUsers(): NewUser[] {
  // Seoul local time, like every other stored timestamp
  // (see common/utils/date.util.ts).
  const start = new Date(currentSeoulTimestamp()).getTime();

  return DUMMY_USERNAMES.map((username, index) => ({
    email: `${username.toLowerCase()}@gmail.com`,
    uuid: randomUUID(),
    username,
    socialType: AuthSocialType.GOOGLE,
    createdAt: new Date(start + index),
    thumbnail: publicImageUrl(`dummy/${randomInt(1, DUMMY_IMAGE_COUNT)}.jpeg`),
    statusMessage: randomSentence(3, 12),
  }));
}

/**
 * Returns up to `count` existing users to act as authors of dummy content,
 * creating the ten dummy users first when there are fewer than `count`.
 *
 * Shared by PostService.createDummyPosts and CommentService.createDummyComments
 * (both used to carry their own copy of these lines).
 *
 * The result can still hold fewer than `count` users when `count` is larger
 * than the number of users after the dummy users were added; callers decide
 * how to handle that.
 */
export async function findOrCreateDummyAuthors(
  userRepository: UserRepository,
  count: number,
): Promise<User[]> {
  const users = await userRepository.find({ take: count });
  if (users.length >= count) {
    return users;
  }
  await userRepository.insertIfMissing(buildDummyUsers());
  return userRepository.find({ take: count });
}
