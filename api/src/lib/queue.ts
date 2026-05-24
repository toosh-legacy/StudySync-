// Durable job dispatch. Two drivers, chosen at runtime:
//
//   - QStash (when QSTASH_TOKEN is set): the job is published to QStash, which
//     delivers it (with retries) to the internal process endpoint. This survives
//     restarts and scales across instances. Inbound delivery is verified with the
//     QStash signing keys.
//   - Inline (default/dev): the job runs in-process via setImmediate. Durable as a
//     DB record + reaped on timeout, but tied to this instance.
//
// The caller persists the job first; dispatch only triggers the worker.

import { Client, Receiver } from '@upstash/qstash';
import { publicBaseUrl } from './env.js';

// Path the QStash driver delivers to (must be publicly reachable in production).
export const JOB_PROCESS_PATH = '/v1/internal/generation-jobs/process';

let client: Client | undefined;
function getClient(): Client | undefined {
  const token = process.env.QSTASH_TOKEN;
  if (!token) return undefined;
  if (!client) client = new Client({ token });
  return client;
}

export function isQstashEnabled(): boolean {
  return Boolean(process.env.QSTASH_TOKEN);
}

function processUrl(): string {
  const base = publicBaseUrl();
  return `${base}${JOB_PROCESS_PATH}`;
}

/**
 * Dispatch a persisted job. With QStash configured, publishes for durable,
 * cross-instance delivery; otherwise runs `inline` in-process. If QStash publish
 * fails, falls back to inline so the job still runs.
 */
export async function dispatchJob(
  jobId: string,
  inline: (jobId: string) => Promise<void>,
): Promise<'qstash' | 'inline'> {
  const qstash = getClient();
  if (qstash) {
    try {
      await qstash.publishJSON({ url: processUrl(), body: { job_id: jobId } });
      return 'qstash';
    } catch (err) {
      console.error('[queue] QStash publish failed, running inline:', err);
    }
  }
  setImmediate(() => {
    void inline(jobId);
  });
  return 'inline';
}

let receiver: Receiver | undefined;
function getReceiver(): Receiver | undefined {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) return undefined;
  if (!receiver) receiver = new Receiver({ currentSigningKey, nextSigningKey });
  return receiver;
}

/** True when QStash inbound signature verification is configured. */
export function canVerifyQstash(): boolean {
  return getReceiver() !== undefined;
}

/** Verify a QStash delivery signature against the raw body. Never throws. */
export async function verifyQstashSignature(
  signature: string | undefined,
  body: string,
): Promise<boolean> {
  const r = getReceiver();
  if (!r || !signature) return false;
  try {
    return await r.verify({ signature, body, url: processUrl() });
  } catch {
    return false;
  }
}
