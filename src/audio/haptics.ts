import { STORAGE_KEYS, readJson, writeJson } from '../lib/storage';

/**
 * Little buzzes on a phone: a light tap for your turn, stronger for a big penalty or "UNO!".
 *
 * Android (and other browsers with the Vibration API) get real vibration patterns. iPhone Safari has no
 * Vibration API, but since iOS 18 toggling a native switch control gives a short system haptic tick, so on
 * iPhone each pattern is played as a series of those ticks (light only; the strength comes from the rhythm).
 */
type Kind = 'turn' | 'light' | 'medium' | 'heavy' | 'uno' | 'win';

/** vibration patterns in ms (on, off, on, …) */
const PATTERN: Record<Kind, number[]> = {
  turn: [18],
  light: [12],
  medium: [30, 40, 30],
  heavy: [60, 50, 90],
  uno: [25, 35, 25, 35, 50],
  win: [40, 60, 40, 60, 120],
};
/** iPhone: how many ticks, and how far apart (ms) */
const TICKS: Record<Kind, [number, number]> = {
  turn: [1, 0],
  light: [1, 0],
  medium: [2, 70],
  heavy: [3, 60],
  uno: [3, 80],
  win: [4, 110],
};

const canVibrate = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
/** Safari ≥ 17.4 knows `<input type="checkbox" switch>`; iOS 18 makes its toggle tick */
const canTick =
  !canVibrate &&
  typeof document !== 'undefined' &&
  /iPhone|iPad|iPod/.test(navigator.userAgent + (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform) ? ' iPad' : '')) &&
  'switch' in document.createElement('input');

let label: HTMLLabelElement | null = null;
/** one off-screen native switch; clicking its label toggles it and the system plays a haptic tick */
function tick() {
  if (!label) {
    label = document.createElement('label');
    label.setAttribute('aria-hidden', 'true');
    label.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    input.tabIndex = -1;
    label.appendChild(input);
    document.body.appendChild(label);
  }
  label.click();
}

const saved = readJson<{ on?: boolean }>(STORAGE_KEYS.haptics);

export const haptics = {
  /** a phone that can do it at all (the switch in the sound menu is shown only then) */
  supported: canVibrate || canTick,
  on: saved?.on ?? true,
  set(on: boolean) {
    this.on = on;
    writeJson(STORAGE_KEYS.haptics, { on });
    if (on) this.play('light');
  },
  play(kind: Kind) {
    if (!this.on || !this.supported) return;
    try {
      if (canVibrate) navigator.vibrate(PATTERN[kind]);
      else {
        const [n, gap] = TICKS[kind];
        for (let i = 0; i < n; i++) setTimeout(tick, i * gap);
      }
    } catch {
      // some browsers refuse vibration without a recent tap; it is only a nicety
    }
  },
};
