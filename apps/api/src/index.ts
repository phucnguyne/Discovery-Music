// apps/api/src/index.ts
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { compress } from 'hono/compress';
import { API_PORT, WEB_ORIGIN } from '@music/config';
import { catalog } from './routes/catalog.js';
import { auth } from './routes/auth.js';
import { me } from './routes/me.js';

// A crash outside any single request (a bad startup import, a rejected
// promise nobody awaited) would otherwise take the whole process down
// silently or with an unhelpful default trace — log it clearly instead,
// so a crash-loop shows up as a readable line in whatever's tailing this
// process's stdout (Render's logs, a `pm2 logs`, etc.), not a blank exit.
process.on('unhandledRejection', (reason) => {
  // eslint-disable-next-line no-console
  console.error('@music/api: unhandled rejection', reason);
});
process.on('uncaughtException', (err) => {
  // eslint-disable-next-line no-console
  console.error('@music/api: uncaught exception', err);
});

const app = new Hono();

app.use(
  '*',
  cors({
    origin: WEB_ORIGIN,
    allowMethods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
  }),
);

// gzip/deflate every response above hono's default size threshold — the
// catalog JSON responses (search results, artist profiles) are the ones
// that actually benefit; tiny responses (auth, /health) pass through
// basically free.
app.use('*', compress());

// One structured line per request: method, path, status, and how long it
// took. This is the "monitoring" a small single-instance API actually
// needs day to day — enough to grep for slow endpoints or a spike in 5xx
// from whatever's collecting this process's stdout, without wiring up a
// separate APM service for a project this size.
app.use('*', async (c, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  // eslint-disable-next-line no-console
  console.log(`${c.req.method} ${c.req.path} ${c.res.status} ${ms}ms`);
});

app.get('/health', (c) => c.json({ ok: true, service: '@music/api' }));

app.route('/catalog', catalog);
app.route('/auth', auth);
app.route('/me', me);

app.notFound((c) => c.json({ ok: false, error: 'not found' }, 404));

app.onError((err, c) => {
  // eslint-disable-next-line no-console
  console.error('@music/api: unhandled error', err);
  return c.json({ ok: false, error: 'internal server error' }, 500);
});

serve({ fetch: app.fetch, port: API_PORT, hostname: '0.0.0.0' }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`@music/api listening on http://0.0.0.0:${info.port}`);
});