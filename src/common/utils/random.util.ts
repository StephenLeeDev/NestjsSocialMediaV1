/**
 * ============================================================================
 *  Random helpers for development dummy data
 * ============================================================================
 *
 * Used by the `/test/dummy` endpoints (dummy posts, dummy comments) that fill
 * the database with sample content during development. Both features used to
 * carry their own copy of these functions; now they share this file.
 *
 * Not meant for anything security related: `Math.random()` is predictable.
 */

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
 * Returns a random whole number between `min` and `max`, both included.
 * Example: randomInt(3, 5) → 3, 4 or 5.
 */
export function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

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
 * Builds a random placeholder sentence ending with a period,
 * e.g. "dolor ut magna Lorem elit."
 *
 * @param minWords Fewest words in the sentence.
 * @param maxWords Most words in the sentence.
 */
export function randomSentence(minWords: number, maxWords: number): string {
  const words = Array.from(
    { length: randomInt(minWords, maxWords) },
    () => LOREM_WORDS[randomInt(0, LOREM_WORDS.length - 1)],
  );
  return `${words.join(' ')}.`;
}
