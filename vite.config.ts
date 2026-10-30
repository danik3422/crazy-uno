import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Writes the service worker (pwa/sw.js) into the build with the list of the game's files and a version.
 * The version changes whenever any file does, so the browser picks the new worker up after each update.
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter(f => f.startsWith('assets/')).map(f => `/${f}`).sort();
      const version = createHash('sha1').update(assets.join('|')).digest('hex').slice(0, 12);
      const src = readFileSync('pwa/sw.js', 'utf8')
        .replace("'__VERSION__'", JSON.stringify(version))
        .replace('__ASSETS__', JSON.stringify(assets));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source: src });
    },
  };
}

/**
 * `npm run build` → dist/: the page and, in dist/assets/, its files named by their content.
 * The big libraries that hardly ever change (three.js, React) are files of their own, so an update of the game
 * downloads only the game's own code; everything else stays in the browser's cache.
 */
export default defineConfig({
  plugins: [react(), serviceWorker()],
  build: {
    // three.js alone is ~720 kB (190 kB compressed); it is one file on purpose, cached for good
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/node_modules\/(three|@react-three|three-stdlib|troika|camera-controls|maath|meshline|stats)/.test(id)) return 'three';
          if (/node_modules\/(react|react-dom|scheduler|zustand|its-fine|use-sync-external-store|suspend-react)/.test(id)) return 'react';
          return 'vendor';
        },
      },
    },
  },
  test: { environment: 'node', testTimeout: 60_000 },
});
