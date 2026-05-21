import { Hono } from 'hono';
import { z } from 'zod';
import { createAdminClient } from '../lib/supabase.js';
import { apiError, ErrorCode } from '../lib/errors.js';
import { sendError } from '../lib/http.js';

export const sharesRouter = new Hono();

const uuid = z.string().uuid();

// Public, unauthenticated endpoint for shared outputs.
sharesRouter.get('/:id', async (c) => {
  const id = c.req.param('id');
  if (!uuid.safeParse(id).success) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Share not found', 404));
  }
  const admin = createAdminClient();
  const { data: output } = await admin
    .from('generated_outputs')
    .select('id, course_id, output_format, depth, output, sources_used_count, created_at, public_share')
    .eq('id', id)
    .eq('public_share', true)
    .maybeSingle();

  if (!output) {
    return sendError(c, apiError(ErrorCode.NOT_FOUND, 'Share not found', 404));
  }

  let course: { name: string; code: string | null } | null = null;
  if (output.course_id) {
    const { data } = await admin
      .from('courses')
      .select('name, code')
      .eq('id', output.course_id)
      .maybeSingle();
    if (data) course = { name: data.name, code: data.code ?? null };
  }

  return c.json({
    id: output.id,
    output_format: output.output_format,
    depth: output.depth,
    output: output.output,
    sources_used_count: output.sources_used_count,
    created_at: output.created_at,
    course,
  });
});
