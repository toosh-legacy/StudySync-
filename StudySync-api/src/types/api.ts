import { z } from 'zod';

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'must be a 6-digit hex colour like #1D9E75');

// ---------- Courses ----------
export const courseCreateSchema = z.object({
  name: z.string().trim().min(1).max(256),
  code: z
    .string()
    .trim()
    .max(16)
    .optional()
    .transform((v) => (v ? v.toUpperCase() : undefined)),
  color: hexColor.optional(),
});

export const courseUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(256).optional(),
    code: z
      .string()
      .trim()
      .max(16)
      .optional()
      .nullable()
      .transform((v) => (v ? v.toUpperCase() : v)),
    color: hexColor.optional(),
    archived: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'no fields to update',
  });

export type CourseCreateInput = z.infer<typeof courseCreateSchema>;
export type CourseUpdateInput = z.infer<typeof courseUpdateSchema>;

// ---------- Connections ----------
export const canvasConnectSchema = z.object({
  canvas_url: z.string().url(),
  api_token: z.string().min(10),
});
export const moodleConnectSchema = z.object({
  moodle_url: z.string().url(),
  web_service_token: z.string().min(10),
});
export const obsidianConnectSchema = z.object({
  content: z.string().min(1).max(200_000),
});

// ---------- Sources collect ----------
export const sourceProviderSchema = z.enum([
  'google_drive',
  'notion',
  'canvas',
  'moodle',
  'obsidian',
]);

export const collectRequestSchema = z.object({
  course_id: z.string().uuid(),
  providers: z.array(sourceProviderSchema).min(0).max(5),
  current_page_content: z.string().max(40_000).optional(),
  current_page_url: z.string().url().optional(),
  current_page_title: z.string().max(512).optional(),
});

// ---------- Generate ----------
export const outputFormatSchema = z.enum([
  'flashcards',
  'study_guide',
  'notes',
  'practice_questions',
  'summary',
  'mind_map',
]);
export const depthSchema = z.enum(['quick', 'standard', 'deep']);

export const generateSourceSchema = z.object({
  provider: z.string(),
  source_name: z.string(),
  source_url: z.string().optional().nullable(),
  content: z.string().min(1).max(50_000),
});

export const generateRequestSchema = z.object({
  course_id: z.string().uuid(),
  output_format: outputFormatSchema,
  depth: depthSchema.default('standard'),
  sources: z.array(generateSourceSchema).min(1).max(10),
  user_prompt: z.string().max(1_000).optional(),
});

// ---------- API keys ----------
export const apiKeyCreateSchema = z.object({
  label: z.string().trim().min(1).max(120),
  expires_at: z.string().datetime().optional(),
});

// ---------- Preferences ----------
export const preferencesUpdateSchema = z
  .object({
    default_format: outputFormatSchema.optional(),
    default_depth: depthSchema.optional(),
    auto_scan_page: z.boolean().optional(),
    cache_outputs: z.boolean().optional(),
    spaced_repetition: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'no fields to update' });
