import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const upstashConfigured = Boolean(url && token);

let redis: Redis | undefined;
if (upstashConfigured) {
  redis = new Redis({ url: url!, token: token! });
} else {
  console.warn(
    '[ratelimit] Upstash credentials not configured. Rate limits will fail open.',
  );
}

function failOpenLimiter(): Ratelimit {
  return {
    limit: async () => ({
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
      pending: Promise.resolve(),
    }),
  } as unknown as Ratelimit;
}

export const generateLimiter: Ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      analytics: true,
      prefix: 'rl:generate',
    })
  : failOpenLimiter();

export const apiLimiter: Ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, '60 s'),
      analytics: true,
      prefix: 'rl:api',
    })
  : failOpenLimiter();
