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
 * Gives every uploaded file a new, unique name: "<current time in ms>.<extension>".
 *
 * Example: "my photo.jpeg" → "1794715290261.jpeg"
 *
 * Renaming avoids two problems with the original names:
 *   - two users uploading "image.jpg" would overwrite each other's files
 *   - original names can contain spaces or characters that break URLs
 */
export const editFileName = (req, file, callback) => {
  // Everything after the last "." in the original name, e.g. "jpeg".
  const fileExtName = file.originalname.slice(
    file.originalname.lastIndexOf('.') - 1 + 2,
  );
  const time = Date.now();
  callback(null, `${time}.${fileExtName}`);
};

/**
 * Decides which folder uploaded images are saved to.
 *
 * - Default: `./static/images`, which `app.setup.ts` serves publicly at `/images/...`.
 * - Override: set the `UPLOAD_DIR` environment variable. The e2e tests use this
 *   to write uploads into a temporary folder, so test images never end up in
 *   the project's `static/` folder.
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
  callback(null, process.env.UPLOAD_DIR || './static/images');
};
