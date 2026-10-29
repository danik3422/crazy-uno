import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createUnoServer } from './server';

const dev = process.argv.includes('--dev');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT) || (dev ? 5173 : 8080);

const app = await createUnoServer({ port, dev, staticDir: path.join(root, 'dist') });
console.log(`UNO server: http://localhost:${app.port}${dev ? ' (dev)' : ''}`);

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, async () => {
    await app.close();
    process.exit(0);
  });
}
