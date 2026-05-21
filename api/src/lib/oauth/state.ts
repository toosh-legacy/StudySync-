import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

function getSecret(): string {
  const secret =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!secret) throw new Error('No secret available for OAuth state signing');
  return secret;
}

export function signOAuthState(payload: { userId: string; provider: string }) {
  const nonce = randomBytes(16).toString('hex');
  const data = JSON.stringify({ ...payload, n: nonce, t: Date.now() });
  const sig = createHmac('sha256', getSecret()).update(data).digest('hex');
  return Buffer.from(JSON.stringify({ d: data, s: sig })).toString('base64url');
}

export function verifyOAuthState(
  state: string,
  expectedProvider: string,
): { userId: string } | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(state, 'base64url').toString('utf8'),
    ) as { d: string; s: string };
    const expectedSig = createHmac('sha256', getSecret())
      .update(decoded.d)
      .digest('hex');
    const a = Buffer.from(decoded.s, 'hex');
    const b = Buffer.from(expectedSig, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(decoded.d) as {
      userId: string;
      provider: string;
      n: string;
      t: number;
    };
    if (payload.provider !== expectedProvider) return null;
    if (Date.now() - payload.t > 10 * 60 * 1000) return null;
    return { userId: payload.userId };
  } catch {
    return null;
  }
}
