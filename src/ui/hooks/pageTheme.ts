import { useEffect, useRef } from 'react';
import type { ThemeId } from '../../game/types';
import './pageBackdrop.css';

const BAT = '<svg viewBox="0 0 64 28"><path d="M32 10c-3-6-9-9-17-8 4 2 5 5 4 8-4-3-11-3-17 1 6 0 9 3 10 7 3-3 7-4 11-2 2-3 5-4 9-2 4-2 7-1 9 2 4-2 8-1 11 2 1-4 4-7 10-7-6-4-13-4-17-1-1-3 0-6 4-8-8-1-14 2-17 8z"/></svg>';
const GRAVES =
  '<svg viewBox="0 0 400 60" preserveAspectRatio="none"><path d="M0 60V44c40-8 80-12 130-10 60 2 110-10 170-8 40 1 70 6 100 10v24z"/>' +
  '<path d="M60 40v-18a10 10 0 0 1 20 0v18zM150 36v-14a8 8 0 0 1 16 0v14zM262 34v-20a11 11 0 0 1 22 0v20zM330 40v-12h-6v-4h6v-6h4v6h6v4h-6v12z"/></svg>';

/* ---------- winter: built once from a seeded random, so it looks the same every time ---------- */

function rand(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}
const f1 = (n: number) => n.toFixed(1);

/**
 * One aurora curtain: a wavy band, bright along its lower edge and feathered upward, made of soft vertical rays
 * of uneven width. `wave` shapes it: base height, two wave amplitudes and phases, thickness.
 */
function aurora(i: number, wave: [number, number, number, number, number], colors: [string, string, string]) {
  const [base, a1, a2, ph, thick] = wave;
  const pts: [number, number][] = [];
  for (let x = -20; x <= 1220; x += 30) pts.push([x, base + Math.sin(x / 170 + ph) * a1 + Math.sin(x / 61 + ph * 2) * a2]);
  const d =
    'M' + pts.map(([x, y]) => `${x} ${f1(y)}`).join('L') +
    'L' + pts.reverse().map(([x, y]) => `${x} ${f1(y - thick - Math.sin(x / 97 + ph) * thick * 0.35)}`).join('L') + 'Z';
  const [c1, c2, c3] = colors;
  // rays of uneven width and strength, repeating only every 97 units
  const rays = [[0, 7, 0.9], [12, 3, 0.5], [21, 11, 0.75], [38, 4, 0.4], [49, 8, 1], [63, 2, 0.5], [71, 13, 0.6], [88, 5, 0.85]]
    .map(([x, w, o]) => `<rect x="${x}" width="${w}" height="10" fill="#fff" opacity="${o}"/>`).join('');
  return (
    `<svg viewBox="0 0 1200 400" preserveAspectRatio="none"><defs>` +
    `<linearGradient id="wa${i}" x1="0" x2="1"><stop offset="0" stop-color="${c1}" stop-opacity="0"/><stop offset=".2" stop-color="${c1}"/>` +
    `<stop offset=".55" stop-color="${c2}"/><stop offset=".8" stop-color="${c3}"/><stop offset="1" stop-color="${c3}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="wv${i}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/>` +
    `<stop offset=".78" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity=".15"/></linearGradient>` +
    `<pattern id="wp${i}" width="97" height="10" patternUnits="userSpaceOnUse" patternTransform="translate(${i * 31} 0)">${rays}</pattern>` +
    `<filter id="wb${i}" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="10"/></filter>` +
    `<filter id="wc${i}"><feGaussianBlur stdDeviation="3.5"/></filter>` +
    `<mask id="wm${i}" maskContentUnits="objectBoundingBox"><rect width="1" height="1" fill="url(#wv${i})"/></mask>` +
    `<mask id="ws${i}"><rect width="1200" height="400" fill="#fff" opacity=".6"/><rect width="1200" height="400" fill="url(#wp${i})" opacity=".45" filter="url(#wc${i})"/></mask>` +
    `</defs><g mask="url(#wm${i})"><path d="${d}" fill="url(#wa${i})" filter="url(#wb${i})" mask="url(#ws${i})"/></g></svg>`
  );
}

