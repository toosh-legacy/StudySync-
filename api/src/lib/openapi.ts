import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  generateRequestSchema,
  courseCreateSchema,
  courseUpdateSchema,
  preferencesUpdateSchema,
  apiKeyCreateSchema,
  collectRequestSchema,
} from '../types/api.js';
import { publicBaseUrl } from './env.js';

function schema(_name: string, z: Parameters<typeof zodToJsonSchema>[0]) {
  // Inline ($refStrategy 'none') so each component is a self-contained OpenAPI 3
  // schema with no Swagger-style $ref/definitions wrapper.
  return zodToJsonSchema(z, { target: 'openApi3', $refStrategy: 'none' });
}

/**
 * Hand-assembled OpenAPI 3.1 document. Request bodies are derived from the live
 * zod schemas via zod-to-json-schema so the spec stays in sync with validation.
 */
export function buildOpenApiSpec(): Record<string, unknown> {
  const baseUrl = publicBaseUrl();

  const errorResponse = {
    description: 'Error',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
            status: { type: 'integer' },
          },
          required: ['error', 'message', 'status'],
        },
      },
    },
  };

  const bearer = [{ bearerAuth: [] }, { apiKeyAuth: [] }];

  return {
    openapi: '3.1.0',
    info: {
      title: 'StudySync API',
      version: '0.1.0',
      description:
        'Generate study artifacts (flashcards, study guides, notes, practice questions, summaries, mind maps) from course material using OpenAI.',
    },
    servers: [{ url: baseUrl }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        apiKeyAuth: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
      schemas: {
        GenerateRequest: schema('GenerateRequest', generateRequestSchema),
        CourseCreate: schema('CourseCreate', courseCreateSchema),
        CourseUpdate: schema('CourseUpdate', courseUpdateSchema),
        PreferencesUpdate: schema('PreferencesUpdate', preferencesUpdateSchema),
        ApiKeyCreate: schema('ApiKeyCreate', apiKeyCreateSchema),
        CollectRequest: schema('CollectRequest', collectRequestSchema),
      },
    },
    paths: {
      '/v1/healthz': {
        get: {
          summary: 'Health check',
          security: [],
          responses: { '200': { description: 'Service is healthy' } },
        },
      },
      '/v1/meta/formats': {
        get: {
          summary: 'Describe supported formats, depths, comprehension levels, models, and limits',
          security: [],
          responses: { '200': { description: 'Capability descriptor' } },
        },
      },
      '/v1/generate': {
        post: {
          summary: 'Generate a study artifact (buffered JSON response)',
          security: bearer,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenerateRequest' },
              },
            },
          },
          responses: {
            '200': { description: 'Generated output' },
            '403': errorResponse,
            '404': errorResponse,
            '422': errorResponse,
            '429': errorResponse,
            '503': errorResponse,
          },
        },
      },
      '/v1/generate/stream': {
        post: {
          summary: 'Generate a study artifact (Server-Sent Events stream)',
          description:
            'Emits `meta`, then `delta` events with raw token text, then a final `done` event with the persisted output and usage. Errors arrive as an `error` event.',
          security: bearer,
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/GenerateRequest' },
              },
            },
          },
          responses: { '200': { description: 'text/event-stream' } },
        },
      },
      '/v1/courses': {
        get: { summary: 'List courses', security: bearer, responses: { '200': { description: 'Courses' } } },
        post: {
          summary: 'Create course',
          security: bearer,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CourseCreate' } } },
          },
          responses: { '201': { description: 'Created' }, '422': errorResponse },
        },
      },
      '/v1/courses/{id}': {
        get: { summary: 'Get course', security: bearer, responses: { '200': { description: 'Course' }, '404': errorResponse } },
        patch: {
          summary: 'Update course',
          security: bearer,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CourseUpdate' } } },
          },
          responses: { '200': { description: 'Updated' }, '404': errorResponse },
        },
        delete: { summary: 'Delete course', security: bearer, responses: { '204': { description: 'Deleted' }, '404': errorResponse } },
      },
      '/v1/preferences': {
        get: { summary: 'Get preferences', security: bearer, responses: { '200': { description: 'Preferences' } } },
        patch: {
          summary: 'Update preferences',
          security: bearer,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/PreferencesUpdate' } } },
          },
          responses: { '200': { description: 'Updated' }, '422': errorResponse },
        },
      },
      '/v1/keys': {
        get: { summary: 'List API keys', security: bearer, responses: { '200': { description: 'Keys' } } },
        post: {
          summary: 'Create API key',
          security: bearer,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiKeyCreate' } } },
          },
          responses: { '201': { description: 'Created (raw key shown once)' }, '403': errorResponse },
        },
      },
      '/v1/keys/{id}': {
        delete: { summary: 'Revoke API key', security: bearer, responses: { '204': { description: 'Revoked' }, '404': errorResponse } },
      },
      '/v1/vault': {
        get: { summary: 'List generated outputs', security: bearer, responses: { '200': { description: 'Outputs' } } },
      },
      '/v1/vault/{id}': {
        get: { summary: 'Get generated output', security: bearer, responses: { '200': { description: 'Output' }, '404': errorResponse } },
        delete: { summary: 'Delete generated output', security: bearer, responses: { '204': { description: 'Deleted' }, '404': errorResponse } },
      },
      '/v1/sources/collect': {
        post: {
          summary: 'Collect source content from connected providers',
          security: bearer,
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CollectRequest' } } },
          },
          responses: { '200': { description: 'Collected sources' }, '404': errorResponse, '422': errorResponse },
        },
      },
      '/v1/connections': {
        get: { summary: 'List source connections', security: bearer, responses: { '200': { description: 'Connections' } } },
      },
      '/v1/dashboard/stats': {
        get: { summary: 'Usage statistics', security: bearer, responses: { '200': { description: 'Stats' } } },
      },
      '/v1/shares/{id}': {
        get: { summary: 'Get a publicly shared output', security: [], responses: { '200': { description: 'Shared output' }, '404': errorResponse } },
      },
    },
  };
}
