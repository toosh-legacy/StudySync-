import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { createAdminClient } from '../lib/supabase.js';
import { apiError, ErrorCode } from '../lib/errors.js';
import { getUser, parseJson, sendError } from '../lib/http.js';
import { courseCreateSchema, courseUpdateSchema } from '../types/api.js';

export const coursesRouter = new Hono();

const uuidSchema = z.string().uuid();

coursesRouter.use('*', requireAuth);

coursesRouter.get('/', async (c) => {
  const user = getUser(c);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from('courses')
    .select('id, code, name, color, archived, created_at, updated_at')
    .eq('user_id', user.userId)
    .eq('archived', false)
    .order('created_at', { ascending: false });

  if (error) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to load courses', 500));
  }
  return c.json(data);
});

coursesRouter.post('/', async (c) => {
  const user = getUser(c);
  const parsed = await parseJson(c, courseCreateSchema);
  if ('error' in parsed) return sendError(c, parsed.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('courses')
    .insert({
      user_id: user.userId,
      name: parsed.data.name,
      code: parsed.data.code ?? null,
      color: parsed.data.color ?? '#1D9E75',
    })
    .select('id, code, name, color, archived, created_at, updated_at')
    .single();

  if (error || !data) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to create course', 500));
  }
  return c.json(data, 201);
});

async function loadCourse(id: string, userId: string) {
  const admin = createAdminClient();
  return admin
    .from('courses')
    .select('id, code, name, color, archived, created_at, updated_at, user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
}

coursesRouter.get('/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Course not found', 404));
  }
  const { data } = await loadCourse(id, user.userId);
  if (!data) return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Course not found', 404));
  const { user_id: _u, ...rest } = data;
  return c.json(rest);
});

coursesRouter.patch('/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Course not found', 404));
  }
  const parsed = await parseJson(c, courseUpdateSchema);
  if ('error' in parsed) return sendError(c, parsed.error);

  const existing = await loadCourse(id, user.userId);
  if (!existing.data) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Course not found', 404));
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('courses')
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.userId)
    .select('id, code, name, color, archived, created_at, updated_at')
    .single();

  if (error || !data) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to update course', 500));
  }
  return c.json(data);
});

coursesRouter.delete('/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');
  if (!uuidSchema.safeParse(id).success) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Course not found', 404));
  }
  const admin = createAdminClient();
  const { error, count } = await admin
    .from('courses')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', user.userId);

  if (error) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to delete course', 500));
  }
  if (!count) return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Course not found', 404));
  return c.body(null, 204);
});
