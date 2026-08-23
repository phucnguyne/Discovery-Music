// apps/api/src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { API_PORT } from '@music/config';
import { catalog } from './routes/catalog.js';

const app = new Hono();

app.use(
  '*',
  cors({
    origin: (origin) => origin ?? '*', // dev-friendly; lock this down per-env in production
    allowMethods: ['GET', 'OPTIONS'],
  }),
);

app.get('/health', (c) => c.json({ ok: true, service: '@music/api' }));

app.route('/catalog', catalog);

app.notFound((c) => c.json({ ok: false, error: 'not found' }, 404));

serve({ fetch: app.fetch, port: API_PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`@music/api listening on http://localhost:${info.port}`);
});
