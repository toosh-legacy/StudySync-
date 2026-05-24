# @studysync/sdk

Typed TypeScript/JavaScript client for the StudySync API. Works in Node 18+ and
the browser (uses the global `fetch`).

## Install & build

```bash
npm install
npm run build
```

Types in `src/schema.d.ts` are generated from the API's OpenAPI document. To
refresh them, run `npm run sdk:generate` in the `api` package (writes
`sdk/openapi.json` and regenerates `sdk/src/schema.d.ts`).

## Usage

```ts
import { StudySyncClient } from '@studysync/sdk';

const client = new StudySyncClient({
  baseUrl: 'https://api.studysync.example',
  apiKey: 'ss_live_…', // or: token: '<supabase-jwt>'
});

// Buffered generation (idempotent retry-safe)
const result = await client.generate(
  {
    course_id: courseId,
    output_format: 'flashcards',
    depth: 'standard',
    comprehension: 'beginner',
    sources: [{ provider: 'manual', source_name: 'Ch.1', content: '…' }],
  },
  { idempotencyKey: crypto.randomUUID() },
);
console.log(result.output, result.usage.estimated_cost_usd);

// Streaming
await client.generateStream(req, {
  onDelta: (text) => process.stdout.write(text),
  onDone: (res) => console.log('\ndone', res.request_id),
});

// Async job + poll
const { job_id } = await client.createJob({ ...req, callback_url: 'https://you/webhook' });
const job = await client.waitForJob(job_id);

// Usage & cost
const usage = await client.getUsage(30);
```

Errors throw `StudySyncError` with `.status`, `.code`, and `.body`.

## Methods

`generate`, `generateStream`, `createJob`, `getJob`, `waitForJob`,
`listCourses`, `createCourse`, `getCourse`, `updateCourse`, `deleteCourse`,
`getUsage`, `getFormats`, `health`.
