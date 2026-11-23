/**
 * ============================================================================
 *  Image paths (stored) and public image URLs (returned)
 * ============================================================================
 *
 * Images (uploaded post pictures, profile pictures, bundled default/dummy
 * images) live in the `static/images/` folder, which `app.setup.ts` serves at
 * `<SERVER_URL>/images/...`.
 *
 * TWO DIFFERENT THINGS, kept apart on purpose:
 *
 *   image PATH  what the DATABASE stores: the location inside static/images/
 *               "1794715290261.jpeg"            (an upload)
 *               "dummy/6.jpeg"                  (a bundled dummy image)
 *               "default/dafault_thumbnail.png" (the default profile picture)
 *
 *   image URL   what the API RETURNS: the path behind the CURRENT server
 *               address, built by `publicImageUrl` for every response
 *               "http://localhost:3001/images/1794715290261.jpeg"
 *
 * Why not store the URL:
 *   The database used to store full URLs, including the server address at
 *   upload time ("http://192.168.1.251:3001/images/..."). When the server got
 *   another address, every existing image link pointed to the old one and
 *   broke. A path is independent of where the server runs; changing
 *   SERVER_URL in `.env` now moves every image link at once.
 *   (database/migrations/2026-11-22-image-urls-to-paths.sql converted the
 *   existing rows.)
 *
 * Why `process.env` instead of `ConfigService`:
 *   These helpers are plain functions used by mappers, outside of Nest's
 *   dependency injection. `ConfigModule` copies `.env` into `process.env` at
 *   startup, and the functions read it at CALL time, so they see that value.
 */

/**
 * Path of the bundled default profile picture.
 * The file name really is spelled "dafault" (sic); renaming the file would
 * break every row that stores this path.
 */
export const DEFAULT_THUMBNAIL_PATH = 'default/dafault_thumbnail.png';

/**
 * Builds the public URL of a stored image path.
 *
 * @param imagePath Path below `static/images/`, e.g. "1794715290261.jpeg".
 * @returns e.g. "http://localhost:3001/images/1794715290261.jpeg"
 *
 * Safety net: a value that already is a full URL ("http://..." or
 * "https://...") is returned unchanged. That only happens for rows written
 * before the path migration ran; it keeps such a database readable instead
 * of producing "http://host/images/http://old-host/...".
 */
export function publicImageUrl(imagePath: string): string {
  if (/^https?:\/\//.test(imagePath)) {
    return imagePath;
  }
  return `${process.env.SERVER_URL}/images/${imagePath}`;
}