/** A row of pines along a gentle ridge, as one silhouette path. */
function ridge(rnd: () => number, base: number, amp: number, hMin: number, hMax: number) {
  let d = `M0 300V${base}`;
  for (let x = 0; x < 1220; x += 10 + rnd() * 16) {
    const y = base - Math.sin(x / 190) * amp - Math.sin(x / 67) * amp * 0.3;
    const h = hMin + rnd() * (hMax - hMin);
    const w = h * 0.32;
    d += `L${f1(x - w)} ${f1(y)}L${f1(x)} ${f1(y - h)}L${f1(x + w)} ${f1(y)}`;
  }
  return d + 'L1220 300Z';
}

/** A big snowy pine for the corners: three tiers, each with snow on its shoulders. */
function bigPine(x: number, y: number, h: number) {
  let out = `<rect x="${f1(x - h * 0.03)}" y="${f1(y - h * 0.1)}" width="${f1(h * 0.06)}" height="${f1(h * 0.1)}" fill="#1a1020"/>`;
  for (let i = 0; i < 3; i++) {
    const top = y - h + i * h * 0.27;
    const bw = h * (0.2 + i * 0.09);
    const bot = top + h * 0.46;
    out += `<path d="M${f1(x)} ${f1(top)}L${f1(x + bw)} ${f1(bot)}Q${f1(x)} ${f1(bot + h * 0.04)} ${f1(x - bw)} ${f1(bot)}Z" fill="#0f2a3e"/>`;
    out += `<path d="M${f1(x)} ${f1(top)}L${f1(x + bw * 0.5)} ${f1(top + h * 0.22)}Q${f1(x + bw * 0.2)} ${f1(top + h * 0.19)} ${f1(x)} ${f1(top + h * 0.24)}Q${f1(x - bw * 0.25)} ${f1(top + h * 0.19)} ${f1(x - bw * 0.5)} ${f1(top + h * 0.22)}Z" fill="#e6efff" opacity=".9"/>`;
  }
  return out;
}

