import { describe, it, expect, afterEach } from 'vitest';
import { encryptSecret, decryptSecret, isEncryptionConfigured } from '../../src/lib/crypto.js';

const KEY = 'a'.repeat(64); // 32 bytes hex

afterEach(() => {
  delete process.env.TOKEN_ENCRYPTION_KEY;
});

describe('crypto (with key configured)', () => {
  it('round-trips a secret', () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
    const enc = encryptSecret('super-secret-token')!;
    expect(enc.startsWith('v1:')).toBe(true);
    expect(enc).not.toContain('super-secret-token');
    expect(decryptSecret(enc)).toBe('super-secret-token');
  });

  it('produces different ciphertext each time (random IV)', () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
    expect(encryptSecret('x')).not.toBe(encryptSecret('x'));
  });

  it('treats legacy plaintext (no v1: prefix) as-is on decrypt', () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
    expect(decryptSecret('legacy-plain')).toBe('legacy-plain');
  });

  it('reports configured', () => {
    process.env.TOKEN_ENCRYPTION_KEY = KEY;
    expect(isEncryptionConfigured()).toBe(true);
  });
});

describe('crypto (no key)', () => {
  it('passes through plaintext when no key is set', () => {
    expect(isEncryptionConfigured()).toBe(false);
    expect(encryptSecret('hello')).toBe('hello');
    expect(decryptSecret('hello')).toBe('hello');
  });

  it('handles null/empty', () => {
    expect(encryptSecret(null)).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });
});
