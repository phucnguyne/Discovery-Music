// apps/api/src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { API_PORT, WEB_ORIGIN } from '@music/config';
import { catalog } from './routes/catalog.js';
import { auth } from './routes/auth.js';
import { me } from './routes/me.js';

const app = new Hono();

app.use(
  '*',
  cors({
    // Wildcard '*' cannot be combined with credentials: true — browsers
    // reject it outright — so once /auth's cookie exists this has to
    // name an exact origin. WEB_ORIGIN defaults to the Astro dev port;
    // set it per-env (see apps/api/.env.example) for anything else.
    origin: WEB_ORIGIN,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

app.get('/health', (c) => c.json({ ok: true, service: '@music/api' }));

app.route('/catalog', catalog);
app.route('/auth', auth);
app.route('/me', me);

app.notFound((c) => c.json({ ok: false, error: 'not found' }, 404));

serve({ fetch: app.fetch, port: API_PORT }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`@music/api listening on http://localhost:${info.port}`);
});

