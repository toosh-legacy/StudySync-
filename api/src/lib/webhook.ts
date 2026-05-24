import { createHmac } from 'node:crypto';

// Best-effort signed webhook delivery for async job completion. The receiver
// verifies authenticity via the X-StudySync-Signature header:
//   signature = hex(HMAC_SHA256(secret, rawBody))

function signingSecret(): string {
  return (
    process.env.WEBHOOK_SIGNING_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    'studysync-dev-webhook-secret'
  );
}

export function signPayload(rawBody: string): string {
  return createHmac('sha256', signingSecret()).update(rawBody).digest('hex');
}

/**
 * POST a signed JSON payload to a callback URL with a couple of retries.
 * Returns a short status string for storage; never throws.
 */
export async function deliverWebhook(
  url: string,
  payload: unknown,
  attempts = 3,
): Promise<string> {
  const raw = JSON.stringify(payload);
  const signature = signPayload(raw);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10_000);
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-StudySync-Signature': `sha256=${signature}`,
          'X-StudySync-Event': 'generation.completed',
        },
        body: raw,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));

      if (res.ok) return `delivered:${res.status}`;
      if (res.status < 500) return `failed:${res.status}`; // client error — don't retry
    } catch {
      // network error — fall through to retry
    }
    if (attempt < attempts) {
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  return 'failed:unreachable';
}
