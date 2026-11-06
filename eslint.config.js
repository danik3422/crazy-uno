// Lint for the client (src), the server and the build config.
// TypeScript's own checks (strict, noUnusedLocals) already run in `npm run build`; this adds the rules of React hooks
// and the usual mistakes TypeScript does not catch.
import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'dist-server', 'node_modules', 'pwa', 'public'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // unused names are TypeScript's job (noUnusedLocals); `_`-prefixed arguments are deliberate
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
);
