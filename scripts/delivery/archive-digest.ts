import { createHash } from 'node:crypto';
import fs from 'node:fs';

export const MAX_CONTENT_ARCHIVE_BYTES = 256 * 1024 * 1024;

export function archiveDigest(file: string, maximum = MAX_CONTENT_ARCHIVE_BYTES) {
  const descriptor = fs.openSync(file, 'r');
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile() || stat.size <= 0 || stat.size > maximum)
      throw new Error('Pages archive exceeds size limit');
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(64 * 1024);
    let bytes = 0;
    for (;;) {
      const count = fs.readSync(descriptor, buffer);
      if (!count) break;
      bytes += count;
      if (bytes > maximum) throw new Error('Pages archive exceeds size limit');
      hash.update(buffer.subarray(0, count));
    }
    return { bytes, sha256: `sha256:${hash.digest('hex')}` };
  } finally {
    fs.closeSync(descriptor);
  }
}
