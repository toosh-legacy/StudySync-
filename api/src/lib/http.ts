import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ZodTypeAny, z } from 'zod';
import { apiError, ErrorCode, type ApiErrorPayload } from './errors.js';

export function sendError(c: Context, err: ApiErrorPayload) {
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

export function getUser(c: Context) {
  const user = c.get('user');
  if (!user) {
    throw new Error('getUser called on route without requireAuth middleware');
  }
  return user;
}
