import { Hono } from 'hono';

export const healthRouter = new Hono();

healthRouter.get('/', (c) =>
  c.json({ ok: true, service: 'studysync-api', version: '0.1.0' }),
);
