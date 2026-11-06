import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/global.css';
import './styles/buttons.css';
import './styles/utilities.css';
import App from './app/App';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { applyDocument, onLangChange } from './i18n/core';
import { repaintCards } from './three/textures';

// Card faces are painted onto canvases, so the display font should be ready first.
// On a slow connection we do not wait long: the cards are repainted when the fonts arrive.
const fonts = Promise.all([
  // Cyrillic and Polish letters live in their own font files: ask for both
  document.fonts.load('900 64px "Unbounded"', 'UNO0123456789\u0411\u0415\u0417\u0423\u041c\u041d\u041e\u0415 SZALONEĄĘŁŃÓŚŹŻ'),
  document.fonts.load('700 30px "Rubik"', '\u041f\u041e\u0414\u0410\u0420\u041e\u041a GIFTPREZENTĄĘŁŃÓŚŹŻ'),
]).catch(() => undefined);
applyDocument();
// a new language: card faces print new names on their label strips
onLangChange(() => repaintCards());
let started = false;
const start = () => {
  if (started) return;
  started = true;
  // the last resort: even if the app shell itself breaks, there is a way back
  createRoot(document.getElementById('root')!).render(<ErrorBoundary><App /></ErrorBoundary>);
  // the launch splash (drawn by index.html) fades out once the app has painted its first frame
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      const splash = document.getElementById('splash');
      if (!splash) return;
      splash.classList.add('sp-gone');
      setTimeout(() => splash.remove(), 600);
    }),
  );
};
fonts.then(start);
setTimeout(() => {
  if (started) return;
  start();
  fonts.then(() => repaintCards());
}, 1200);

// the service worker: instant repeat starts and bot games without a connection (built version only)
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol !== 'file:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined);
  });
}
