/**
 * ============================================================================
 *  Multer (file upload) options
 * ============================================================================
 *
 * Multer is the library NestJS uses to receive `multipart/form-data` uploads.
 * The controllers that accept images (`PostController` for post images and
 * `UserController` for profile pictures) pass these functions to `diskStorage`
 * and to the upload interceptors.
 *
 * All three functions follow Multer's callback style:
 *   callback(error, result)
 *   - pass `null` as the error when everything is fine
 *   - pass an Error to reject the upload
 */
import { randomUUID } from 'crypto';
import { uploadDirectory } from '../common/storage/image-storage.service';

/**
 * Accepts only image files, judged by their file extension (.jpg, .jpeg, .png).
 *
 * Any other file is rejected with an error before it is written to disk.
 * Note: this checks the NAME only, not the actual file content.
 */
export const imageFileFilter = (req, file, callback) => {
  if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
    return callback(new Error('Only image files are allowed!'), false);
  }
  callback(null, true);
};

/**
 * Gives every uploaded file a new, unique name:
 *   "<current time in ms>-<random id>.<extension>"
 *
 * Example: "my photo.jpeg" → "1794715290261-3f2a9c1e-….jpeg"
 *
 * Renaming avoids two problems with the original names:
 *   - two users uploading "image.jpg" would overwrite each other's files
 *   - original names can contain spaces or characters that break URLs
 *
 * The random part (a UUID) was added because the time alone is NOT unique:
 * the images of one post arrive in the same request, usually within the same
 * millisecond, and got the same name. The last image then overwrote the
 * others on disk, and the post showed one picture several times. The time
 * stays at the front so files still sort by upload time in a folder listing.
 */
export const editFileName = (req, file, callback) => {
  // Everything after the last "." in the original name, e.g. "jpeg".
  // (imageFileFilter already guarantees the name ends in .jpg/.jpeg/.png.)
  const extension = file.originalname.slice(
    file.originalname.lastIndexOf('.') + 1,
  );
  callback(null, `${Date.now()}-${randomUUID()}.${extension}`);
};

/**
 * Decides which folder uploaded images are saved to: `uploadDirectory()`
 * (see common/storage/image-storage.service.ts, which also deletes uploads
 * that are no longer used, from the same folder).
 *
 * It is a FUNCTION (called for every upload) rather than a plain string on
 * purpose: decorator options like `diskStorage({ destination: '...' })` are
 * evaluated once when the file is first imported, which can be before the
 * environment variables are loaded. Reading `process.env` at upload time always
 * sees the final value.
 *
 * Note: Multer does not create the folder when `destination` is a function,
 * so the folder must already exist.
 */
export const uploadDestination = (req, file, callback) => {
  callback(null, uploadDirectory());
};
