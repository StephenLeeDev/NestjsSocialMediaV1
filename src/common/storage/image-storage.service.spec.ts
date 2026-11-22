/**
 * Unit tests for ImageStorage: which paths count as uploads, and deleting
 * them from the upload folder.
 *
 * Uses a real temporary folder (UPLOAD_DIR), because the point of the class
 * is the file system work; nothing outside that folder is touched.
 *
 * Run with: npm test
 */
import { Logger } from '@nestjs/common';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ImageStorage, isUploadedImage } from './image-storage.service';

describe('isUploadedImage', () => {
  it.each([
    ['1794715290261-3f2a.jpeg', true], // an upload: a plain file name
    ['1794715290261.jpeg', true], // an older upload name
    ['dummy/6.jpeg', false], // a bundled dummy image
    ['default/dafault_thumbnail.png', false], // the default picture
    ['http://old-host/images/1.jpeg', false], // an unmigrated full URL
    ['../outside.jpeg', false], // never anything outside the upload folder
    ['', false],
  ])('%p → %p', (path, expected) => {
    expect(isUploadedImage(path)).toBe(expected);
  });
});

describe('ImageStorage.deleteUploadedImages', () => {
  let folder: string;
  const originalUploadDir = process.env.UPLOAD_DIR;
  const storage = new ImageStorage();

  beforeAll(() => Logger.overrideLogger(false));
  afterAll(() => Logger.overrideLogger(true));

  beforeEach(() => {
    folder = mkdtempSync(join(tmpdir(), 'image-storage-spec-'));
    process.env.UPLOAD_DIR = folder;
  });

  afterEach(() => {
    rmSync(folder, { recursive: true, force: true });
    process.env.UPLOAD_DIR = originalUploadDir;
  });

  /** Creates an empty file in the upload folder and returns its name. */
  const givenUpload = (name: string) => {
    writeFileSync(join(folder, name), '');
    return name;
  };

  it('deletes uploaded files and skips bundled images', async () => {
    const upload = givenUpload('123-abc.jpeg');

    await storage.deleteUploadedImages([upload, 'dummy/6.jpeg']);

    expect(existsSync(join(folder, upload))).toBe(false);
  });

  it('does not fail for a file that is already gone', async () => {
    await expect(
      storage.deleteUploadedImages(['missing.jpeg', 'missing.jpeg']),
    ).resolves.toBeUndefined();
  });
});
