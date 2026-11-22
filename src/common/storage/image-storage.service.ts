/**
 * ============================================================================
 *  ImageStorage: the folder uploaded images are saved in, and their cleanup
 * ============================================================================
 *
 * Multer saves uploads into `uploadDirectory()` (see lib/multerOptions.ts),
 * and the database stores each upload's file name as its image path
 * (see common/utils/image-url.util.ts).
 *
 * Before this class existed, NOTHING ever deleted an uploaded file: deleting
 * a post or replacing a profile picture left the old files on disk forever.
 * Services now call `deleteUploadedImages` once the database no longer refers
 * to a file:
 *   - PostService.deletePost        → the post's images
 *   - UserService (thumbnail change) → the previous profile picture
 *
 * WHAT IS NEVER DELETED
 *   Only plain file names ("1794715290261.jpeg") are uploads. The bundled
 *   images live in sub-folders ("default/...", "dummy/...") and are shared by
 *   many rows, so anything with a "/" in it is left alone. This also means a
 *   path can never point outside the upload folder (no "../../etc/passwd").
 *
 * An @Injectable class (rather than plain functions) so that unit tests can
 * replace it with a fake and check WHAT would be deleted, without touching
 * the file system.
 */
import { Injectable, Logger } from '@nestjs/common';
import { unlink } from 'fs/promises';
import { join } from 'path';

/**
 * The folder uploads are saved in.
 *
 * - Default: `./static/images`, which `app.setup.ts` serves at `/images/...`.
 * - Override: the `UPLOAD_DIR` environment variable. The e2e tests point it at
 *   a temporary folder, so test uploads never end up in `static/`.
 *
 * A function (not a constant) so that it reads `process.env` when it is
 * called, after `.env` has been loaded.
 */
export function uploadDirectory(): string {
  return process.env.UPLOAD_DIR || './static/images';
}

/** Whether an image path refers to an uploaded file (not a bundled image). */
export function isUploadedImage(imagePath: string): boolean {
  // Uploads are saved as "<timestamp>.<ext>" directly in the upload folder.
  // Bundled images ("dummy/6.jpeg") and old full URLs contain a "/".
  return imagePath.length > 0 && !imagePath.includes('/');
}

@Injectable()
export class ImageStorage {
  private readonly logger = new Logger(ImageStorage.name);

  /**
   * Deletes the uploaded files among `imagePaths`; bundled images and old
   * full URLs are skipped (see isUploadedImage).
   *
   * Never throws: by the time this runs, the database change has already
   * succeeded, and the request should not fail because of a leftover file.
   *   - a file that is already gone is fine (nothing to do)
   *   - any other problem (e.g. permissions) is logged as a warning
   */
  async deleteUploadedImages(imagePaths: string[]): Promise<void> {
    const uploads = imagePaths.filter(isUploadedImage);

    await Promise.all(
      uploads.map(async (fileName) => {
        try {
          await unlink(join(uploadDirectory(), fileName));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
            this.logger.warn(
              `Could not delete uploaded image ${fileName}: ${String(error)}`,
            );
          }
        }
      }),
    );
  }
}
