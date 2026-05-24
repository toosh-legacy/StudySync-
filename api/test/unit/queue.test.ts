import { describe, it, expect } from 'vitest';
import {
  isQstashEnabled,
  canVerifyQstash,
  verifyQstashSignature,
  dispatchJob,
  JOB_PROCESS_PATH,
} from '../../src/lib/queue.js';

describe('queue (no QStash configured)', () => {
  it('reports QStash disabled', () => {
    expect(isQstashEnabled()).toBe(false);
    expect(canVerifyQstash()).toBe(false);
  });

  it('rejects signature verification when not configured', async () => {
    expect(await verifyQstashSignature('sig', '{}')).toBe(false);
    expect(await verifyQstashSignature(undefined, '{}')).toBe(false);
  });

  it('dispatches inline and runs the worker', async () => {
    let ran = '';
    const driver = await dispatchJob('job-xyz', async (id) => {
      ran = id;
    });
    expect(driver).toBe('inline');
    await new Promise((r) => setImmediate(r));
    expect(ran).toBe('job-xyz');
  });

  it('exposes a stable process path', () => {
    expect(JOB_PROCESS_PATH).toBe('/v1/internal/generation-jobs/process');
  });
});
