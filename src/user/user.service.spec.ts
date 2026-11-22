/**
 * ============================================================================
 *  UserService unit tests
 * ============================================================================
 *
 * Same approach as the post and comment service tests: UserService is built
 * with FAKE dependencies, so only its own rules are tested, without a database.
 *
 * (Bookmarks moved to PostReactionService with the post_bookmark join table;
 * their tests are in post/reaction/post-reaction.service.spec.ts. Here only
 * the old `bookMarks` field of your own profile is checked.)
 *
 * Run with: npm test
 */
import { NotFoundException } from '@nestjs/common';
import { FollowService } from '../follow/follow.service';
import { PostReactionService } from '../post/reaction/post-reaction.service';
import { User } from './user.entity';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

// ----------------------------------------------------------------------------
//  Test data helpers
// ----------------------------------------------------------------------------

const ME = 'me@gmail.com';
const OTHER = 'other@gmail.com';

/** Builds a user; pass `overrides` to change only what a test cares about. */
function makeUser(email: string, overrides: Partial<User> = {}): User {
  return {
    email,
    username: email.split('@')[0],
    thumbnail: 'thumb.png',
    statusMessage: 'hi',
    ...overrides,
  } as User;
}

const COUNTS = { totalPostCount: 3, followerCount: 2, followingCount: 1 };

// ----------------------------------------------------------------------------
//  The tests
// ----------------------------------------------------------------------------

describe('UserService', () => {
  let userRepository: {
    findOneBy: jest.Mock;
    update: jest.Mock;
    countProfileStats: jest.Mock;
    searchByUsername: jest.Mock;
  };
  let followService: { isFollowing: jest.Mock };
  let reactionService: { getBookmarkedPostIds: jest.Mock };
  let service: UserService;

  beforeEach(() => {
    userRepository = {
      findOneBy: jest.fn(),
      update: jest.fn(),
      countProfileStats: jest.fn().mockResolvedValue(COUNTS),
      searchByUsername: jest.fn(),
    };
    followService = { isFollowing: jest.fn().mockResolvedValue(false) };
    // The viewer has bookmarked posts 5 and 8.
    reactionService = {
      getBookmarkedPostIds: jest.fn().mockResolvedValue([5, 8]),
    };

    service = new UserService(
      userRepository as unknown as UserRepository,
      followService as unknown as FollowService,
      reactionService as unknown as PostReactionService,
    );
  });

  describe('profiles', () => {
    it('includes your bookmarked post ids in your OWN profile', async () => {
      await expect(service.getMyProfile(makeUser(ME))).resolves.toEqual({
        email: ME,
        username: 'me',
        thumbnail: 'thumb.png',
        statusMessage: 'hi',
        ...COUNTS,
        bookMarks: [5, 8],
      });
      expect(reactionService.getBookmarkedPostIds).toHaveBeenCalledWith(ME);
    });

    it("never includes bookmarks in someone else's profile", async () => {
      userRepository.findOneBy.mockResolvedValue(makeUser(OTHER));
      followService.isFollowing.mockResolvedValue(true);

      const profile = await service.getProfile(OTHER, ME);

      expect(profile).toMatchObject({
        email: OTHER,
        isFollowing: true,
        ...COUNTS,
      });
      expect(profile).not.toHaveProperty('bookMarks');
      expect(reactionService.getBookmarkedPostIds).not.toHaveBeenCalled();
      // isFollowing is asked from the VIEWER's point of view.
      expect(followService.isFollowing).toHaveBeenCalledWith(ME, OTHER);
    });

    it('fails with 404 for an unknown user', async () => {
      userRepository.findOneBy.mockResolvedValue(null);

      await expect(service.getProfile(OTHER, ME)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('searchUsers', () => {
    it('treats a missing keyword as "" and excludes the viewer', async () => {
      userRepository.searchByUsername.mockResolvedValue([[makeUser(OTHER)], 1]);

      const result = await service.searchUsers(makeUser(ME), undefined, 1, 10);

      expect(userRepository.searchByUsername).toHaveBeenCalledWith({
        keyword: '',
        excludeEmail: ME,
        page: 1,
        limit: 10,
      });
      // Search results only contain the small public shape of each user.
      expect(result).toEqual({
        userList: [
          {
            email: OTHER,
            username: 'other',
            thumbnail: 'thumb.png',
            statusMessage: 'hi',
          },
        ],
        total: 1,
      });
    });
  });

  describe('thumbnail', () => {
    it('saves and returns the new picture URL', async () => {
      await expect(
        service.updateThumbnail(makeUser(ME), 'http://x/images/1.jpeg'),
      ).resolves.toEqual({ updatedThumbnail: 'http://x/images/1.jpeg' });
      expect(userRepository.update).toHaveBeenCalledWith(
        { email: ME },
        { thumbnail: 'http://x/images/1.jpeg' },
      );
    });
  });
});
