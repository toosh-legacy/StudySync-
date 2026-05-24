// Writes the live OpenAPI document to sdk/openapi.json so the SDK's types can be
// generated from it (npm run sdk:generate).
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOpenApiSpec } from '../src/lib/openapi.js';

const here = fileURLToPath(new URL('.', import.meta.url)); // api/scripts/
const outDir = resolve(here, '../sdk');
mkdirSync(outDir, { recursive: true });
const out = resolve(outDir, 'openapi.json');
writeFileSync(out, JSON.stringify(buildOpenApiSpec(), null, 2) + '\n', 'utf8');
console.log(`Wrote ${out}`);