function winterScene() {
  const rnd = rand(20261029);
  // stars: random dots in an svg (no repeating tile), half of them twinkling
  let stars = '';
  for (let i = 0; i < 90; i++) stars += `<circle cx="${f1(rnd() * 1600)}" cy="${f1(rnd() * 620)}" r="${f1(0.6 + rnd() * rnd() * 1.8)}" opacity="${(0.35 + rnd() * 0.6).toFixed(2)}"${i % 2 ? '' : ' class="tw"'}/>`;
  // snow in three depths; each flake gets its own place, size, speed, drift and phase
  const layers = [
    { n: 34, size: [1.5, 2.6], dur: [20, 30], op: [0.35, 0.6], dx: [-4, 10], cls: 'far' },
    { n: 26, size: [2.8, 4.2], dur: [13, 19], op: [0.55, 0.85], dx: [-6, 14], cls: 'mid' },
    { n: 12, size: [5, 7.5], dur: [8, 12], op: [0.7, 0.95], dx: [-8, 18], cls: 'near' },
  ];
  let snow = '';
  for (const L of layers) {
    for (let i = 0; i < L.n; i++) {
      const r = (k: number[]) => k[0] + rnd() * (k[1] - k[0]);
      const dur = r(L.dur);
      const size = f1(r(L.size));
      snow +=
        `<i class="pb-fl ${L.cls}" style="left:${f1(rnd() * 104 - 2)}%;width:${size}px;height:${size}px;` +
        `--o:${r(L.op).toFixed(2)};--dx:${f1(r(L.dx))}vw;--y:${f1(rnd() * 100)}lvh;animation-duration:${f1(dur)}s;animation-delay:-${f1(rnd() * dur)}s"></i>`;
    }
  }
  const mountains =
    '<svg viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice"><defs>' +
    '<linearGradient id="wmt" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a64a8"/><stop offset="1" stop-color="#1e2f66"/></linearGradient>' +
    '<linearGradient id="whz" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fb8ff" stop-opacity="0"/><stop offset="1" stop-color="#9fb8ff" stop-opacity=".35"/></linearGradient></defs>' +
    '<path fill="url(#wmt)" opacity=".75" d="M0 300V170L90 110 150 140 250 60 330 120 410 90 520 150 610 70 700 130 790 100 880 40 980 120 1060 90 1140 130 1200 110V300Z"/>' +
    '<path fill="#c9d8f6" opacity=".5" d="M250 60 228 78 244 76 256 86 270 74ZM610 70 590 88 604 86 616 95 628 84ZM880 40 858 60 872 58 884 68 898 56Z"/>' +
    `<path fill="#18295a" d="${ridge(rnd, 236, 14, 16, 40)}"/>` +
    '<rect y="140" width="1200" height="160" fill="url(#whz)"/></svg>';
  const left =
    '<svg viewBox="0 0 300 500" preserveAspectRatio="xMinYMax meet">' +
    bigPine(48, 500, 320) + bigPine(250, 505, 200) +
    // the cabin: logs, a snowy roof and two warm windows
    '<g transform="translate(132 448)"><rect x="-50" y="-36" width="100" height="56" fill="#3a2230"/>' +
    '<path d="M-64 -30 0 -78 64 -30 58 -24 0 -66 -58 -24Z" fill="#eef4ff"/><path d="M-58 -24 0 -66 58 -24Z" fill="#2a1828"/>' +
    '<rect x="26" y="-90" width="12" height="28" fill="#2a1828"/><rect x="23" y="-94" width="18" height="6" rx="3" fill="#eef4ff"/>' +
    '<rect class="win" x="-36" y="-22" width="20" height="18" rx="2" fill="#ffc86a"/><rect class="win" x="16" y="-22" width="20" height="18" rx="2" fill="#ffc86a"/>' +
    '<rect x="-7" y="-14" width="14" height="34" fill="#1e1018"/></g></svg>';
  let lights = '';
  const lc = ['#ffcf5a', '#ff7a8a', '#7affc8', '#8fd4ff'];
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const y = 220 + t * 230;
    const x = 210 + Math.sin(t * Math.PI * 5) * (20 + t * 70);
    lights += `<circle class="tw" cx="${f1(x)}" cy="${f1(y)}" r="4" fill="${lc[i % 4]}" style="animation-delay:-${f1(rnd() * 3)}s"/>`;
  }
  const right = '<svg viewBox="0 0 300 500" preserveAspectRatio="xMaxYMax meet">' + bigPine(210, 505, 360) + bigPine(80, 500, 200) + `<g class="lights">${lights}</g></svg>`;
  const drift =
    '<svg viewBox="0 0 1200 120" preserveAspectRatio="none"><defs><filter id="wdb" x="-5%" y="-50%" width="110%" height="200%"><feGaussianBlur stdDeviation="5"/></filter></defs>' +
    '<g filter="url(#wdb)" fill="#e4eeff"><ellipse cx="160" cy="120" rx="320" ry="62" opacity=".9"/><ellipse cx="620" cy="130" rx="420" ry="48" opacity=".75"/>' +
    '<ellipse cx="1080" cy="118" rx="340" ry="66" opacity=".9"/></g></svg>';
  return (
    `<i class="pb-glow"></i><i class="pb-moon"></i><i class="pb-stars"><svg viewBox="0 0 1600 620" preserveAspectRatio="xMidYMin slice" fill="#fff">${stars}</svg></i>` +
    `<i class="pb-aur a1">${aurora(1, [250, 60, 14, 0.4, 150], ['#3dffb0', '#46d8ff', '#a77bff'])}</i>` +
    `<i class="pb-aur a2">${aurora(2, [230, 45, 10, 2.1, 120], ['#a77bff', '#3dffc0', '#46e0ff'])}</i>` +
    `<i class="pb-aur a3">${aurora(3, [200, 55, 12, 4.0, 100], ['#5affa0', '#46d8ff', '#ff8ad8'])}</i>` +
    `<i class="pb-mtn">${mountains}</i><i class="pb-warm"></i><i class="pb-side l">${left}</i><i class="pb-side r">${right}</i>` +
    `<i class="pb-drift">${drift}</i>${snow}`
  );
}

