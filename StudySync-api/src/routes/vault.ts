import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { createAdminClient } from '../lib/supabase.js';
import { apiError, ErrorCode } from '../lib/errors.js';
import { getUser, parseJson, sendError } from '../lib/http.js';

export const vaultRouter = new Hono();
vaultRouter.use('*', requireAuth);

const uuid = z.string().uuid();

const queryShape = z.object({
  course_id: z.string().uuid().optional(),
  output_format: z
    .enum(['flashcards', 'study_guide', 'notes', 'practice_questions', 'summary', 'mind_map'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

vaultRouter.get('/', async (c) => {
  const user = getUser(c);
  const params = c.req.query();
  const parsed = queryShape.safeParse(params);
  if (!parsed.success) {
    return sendError(
      c,
      apiError(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0].message, 422),
    );
  }
  const { course_id, output_format, limit, offset } = parsed.data;

  const admin = createAdminClient();
  let query = admin
    .from('generated_outputs')
    .select(
      'id, course_id, output_format, depth, sources_used_count, prompt_tokens, completion_tokens, cache_hit, output, created_at',
    )
    .eq('user_id', user.userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (course_id) query = query.eq('course_id', course_id);
  if (output_format) query = query.eq('output_format', output_format);

  const { data, error } = await query;
  if (error) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to load vault', 500));
  }

  const items = data.map((row) => {
    const previewSource = JSON.stringify(row.output).slice(0, 200);
    const { output: _o, ...rest } = row;
    return { ...rest, preview: previewSource };
  });

  return c.json({ items, limit, offset });
});

vaultRouter.get('/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Output not found', 404));
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from('generated_outputs')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.userId)
    .maybeSingle();
  if (!data) return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Output not found', 404));
  return c.json(data);
});

vaultRouter.delete('/:id', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Output not found', 404));
  }
  const admin = createAdminClient();
  const { error, count } = await admin
    .from('generated_outputs')
    .delete({ count: 'exact' })
    .eq('id', id)
    .eq('user_id', user.userId);

  if (error) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to delete', 500));
  }
  if (!count) return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Output not found', 404));
  return c.body(null, 204);
});

const shareBody = z.object({ public_share: z.boolean() });

vaultRouter.patch('/:id/share', async (c) => {
  const user = getUser(c);
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Output not found', 404));
  }
  const parsed = await parseJson(c, shareBody);
  if ('error' in parsed) return sendError(c, parsed.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from('generated_outputs')
    .update({ public_share: parsed.data.public_share })
    .eq('id', id)
    .eq('user_id', user.userId)
    .select('id, public_share')
    .maybeSingle();
  if (error) {
    return sendError(c, apiError(ErrorCode.INTERNAL_ERROR, 'Failed to update share', 500));
  }
  if (!data) return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Output not found', 404));

  return c.json({
    public_share: data.public_share,
    share_url: data.public_share ? `/share/${data.id}` : null,
  });
});
