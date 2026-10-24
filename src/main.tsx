import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { repaintCards } from './three/textures';

// Card faces are painted onto canvases, so the display font should be ready first.
// On a slow connection we do not wait long: the cards are repainted when the fonts arrive.
const fonts = Promise.all([
  document.fonts.load('900 64px "Unbounded"', 'UNO0123456789БЕЗУМНОЕ'),
  document.fonts.load('700 30px "Rubik"', 'ПОДАРОК'),
]).catch(() => undefined);
let started = false;
const start = () => {
  if (started) return;
  started = true;
  createRoot(document.getElementById('root')!).render(<App />);
};
fonts.then(start);
setTimeout(() => {
  if (started) return;
  start();
  fonts.then(() => repaintCards());
}, 1200);
