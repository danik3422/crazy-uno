import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterAll, beforeAll, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createUnoServer } from './server';

let app: Awaited<ReturnType<typeof createUnoServer>>;
let dir: string;

beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'uno-'));
  // the real page template, so the test breaks if the meta tags change shape
  await writeFile(path.join(dir, 'index.html'), await readFile(path.resolve(__dirname, '../index.html'), 'utf8'));
  await writeFile(path.join(dir, 'og.jpg'), Buffer.from([0xff, 0xd8, 0xff]));
  await mkdir(path.join(dir, 'assets'));
  await writeFile(path.join(dir, 'assets', 'index-abc123.js'), 'console.log("uno");'.repeat(50));
  await writeFile(path.join(dir, 'sw.js'), 'self.addEventListener("fetch", () => {});');
  app = await createUnoServer({ port: 0, staticDir: dir, limits: { connections: 1e6, rooms: 1e6, badJoins: 1e6 } });
});
afterAll(() => app.close());

const get = async (p: string, lang = 'ru-RU,ru;q=0.9') => {
  const r = await fetch(`http://localhost:${app.port}${p}`, { headers: { 'accept-encoding': 'gzip', 'accept-language': lang } });
  return { status: r.status, enc: r.headers.get('content-encoding'), text: await r.text() };
};

it('serves link previews: absolute image, and who is calling to which room', async () => {
  const plain = await get('/');
  expect(plain.text).toContain(`content="http://localhost:${app.port}/og.jpg"`);
  expect(plain.text).toContain('<meta property="og:title" content="Безумное UNO"');
  expect(plain.text).toContain('<html lang="ru"');
  // the preview speaks the reader's language
  expect((await get('/', 'pl-PL,pl;q=0.9')).text).toContain('<meta property="og:title" content="Szalone UNO"');
  expect((await get('/', 'de-DE')).text).toContain('<meta property="og:title" content="Crazy UNO"');

  const ws = new WebSocket(`ws://localhost:${app.port}/ws`);
  await new Promise(r => ws.once('open', r));
  const joined = new Promise<string>(r => ws.on('message', d => { const m = JSON.parse(String(d)); if (m.t === 'joined') r(m.code); }));
  ws.send(JSON.stringify({ t: 'create', name: 'Аня"><i>x' }));
  const code = await joined;

  const inv = await get(`/?room=${code}`);
  expect(inv.text).toContain('Аня&quot;&gt;&lt;i&gt;x зовёт тебя в UNO');
  expect(inv.text).not.toContain('<i>x');
  expect(inv.text).toContain(`Комната ${code} · 1 игрок за столом`);
  expect(inv.text).toContain(`/?room=${code}"`);

  const img = await fetch(`http://localhost:${app.port}/og.jpg`);
  expect(img.headers.get('content-type')).toBe('image/jpeg');
  ws.close();
});

it('sends the page compressed', async () => {
  const r = await fetch(`http://localhost:${app.port}/`, { headers: { 'accept-encoding': 'gzip' } });
  expect(r.headers.get('content-encoding')).toBe('gzip');
  expect(gunzipSync).toBeTypeOf('function');
});

it('keeps the game files for good, but always checks the page and the service worker', async () => {
  const js = await fetch(`http://localhost:${app.port}/assets/index-abc123.js`, { headers: { 'accept-encoding': 'br' } });
  expect(js.status).toBe(200);
  expect(js.headers.get('content-type')).toContain('text/javascript');
  expect(js.headers.get('cache-control')).toContain('immutable');
  expect(js.headers.get('content-encoding')).toBe('br');
  expect(await js.text()).toContain('console.log("uno")');

  const sw = await fetch(`http://localhost:${app.port}/sw.js`);
  expect(sw.headers.get('cache-control')).toBe('no-cache');
  const page = await fetch(`http://localhost:${app.port}/`);
  expect(page.headers.get('cache-control')).toBe('no-cache');

  // a file of an older build is gone: a plain 404, never the page in its place
  const old = await fetch(`http://localhost:${app.port}/assets/index-old999.js`);
  expect(old.status).toBe(404);
  expect((await fetch(`http://localhost:${app.port}/missing.png`)).status).toBe(404);
});
