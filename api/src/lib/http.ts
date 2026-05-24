import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ZodTypeAny, z } from 'zod';
import { apiError, ErrorCode, type ApiErrorPayload } from './errors.js';

export function sendError(c: Context, err: ApiErrorPayload) {
  // Surface Retry-After on throttling responses so clients back off correctly.
  if (err.status === 429) {
    const retryAfter = Number(err.body.retry_after) || 60;
    c.header('Retry-After', String(retryAfter));
  }
  return c.json(err.body, err.status as ContentfulStatusCode);
}

export async function parseJson<T extends ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: ApiErrorPayload }> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return {
      error: apiError(ErrorCode.VALIDATION_ERROR, 'Body must be valid JSON', 422),
    };
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.length ? first.path.join('.') : 'body';
    return {
      error: apiError(
        ErrorCode.VALIDATION_ERROR,
        `${path}: ${first.message}`,
        422,
      ),
    };
  }
  return { data: result.data };
}

/**
 * Mark a response as deprecated using RFC 8594 headers. Call from any handler/route
 * that is being phased out so clients are warned via Deprecation/Sunset/Link.
 */
export function setDeprecation(
  c: Context,
  opts: { sunset?: string; link?: string } = {},
): void {
  c.header('Deprecation', 'true');
  if (opts.sunset) c.header('Sunset', opts.sunset);
  if (opts.link) c.header('Link', `<${opts.link}>; rel="deprecation"`);
}

export function getUser(c: Context) {
  const user = c.get('user');
  if (!user) {
    throw new Error('getUser called on route without requireAuth middleware');
  }
  return user;
}
