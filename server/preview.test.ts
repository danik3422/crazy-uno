import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
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
  app = await createUnoServer({ port: 0, staticDir: dir, limits: { connections: 1e6, rooms: 1e6, badJoins: 1e6 } });
});
afterAll(() => app.close());

const get = async (p: string) => {
  const r = await fetch(`http://localhost:${app.port}${p}`, { headers: { 'accept-encoding': 'gzip' } });
  return { status: r.status, enc: r.headers.get('content-encoding'), text: await r.text() };
};

it('serves link previews: absolute image, and who is calling to which room', async () => {
  const plain = await get('/');
  expect(plain.text).toContain(`content="http://localhost:${app.port}/og.jpg"`);
  expect(plain.text).toContain('<meta property="og:title" content="Безумное UNO"');

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
