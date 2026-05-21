import { createHash } from 'node:crypto';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function buildCacheKey(
  courseId: string,
  format: string,
  depth: string,
  sourceContents: string[],
): string {
  const sortedContentHashes = sourceContents
    .map((content) => sha256(content))
    .sort();
  const composite = [courseId, format, depth, ...sortedContentHashes].join(':');
  return sha256(composite);
}
