import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` → one self-contained dist/index.html (easy to share or host anywhere)
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  test: { environment: 'node', testTimeout: 60_000 },
});
