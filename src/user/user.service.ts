/**
 * ============================================================================
 *  UserService: the business rules for users and profiles
 * ============================================================================
 *
 * Layering (same pattern as the post and comment modules):
 *
 *   UserController  → HTTP only
 *        │
 *   UserService     → rules (THIS FILE)
 *        │              - what your own profile shows vs. someone else's
 *        │              - bookmarks: only visible posts, both sides updated
 *        │                together in ONE transaction
 *        │              - search defaults
 *        │
 *   UserRepository  → database queries only
 *   user.mapper.ts  → entity → small response shapes
 *
 * "Viewer" = the signed-in user making the request. Controllers pass the
 * `User` entity that the JWT guard loaded for this request.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { defaultThumbnailUrl } from '../common/utils/image-url.util';
import { FollowRepository } from '../follow/follow.repository';
import { PostEntity } from '../post/post.entity';
import { PostService } from '../post/post.service';
import { UpdatedUserThumbnailDto } from './dto/updated-user-thumbnail.dto';
import { UserInfoIncludingIsFollowingDto } from './dto/user-info-including-isfollowing.dto';
import { UserInfoDto } from './dto/user-info.dto';
import { UserListDto } from './dto/user-list.dto';
import { UserProfileDto } from './dto/user-profile.dto';
import { User } from './user.entity';
import { toUserSummaryDto } from './user.mapper';
import { ProfileCounts, UserRepository } from './user.repository';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    // Only for `isFollowing` on other profiles (follow module refactor next).
    private readonly followRepository: FollowRepository,
    // Owns the post visibility rule; bookmarks follow it.
    private readonly postService: PostService,
    // Gives access to transactions (several writes that succeed or fail together).
    private readonly dataSource: DataSource,
  ) {}

  // ==========================================================================
  //  Profiles
  // ==========================================================================

  /**
   * The viewer's OWN profile, including their private bookmark list.
   */
  async getMyProfile(viewer: User): Promise<UserInfoDto> {
    const counts = await this.userRepository.countProfileStats(viewer.email);

    const profile = this.fillProfile(new UserInfoDto(), viewer, counts);
    profile.bookMarks = viewer.bookMarks;
    return profile;
  }

  /**
   * ANOTHER user's profile, as seen by the viewer: public fields plus whether
   * the viewer follows them. Bookmarks are NOT included (they are private).
   *
   * @throws NotFoundException (404) when no user has this email.
   */
  async getProfile(
    targetEmail: string,
    viewerEmail: string,
  ): Promise<UserInfoIncludingIsFollowingDto> {
    const target = await this.userRepository.findOneBy({ email: targetEmail });
    if (!target) {
      throw new NotFoundException(`User not found`);
    }

    // Independent lookups → run in parallel.
    const [counts, isFollowing] = await Promise.all([
      this.userRepository.countProfileStats(targetEmail),
      this.followRepository.getIsFollowing(viewerEmail, targetEmail),
    ]);

    const profile = this.fillProfile(
      new UserInfoIncludingIsFollowingDto(),
      target,
      counts,
    );
    profile.isFollowing = isFollowing;
    return profile;
  }

  // ==========================================================================
  //  Bookmarks
  // ==========================================================================

  /**
   * Bookmarks the post, or removes the bookmark if it already exists.
   *
   * A bookmark is stored on BOTH sides:
   *   - user.bookMarks        → ids of the posts this user bookmarked
   *   - post.bookMarkedUsers  → emails of the users who bookmarked this post
   *
   * Fixes compared to the old version:
   *   1. The post is checked FIRST (exists and visible to the viewer → else
   *      404). The old code saved the user's list before looking at the post,
   *      so an unknown post id answered 404 but stayed bookmarked.
   *   2. Both lists are updated inside ONE transaction: either both writes
   *      are saved or neither is, so the two sides cannot disagree.
   *   3. The post's list follows the user's list ("bookmarked or not" is
   *      decided once), instead of each side toggling on its own.
   *
   * @throws NotFoundException (404) when the post is missing or hidden.
   */
  async toggleBookmark(viewer: User, postId: number): Promise<void> {
    await this.postService.getVisiblePostEntity(postId, viewer.email);

    await this.dataSource.transaction(async (manager) => {
      // Re-read both rows INSIDE the transaction, so the toggle works on the
      // current values rather than on what was loaded earlier in the request.
      const user = await manager.findOneByOrFail(User, { email: viewer.email });
      const post = await manager.findOneByOrFail(PostEntity, { id: postId });

      const wasBookmarked = user.bookMarks.includes(postId);

      const bookMarks = wasBookmarked
        ? user.bookMarks.filter((id) => id !== postId)
        : [...user.bookMarks, postId];

      // Remove the email on "un-bookmark"; on "bookmark", add it unless it is
      // already there (keeps the list free of duplicates).
      const withoutViewer = post.bookMarkedUsers.filter(
        (email) => email !== viewer.email,
      );
      const bookMarkedUsers = wasBookmarked
        ? withoutViewer
        : [...withoutViewer, viewer.email];

      // `update` writes only the listed column, nothing else of the row.
      await manager.update(User, { email: viewer.email }, { bookMarks });
      await manager.update(PostEntity, { id: postId }, { bookMarkedUsers });
    });
  }

  // ==========================================================================
  //  Profile picture and status message
  // ==========================================================================

  /**
   * Sets the viewer's profile picture.
   *
   * @param imageUrl Public URL of the image Multer has already saved.
   */
  async updateThumbnail(
    viewer: User,
    imageUrl: string,
  ): Promise<UpdatedUserThumbnailDto> {
    return this.setThumbnail(viewer, imageUrl);
  }

  /**
   * "Deletes" the viewer's profile picture, i.e. goes back to the bundled
   * default picture.
   */
  async resetThumbnail(viewer: User): Promise<UpdatedUserThumbnailDto> {
    return this.setThumbnail(viewer, defaultThumbnailUrl());
  }

  /** Changes the viewer's status message ("" clears it). */
  async updateStatusMessage(
    viewer: User,
    statusMessage: string,
  ): Promise<void> {
    await this.userRepository.update(
      { email: viewer.email },
      { statusMessage },
    );
  }

  // ==========================================================================
  //  Search
  // ==========================================================================

  /**
   * Users whose username contains `keyword` (case-sensitive), excluding the
   * viewer, ordered by username.
   *
   * @param keyword A missing keyword is treated like "" (matches everyone).
   *                It used to search for the text "undefined".
   */
  async searchUsers(
    viewer: User,
    keyword: string | undefined,
    page: number,
    limit: number,
  ): Promise<UserListDto> {
    const [users, total] = await this.userRepository.searchByUsername({
      keyword: keyword ?? '',
      excludeEmail: viewer.email,
      page,
      limit,
    });
    return { userList: users.map(toUserSummaryDto), total };
  }

  // ==========================================================================
  //  Private helpers
  // ==========================================================================

  /**
   * Copies the public profile fields into `profile` (a UserInfoDto or a
   * UserInfoIncludingIsFollowingDto) and returns it.
   */
  private fillProfile<T extends UserProfileDto>(
    profile: T,
    user: User,
    counts: ProfileCounts,
  ): T {
    profile.email = user.email;
    profile.username = user.username;
    profile.thumbnail = user.thumbnail;
    profile.statusMessage = user.statusMessage;
    profile.totalPostCount = counts.totalPostCount;
    profile.followerCount = counts.followerCount;
    profile.followingCount = counts.followingCount;
    return profile;
  }

  /** Saves a new profile picture URL and returns it in the response shape. */
  private async setThumbnail(
    viewer: User,
    imageUrl: string,
  ): Promise<UpdatedUserThumbnailDto> {
    await this.userRepository.update(
      { email: viewer.email },
      { thumbnail: imageUrl },
    );

    const result = new UpdatedUserThumbnailDto();
    result.updatedThumbnail = imageUrl;
    return result;
  }
}
