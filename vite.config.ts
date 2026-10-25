import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * The single-file build puts the whole app (~1 MB of script) inline in <head>, so nothing is drawn until all of it
 * has arrived. Moving it to the end of <body> lets the browser paint the launch splash straight away.
 * (Module scripts run after the document is parsed either way.)
 */
function scriptsLast(): Plugin {
  return {
    name: 'scripts-last',
    enforce: 'post',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type !== 'asset' || !file.fileName.endsWith('.html')) continue;
        let html = String(file.source);
        const moved: string[] = [];
        const head = html.slice(0, html.indexOf('</head>'));
        let at: number;
        let rest = head;
        while ((at = rest.indexOf('<script type="module"')) !== -1) {
          const end = rest.indexOf('</script>', at) + '</script>'.length;
          moved.push(rest.slice(at, end));
          rest = rest.slice(0, at) + rest.slice(end);
        }
        if (!moved.length) continue;
        html = rest + html.slice(head.length);
        // spliced in by position: the app's code is full of `$&`-like text that String.replace would expand
        const close = html.lastIndexOf('</body>');
        file.source = `${html.slice(0, close)}${moved.join('\n')}\n${html.slice(close)}`;
      }
    },
  };
}

// `npm run build` → one self-contained dist/index.html (easy to share or host anywhere)
export default defineConfig({
  plugins: [react(), viteSingleFile(), scriptsLast()],
  test: { environment: 'node', testTimeout: 60_000 },
});
