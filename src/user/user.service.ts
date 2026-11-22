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
 *        │              (bookmarks: post/reaction/post-reaction.service.ts)
 *        │              - search defaults
 *        │
 *   UserRepository  → database queries only
 *   user.mapper.ts  → entity → small response shapes
 *
 * "Viewer" = the signed-in user making the request. Controllers pass the
 * `User` entity that the JWT guard loaded for this request.
 */
import { Injectable, NotFoundException } from '@nestjs/common';
import { ImageStorage } from '../common/storage/image-storage.service';
import {
  DEFAULT_THUMBNAIL_PATH,
  publicImageUrl,
} from '../common/utils/image-url.util';
import { FollowService } from '../follow/follow.service';
import { PostReactionService } from '../post/reaction/post-reaction.service';
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
    // Answers "does the viewer follow this user?" for other profiles.
    private readonly followService: FollowService,
    // Provides the bookmark ids for the old `bookMarks` profile field.
    private readonly reactionService: PostReactionService,
    // Deletes the previous profile picture once it is replaced.
    private readonly imageStorage: ImageStorage,
  ) {}

  // ==========================================================================
  //  Profiles
  // ==========================================================================

  /**
   * The viewer's OWN profile, including their private bookmark list.
   */
  async getMyProfile(viewer: User): Promise<UserInfoDto> {
    // Independent lookups → run in parallel.
    const [counts, bookMarks] = await Promise.all([
      this.userRepository.countProfileStats(viewer.email),
      // Kept for the current Flutter app. Unlike the old array column, this
      // never contains deleted posts or posts that became hidden.
      this.reactionService.getBookmarkedPostIds(viewer.email),
    ]);

    const profile = this.fillProfile(new UserInfoDto(), viewer, counts);
    profile.bookMarks = bookMarks;
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
      this.followService.isFollowing(viewerEmail, targetEmail),
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
  //  Profile picture and status message
  // ==========================================================================

  /**
   * Sets the viewer's profile picture.
   *
   * @param imagePath File name of the image Multer has already saved.
   */
  async updateThumbnail(
    viewer: User,
    imagePath: string,
  ): Promise<UpdatedUserThumbnailDto> {
    return this.setThumbnail(viewer, imagePath);
  }

  /**
   * "Deletes" the viewer's profile picture, i.e. goes back to the bundled
   * default picture.
   */
  async resetThumbnail(viewer: User): Promise<UpdatedUserThumbnailDto> {
    return this.setThumbnail(viewer, DEFAULT_THUMBNAIL_PATH);
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
    // Stored as a path; returned as a full URL (see image-url.util.ts).
    profile.thumbnail = publicImageUrl(user.thumbnail);
    profile.statusMessage = user.statusMessage;
    profile.totalPostCount = counts.totalPostCount;
    profile.followerCount = counts.followerCount;
    profile.followingCount = counts.followingCount;
    return profile;
  }

  /** Saves a new profile picture URL and returns it in the response shape. */
  private async setThumbnail(
    viewer: User,
    imagePath: string,
  ): Promise<UpdatedUserThumbnailDto> {
    // The picture being replaced. `viewer` was loaded by the JWT guard at the
    // start of this request, so this is the current value.
    const previousPath = viewer.thumbnail;

    await this.userRepository.update(
      { email: viewer.email },
      { thumbnail: imagePath },
    );

    // Nothing refers to the previous upload anymore, so its file can go.
    // (ImageStorage skips bundled images such as the default picture, and the
    // check below keeps "reset while already on the default" a no-op.)
    // Known limit: two picture uploads by the same user at the very same
    // moment could leave one orphaned file behind; that is harmless.
    if (previousPath !== imagePath) {
      await this.imageStorage.deleteUploadedImages([previousPath]);
    }

    const result = new UpdatedUserThumbnailDto();
    result.updatedThumbnail = publicImageUrl(imagePath);
    return result;
  }
}
