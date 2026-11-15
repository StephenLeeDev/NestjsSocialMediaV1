/**
 * ============================================================================
 *  Random content for dummy posts (development only)
 * ============================================================================
 *
 * POST /post/test/dummy fills the database with sample posts so the app has
 * something to show during development. These helpers produce the random
 * sentences and image sets for those posts.
 *
 * They used to be nested functions inside PostService.createDummyPosts.
 * Moving them here keeps the service focused on the actual rules, and makes
 * the randomness easy to read on its own.
 *
 * The images are the bundled files `static/images/dummy/1.jpeg` ... `20.jpeg`.
 */
import { publicImageUrl } from '../../common/utils/image-url.util';

/** How many bundled dummy images exist (static/images/dummy/1..N.jpeg). */
const DUMMY_IMAGE_COUNT = 20;

/** The most images a single dummy post gets. */
const MAX_IMAGES_PER_POST = 3;

/** Words used to build "Lorem ipsum"-style placeholder sentences. */
const LOREM_WORDS = [
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

/**
 * Returns a copy of `items` in random order (Fisher–Yates shuffle).
 * The original array is not modified.
 */
export function shuffle<T>(items: readonly T[]): T[] {
  const result = [...items];
  // Walk backwards and swap each element with a random earlier (or same) one.
  // This gives every possible order the same probability.
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Builds a random placeholder sentence of 3 to 22 words, ending with a period.
 * Example: "dolor ut magna Lorem elit."
 */
export function randomSentence(): string {
  const wordCount = Math.floor(Math.random() * 20) + 3;
  const words = Array.from(
    { length: wordCount },
    () => LOREM_WORDS[Math.floor(Math.random() * LOREM_WORDS.length)],
  );
  return `${words.join(' ')}.`;
}

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
