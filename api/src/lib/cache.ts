import { createHash } from 'node:crypto';

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export interface CacheKeyParams {
  courseId: string;
  format: string;
  depth: string;
  comprehension: string;
  model: string;
  sourceContents: string[];
}

/**
 * Deterministic cache key for a generation. Order-independent across sources;
 * sensitive to course, format, depth, comprehension level, and model so that
 * changing any user-facing parameter produces a distinct cached output.
 */
export function buildCacheKey(params: CacheKeyParams): string {
  const sortedContentHashes = params.sourceContents
    .map((content) => sha256(content))
    .sort();
  const composite = [
    params.courseId,
    params.format,
    params.depth,
    params.comprehension,
    params.model,
    ...sortedContentHashes,
  ].join(':');
  return sha256(composite);
}
