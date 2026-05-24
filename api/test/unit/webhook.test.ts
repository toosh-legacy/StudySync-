import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';
import { signPayload } from '../../src/lib/webhook.js';

describe('signPayload', () => {
  it('produces a deterministic HMAC-SHA256 hex signature', () => {
    const body = JSON.stringify({ job_id: 'x', status: 'completed' });
    const sig = signPayload(body);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
    expect(signPayload(body)).toBe(sig);
  });

  it('verifies against the documented scheme', () => {
    const secret =
      process.env.WEBHOOK_SIGNING_SECRET ??
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      'studysync-dev-webhook-secret';
    const body = '{"a":1}';
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    expect(signPayload(body)).toBe(expected);
  });
});
