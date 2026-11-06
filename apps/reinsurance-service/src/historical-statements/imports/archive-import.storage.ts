import { ServiceUnavailableException } from '@nestjs/common';
import { chmod, lstat, mkdir, realpath, unlink } from 'node:fs/promises';
import { isAbsolute, resolve, sep } from 'node:path';

export const UPLOAD_LIMITS = {
  files: 10,
  fileSize: 16 * 1024 * 1024,
  fields: 1,
  fieldSize: 8192,
  parts: 11,
};
export async function archiveStorageRoot(): Promise<string> {
  const configured = process.env.HISTORICAL_STATEMENTS_UPLOAD_ROOT;
  if (!configured || !isAbsolute(configured))
    throw new ServiceUnavailableException('ARCHIVE_PRIVATE_STORAGE_REQUIRED');
  const root = resolve(configured);
  // Deliberately do not create an unapproved root or write beneath the repository.
  const repository = resolve(__dirname, '../../../../..');
  if (root === repository || root.startsWith(repository + sep))
    throw new ServiceUnavailableException(
      'ARCHIVE_STORAGE_MUST_BE_OUTSIDE_REPOSITORY',
    );
  const st = await lstat(root);
  if (
    !st.isDirectory() ||
    st.isSymbolicLink() ||
    (st.mode & 0o077) !== 0 ||
    (process.getuid && st.uid !== process.getuid()) ||
    (await realpath(root)) !== root
  ) {
    throw new ServiceUnavailableException(
      'ARCHIVE_STORAGE_MUST_BE_PRIVATE_OWNED_DIRECTORY',
    );
  }
  return root;
}
export async function incomingDirectory(): Promise<string> {
  const path = resolve(await archiveStorageRoot(), 'incoming');
  await mkdir(path, { recursive: true, mode: 0o700 });
  const st = await lstat(path);
  if (!st.isDirectory() || st.isSymbolicLink() || (st.mode & 0o077) !== 0)
    throw new ServiceUnavailableException('ARCHIVE_UNSAFE_INCOMING_DIRECTORY');
  return path;
}
export async function removeIncoming(files: Express.Multer.File[]) {
  if (!files.length) return;
  const root = await incomingDirectory();
  await Promise.all(
    files.map(async (file) => {
      if (!file.path.startsWith(root + sep)) return;
      try {
        await chmod(file.path, 0o600);
        await unlink(file.path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }),
  );
}
