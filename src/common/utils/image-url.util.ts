/**
 * ============================================================================
 *  Public image URLs
 * ============================================================================
 *
 * Images (uploaded post pictures, profile pictures, bundled default/dummy
 * images) live in the `static/images/` folder, which `app.setup.ts` serves at
 * `<SERVER_URL>/images/...`.
 *
 * The API returns FULL URLs (e.g. "http://192.168.0.10:3001/images/123.jpeg")
 * because the Flutter app loads images directly from them. Every such URL is
 * built here, from the `SERVER_URL` setting, so that:
 *   - no IP address or host name is hard-coded anywhere in the source code
 *   - moving the server (another Wi-Fi network, a real domain, CI) only needs
 *     a different SERVER_URL in `.env`
 *
 * Why `process.env` instead of `ConfigService`:
 *   These helpers are also used outside of Nest's dependency injection (for
 *   example in repositories that build DTOs). `ConfigModule` copies the values
 *   from `.env` into `process.env` when the app starts, and the functions read
 *   it at CALL time (not import time), so they always see the loaded value.
 *
 * Note: URLs that were already saved in the database (e.g. users' thumbnails)
 * keep the host they were created with. Only newly generated URLs follow the
 * current SERVER_URL.
 */

/**
 * Path of the bundled default profile picture, relative to `static/images/`.
 * The file name really is spelled "dafault" (sic). It is NOT renamed because
 * existing users have URLs with this exact name stored in the database.
 */
const DEFAULT_THUMBNAIL_PATH = 'default/dafault_thumbnail.png';

/**
 * Builds the public URL of an image inside `static/images/`.
 *
 * @param relativePath Path below `static/images/`, e.g. "1794715290261.jpeg"
 *                     for an upload or "dummy/3.jpeg" for a bundled image.
 * @returns e.g. "http://localhost:3001/images/1794715290261.jpeg"
 */
export function publicImageUrl(relativePath: string): string {
  return `${process.env.SERVER_URL}/images/${relativePath}`;
}

/**
 * URL of the default profile picture, used for new accounts and when a user
 * deletes their own picture.
 */
export function defaultThumbnailUrl(): string {
  return publicImageUrl(DEFAULT_THUMBNAIL_PATH);
}
