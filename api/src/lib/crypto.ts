// AES-256-GCM encryption for secrets at rest (provider OAuth/API tokens).
//
// Ciphertext format: "v1:<iv_b64>:<tag_b64>:<ciphertext_b64>". Values without the
// "v1:" prefix are treated as legacy plaintext and returned as-is on decrypt, so
// existing rows keep working and get upgraded the next time they are written.
//
// The key comes from TOKEN_ENCRYPTION_KEY (64-hex or 32-byte base64; any other
// string is hashed to 32 bytes). If unset, encryption is a no-op passthrough and
// a warning is logged at startup — set it in production.

import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

const PREFIX = 'v1:';

function getKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) return null;
  if (/^[0-9a-fA-F]{64}$/.test(raw)) return Buffer.from(raw, 'hex');
  const b = Buffer.from(raw, 'base64');
  if (b.length === 32) return b;
  // Derive a stable 32-byte key from an arbitrary passphrase.
  return createHash('sha256').update(raw).digest();
}

export function isEncryptionConfigured(): boolean {
  return getKey() !== null;
}

export function encryptSecret(plain: string | null | undefined): string | null {
  if (plain == null || plain === '') return plain ?? null;
  const key = getKey();
  if (!key) return plain; // dev passthrough
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return (
    PREFIX +
    [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':')
  );
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (stored == null) return null;
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext
  const key = getKey();
  if (!key) return stored; // cannot decrypt without a key
  const [ivb, tagb, ctb] = stored.slice(PREFIX.length).split(':');
  const iv = Buffer.from(ivb, 'base64');
  const tag = Buffer.from(tagb, 'base64');
  const ct = Buffer.from(ctb, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
