/**
 * ============================================================================
 *  Random content for dummy posts (development only)
 * ============================================================================
 *
 * POST /post/test/dummy fills the database with sample posts so the app has
 * something to show during development. This file decides which bundled
 * images each dummy post gets. (Random sentences and shuffling are shared
 * with dummy comments and live in common/utils/random.util.ts.)
 *
 * The images are the bundled files `static/images/dummy/1.jpeg` ... `20.jpeg`.
 */
import { publicImageUrl } from '../../common/utils/image-url.util';
import { shuffle } from '../../common/utils/random.util';

/** How many bundled dummy images exist (static/images/dummy/1..N.jpeg). */
const DUMMY_IMAGE_COUNT = 20;

/** The most images a single dummy post gets. */
const MAX_IMAGES_PER_POST = 3;

/**
 * Distributes the bundled dummy images over `postCount` posts.
 *
 * Rules (same as before the refactor):
 *   - every post gets at least ONE image
 *   - no post gets more than MAX_IMAGES_PER_POST images
 *   - no image is used twice
 *
 * @returns One list of image URLs per post, e.g.
 *          [[".../dummy/7.jpeg"], [".../dummy/2.jpeg", ".../dummy/15.jpeg"], ...]
 */
export function randomDummyImageSets(postCount: number): string[][] {
  // 1..20 in random order.
  const imageNumbers = shuffle(
    Array.from({ length: DUMMY_IMAGE_COUNT }, (_, index) => index + 1),
  );
  const toUrl = (imageNumber: number) =>
    publicImageUrl(`dummy/${imageNumber}.jpeg`);

  // First pass: one image for every post.
  const imageSets = imageNumbers
    .slice(0, postCount)
    .map((imageNumber) => [toUrl(imageNumber)]);

  // Second pass: hand out the remaining images to random posts, skipping
  // posts that are already full. (Some images may stay unused.)
  for (const imageNumber of imageNumbers.slice(postCount)) {
    const target = imageSets[Math.floor(Math.random() * imageSets.length)];
    if (target.length < MAX_IMAGES_PER_POST) {
      target.push(toUrl(imageNumber));
    }
  }

  return imageSets;
}
