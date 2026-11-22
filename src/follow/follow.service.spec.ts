/**
 * ============================================================================
 *  FollowService unit tests
 * ============================================================================
 *
 * FollowService is built with FAKE repositories, so these tests check only its
 * own rules (self-follow, unknown user, return values), without a database.
 *
 * What these tests can NOT prove: that the database really refuses duplicate
 * follows. That guarantee comes from the unique constraint + ON CONFLICT DO
 * NOTHING, and is covered by the e2e test "following the same user twice is
 * harmless".
 *
 * Run with: npm test
 */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { User } from '../user/user.entity';
import { UserRepository } from '../user/user.repository';
import { FollowRepository } from './follow.repository';
import { FollowService } from './follow.service';

const ME = 'me@gmail.com';
const STAR = 'star@gmail.com';

/** Builds a user with the fields the service and the mapper read. */
function makeUser(email: string): User {
  return {
    email,
    username: email.split('@')[0],
    thumbnail: 'thumb.png',
    statusMessage: 'hi',
  } as User;
}

describe('FollowService', () => {
  let followRepository: {
    insertIfMissing: jest.Mock;
    deleteFollow: jest.Mock;
    countFollowers: jest.Mock;
    findFollowersPage: jest.Mock;
  };
  let userRepository: { existsBy: jest.Mock };
  let service: FollowService;

  beforeEach(() => {
    followRepository = {
      insertIfMissing: jest.fn(),
      deleteFollow: jest.fn(),
      countFollowers: jest.fn().mockResolvedValue(1),
      findFollowersPage: jest.fn(),
    };
    // By default the user to follow exists.
    userRepository = { existsBy: jest.fn().mockResolvedValue(true) };

    service = new FollowService(
      followRepository as unknown as FollowRepository,
      userRepository as unknown as UserRepository,
    );
  });

  describe('follow', () => {
    it("stores the follow and returns the target's new follower count", async () => {
      await expect(service.follow(makeUser(ME), STAR)).resolves.toEqual({
        value: 1,
      });
      expect(followRepository.insertIfMissing).toHaveBeenCalledWith(ME, STAR);
      expect(followRepository.countFollowers).toHaveBeenCalledWith(STAR);
    });

    it('rejects following yourself (400) and stores nothing', async () => {
      await expect(service.follow(makeUser(ME), ME)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(followRepository.insertIfMissing).not.toHaveBeenCalled();
    });

    it('rejects an unknown user (404) and stores nothing', async () => {
      userRepository.existsBy.mockResolvedValue(false);

      await expect(service.follow(makeUser(ME), STAR)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(followRepository.insertIfMissing).not.toHaveBeenCalled();
    });
  });

  describe('unfollow', () => {
    it("removes the follow and returns the target's new follower count", async () => {
      followRepository.countFollowers.mockResolvedValue(0);

      await expect(service.unfollow(makeUser(ME), STAR)).resolves.toEqual({
        value: 0,
      });
      expect(followRepository.deleteFollow).toHaveBeenCalledWith(ME, STAR);
    });
  });

  describe('getFollowers', () => {
    it('returns the small public shape of each follower', async () => {
      followRepository.findFollowersPage.mockResolvedValue([[makeUser(ME)], 1]);

      await expect(service.getFollowers(STAR, 1, 10)).resolves.toEqual({
        userList: [
          {
            email: ME,
            username: 'me',
            thumbnail: 'thumb.png',
            statusMessage: 'hi',
          },
        ],
        total: 1,
      });
    });
  });
});
