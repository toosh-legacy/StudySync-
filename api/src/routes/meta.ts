import { Hono } from 'hono';
import type { Context } from 'hono';
import {
  FORMAT_OUTPUT_SHAPES,
  DEPTH_INSTRUCTIONS,
  COMPREHENSION_INSTRUCTIONS,
} from '../lib/openai/prompts.js';
import { MODELS, DEFAULT_MODEL } from '../lib/openai/models.js';
import { buildOpenApiSpec } from '../lib/openapi.js';

// Public, unauthenticated discovery endpoints so external developers can learn
// the API's capabilities without reading the source or holding credentials.
export const metaRouter = new Hono();

const TOTAL_CHAR_LIMIT = 300_000;
const MAX_SOURCES = 10;
const MAX_CHARS_PER_SOURCE = 50_000;

metaRouter.get('/formats', (c) => {
  return c.json({
    output_formats: Object.entries(FORMAT_OUTPUT_SHAPES).map(([id, shape]) => ({
      id,
      output_shape: shape,
    })),
    depths: Object.entries(DEPTH_INSTRUCTIONS).map(([id, description]) => ({
      id,
      description,
    })),
    comprehension_levels: Object.entries(COMPREHENSION_INSTRUCTIONS).map(
      ([id, description]) => ({ id, description }),
    ),
    models: Object.entries(MODELS).map(([id, info]) => ({
      id,
      min_plan: info.minPlan,
      default: id === DEFAULT_MODEL,
      pricing_usd_per_million: info.pricing,
    })),
    limits: {
      max_sources: MAX_SOURCES,
      max_chars_per_source: MAX_CHARS_PER_SOURCE,
      max_total_chars: TOTAL_CHAR_LIMIT,
      max_user_prompt_chars: 1_000,
    },
  });
});

export function openapiHandler(c: Context) {
  return c.json(buildOpenApiSpec());
}

metaRouter.get('/openapi.json', openapiHandler);

// Swagger UI, loaded from CDN, pointed at our OpenAPI document. Public.
const DOCS_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>StudySync API — Reference</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/v1/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
      });
    </script>
  </body>
</html>`;

metaRouter.get('/docs', (c) => c.html(DOCS_HTML));