/** The colour at the top and bottom edges of each table's page on a phone: the browser bars take it too. */
const EDGE: Record<ThemeId, string> = { classic: '#d42c1c', neon: '#05010c', space: '#02010a', halloween: '#07020f', winter: '#060b1e' };

/** Tints the browser's bars (Safari, Chrome on phones) and the area behind them to match the page. */
export function setBrowserTint(theme: ThemeId) {
  const edge = EDGE[theme];
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', edge);
  // classic keeps the stylesheet's own edge (it differs between phone and desktop)
  document.documentElement.style.setProperty('--page-edge', theme === 'classic' ? '' : edge);
}

/** What lives on the page behind the menus, per table (static markup, styled in pageBackdrop.css). */
const SCENES: Record<ThemeId, string> = {
  classic: '<i class="pb-rays"></i><i class="pb-beam b1"></i><i class="pb-beam b2"></i><i class="pb-floor"></i>',
  neon: '<i class="pb-sun"></i><i class="pb-horizon"></i><i class="pb-grid"></i><i class="pb-scan"></i>',
  space:
    '<i class="pb-nebula"></i><i class="pb-stars s1"></i><i class="pb-stars s2"></i><i class="pb-stars s3"></i>' +
    '<i class="pb-planet"><b></b></i><i class="pb-shoot"></i><i class="pb-shoot two"></i>',
  halloween:
    `<i class="pb-moon"></i><i class="pb-web"></i><i class="pb-bat a">${BAT}</i><i class="pb-bat b">${BAT}</i><i class="pb-bat c">${BAT}</i>` +
    `<i class="pb-graves">${GRAVES}</i><i class="pb-fog f1"></i><i class="pb-fog f2"></i>`,
  winter: winterScene(),
};

/**
 * Dresses the whole page (the fixed backdrop behind every menu) in a table theme while a screen is shown:
 * the colours come from `.page-<theme>` in styles/tokens.css, the living scene from SCENES above.
 * A new pick crossfades the whole page into the new look where the browser can.
 */
export function usePageTheme(theme: ThemeId) {
  const shown = useRef<ThemeId | null>(null);
  useEffect(() => {
    const body = document.body;
    const apply = () => {
      if (shown.current) body.classList.remove(`page-${shown.current}`);
      body.classList.add(`page-${theme}`);
      shown.current = theme;
      let el = document.getElementById('page-backdrop');
      if (!el) {
        el = document.createElement('div');
        el.id = 'page-backdrop';
        el.setAttribute('aria-hidden', 'true');
        body.prepend(el);
      }
      el.className = `page-backdrop pb-${theme}`;
      setBrowserTint(theme);
      el.innerHTML = SCENES[theme];
    };
    const vt = (document as Document & { startViewTransition?: (f: () => void) => unknown }).startViewTransition;
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (shown.current && shown.current !== theme && vt && !calm) vt.call(document, apply);
    else apply();
  }, [theme]);
  // leaving the screen takes the look off the page
  useEffect(
    () => () => {
      if (shown.current) document.body.classList.remove(`page-${shown.current}`);
      shown.current = null;
      document.getElementById('page-backdrop')?.remove();
      setBrowserTint('classic');
    },
    [],
  );
}
