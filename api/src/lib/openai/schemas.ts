// JSON Schemas for OpenAI Structured Outputs (strict mode). Using these instead
// of a plain json_object guarantees the model returns schema-valid JSON, which
// removes the need for a parse-and-retry loop.
//
// Strict mode rules: every object lists all properties in `required` and sets
// `additionalProperties: false`. Recursive structures use $defs + $ref.

import type { OutputFormat } from './prompts.js';

type JsonSchema = Record<string, unknown>;

const sourcesUsed: JsonSchema = {
  type: 'array',
  items: {
    type: 'object',
    additionalProperties: false,
    properties: {
      source_name: { type: 'string' },
      relevance_note: { type: 'string' },
    },
    required: ['source_name', 'relevance_note'],
  },
};

function obj(properties: Record<string, JsonSchema>): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    properties: { ...properties, sources_used: sourcesUsed },
    required: [...Object.keys(properties), 'sources_used'],
  };
}

const FLASHCARDS: JsonSchema = obj({
  cards: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        front: { type: 'string' },
        back: { type: 'string' },
        topic: { type: 'string' },
      },
      required: ['front', 'back', 'topic'],
    },
  },
  total: { type: 'integer' },
});

const STUDY_GUIDE: JsonSchema = obj({
  title: { type: 'string' },
  sections: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        heading: { type: 'string' },
        body: { type: 'string' },
        key_terms: { type: 'array', items: { type: 'string' } },
      },
      required: ['heading', 'body', 'key_terms'],
    },
  },
  summary: { type: 'string' },
});

const NOTES: JsonSchema = obj({
  title: { type: 'string' },
  cue_column: { type: 'array', items: { type: 'string' } },
  notes_column: { type: 'string' },
  summary: { type: 'string' },
});

const PRACTICE_QUESTIONS: JsonSchema = obj({
  questions: {
    type: 'array',
    items: {
      type: 'object',
      additionalProperties: false,
      properties: {
        question: { type: 'string' },
        answer: { type: 'string' },
        difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
        topic: { type: 'string' },
      },
      required: ['question', 'answer', 'difficulty', 'topic'],
    },
  },
  total: { type: 'integer' },
});

const SUMMARY: JsonSchema = obj({
  headline: { type: 'string' },
  key_points: { type: 'array', items: { type: 'string' } },
  detail: { type: 'string' },
});

// Recursive mind map via a self-referencing $def.
const MIND_MAP: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  $defs: {
    node: {
      type: 'object',
      additionalProperties: false,
      properties: {
        concept: { type: 'string' },
        children: { type: 'array', items: { $ref: '#/$defs/node' } },
      },
      required: ['concept', 'children'],
    },
  },
  properties: {
    root: { $ref: '#/$defs/node' },
    sources_used: sourcesUsed,
  },
  required: ['root', 'sources_used'],
};

export const RESPONSE_SCHEMAS: Record<OutputFormat, JsonSchema> = {
  flashcards: FLASHCARDS,
  study_guide: STUDY_GUIDE,
  notes: NOTES,
  practice_questions: PRACTICE_QUESTIONS,
  summary: SUMMARY,
  mind_map: MIND_MAP,
};

/** Build the OpenAI `response_format` for a format's strict structured output. */
export function responseFormatFor(format: OutputFormat) {
  return {
    type: 'json_schema' as const,
    json_schema: {
      name: format,
      strict: true,
      schema: RESPONSE_SCHEMAS[format],
    },
  };
}
