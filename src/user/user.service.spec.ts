/**
 * ============================================================================
 *  UserService unit tests
 * ============================================================================
 *
 * Same approach as the post and comment service tests: UserService is built
 * with FAKE dependencies, so only its own rules are tested, without a database.
 *
 * The interesting part is the bookmark toggle, which runs inside a database
 * transaction. The fake DataSource below calls the transaction callback with a
 * fake "entity manager", so the test can inspect exactly what would be written.
 *
 * Run with: npm test
 */
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FollowService } from '../follow/follow.service';
import { PostEntity } from '../post/post.entity';
import { PostService } from '../post/post.service';
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
    bookMarks: [],
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
  let postService: { getVisiblePostEntity: jest.Mock };
  // The fake transaction's entity manager: rows it "finds" and the updates it receives.
  let manager: { findOneByOrFail: jest.Mock; update: jest.Mock };
  let service: UserService;

  beforeEach(() => {
    userRepository = {
      findOneBy: jest.fn(),
      update: jest.fn(),
      countProfileStats: jest.fn().mockResolvedValue(COUNTS),
      searchByUsername: jest.fn(),
    };
    followService = { isFollowing: jest.fn().mockResolvedValue(false) };
    // By default every post is visible.
    postService = { getVisiblePostEntity: jest.fn().mockResolvedValue({}) };
    manager = { findOneByOrFail: jest.fn(), update: jest.fn() };

    // `transaction(callback)` simply runs the callback with the fake manager.
    const dataSource = {
      transaction: jest.fn(async (callback) => callback(manager)),
    };

    service = new UserService(
      userRepository as unknown as UserRepository,
      followService as unknown as FollowService,
      postService as unknown as PostService,
      dataSource as unknown as DataSource,
    );
  });

  describe('profiles', () => {
    it('includes bookmarks in your OWN profile', async () => {
      const me = makeUser(ME, { bookMarks: [5] });

      await expect(service.getMyProfile(me)).resolves.toEqual({
        email: ME,
        username: 'me',
        thumbnail: 'thumb.png',
        statusMessage: 'hi',
        ...COUNTS,
        bookMarks: [5],
      });
    });

    it("never includes bookmarks in someone else's profile", async () => {
      userRepository.findOneBy.mockResolvedValue(
        makeUser(OTHER, { bookMarks: [5] }),
      );
      followService.isFollowing.mockResolvedValue(true);

      const profile = await service.getProfile(OTHER, ME);

      expect(profile).toMatchObject({
        email: OTHER,
        isFollowing: true,
        ...COUNTS,
      });
      expect(profile).not.toHaveProperty('bookMarks');
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

  describe('toggleBookmark', () => {
    /** Makes the fake transaction "find" this user and this post. */
    function givenRows(user: User, post: Partial<PostEntity>) {
      manager.findOneByOrFail.mockImplementation(async (entity) =>
        entity === User ? user : post,
      );
    }

    it('adds the bookmark on BOTH sides', async () => {
      givenRows(makeUser(ME, { bookMarks: [1] }), {
        id: 9,
        bookMarkedUsers: [OTHER],
      });

      await service.toggleBookmark(makeUser(ME), 9);

      expect(manager.update).toHaveBeenCalledWith(
        User,
        { email: ME },
        { bookMarks: [1, 9] },
      );
      expect(manager.update).toHaveBeenCalledWith(
        PostEntity,
        { id: 9 },
        { bookMarkedUsers: [OTHER, ME] },
      );
    });

    it('removes the bookmark on BOTH sides', async () => {
      givenRows(makeUser(ME, { bookMarks: [1, 9] }), {
        id: 9,
        bookMarkedUsers: [OTHER, ME],
      });

      await service.toggleBookmark(makeUser(ME), 9);

      expect(manager.update).toHaveBeenCalledWith(
        User,
        { email: ME },
        { bookMarks: [1] },
      );
      expect(manager.update).toHaveBeenCalledWith(
        PostEntity,
        { id: 9 },
        { bookMarkedUsers: [OTHER] },
      );
    });

    it('repairs a post list that already contained the viewer (no duplicates)', async () => {
      // The two lists disagree (possible with the old code): the user has not
      // bookmarked post 9, but the post already lists the user.
      givenRows(makeUser(ME, { bookMarks: [] }), {
        id: 9,
        bookMarkedUsers: [ME],
      });

      await service.toggleBookmark(makeUser(ME), 9);

      expect(manager.update).toHaveBeenCalledWith(
        PostEntity,
        { id: 9 },
        { bookMarkedUsers: [ME] },
      );
    });

    it('writes nothing when the post is not visible (404)', async () => {
      postService.getVisiblePostEntity.mockRejectedValue(
        new NotFoundException(),
      );

      await expect(
        service.toggleBookmark(makeUser(ME), 9),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(manager.update).not.toHaveBeenCalled();
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
