import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HEX, SPECIAL } from '../game/content';
import type { Card, CardType } from '../game/types';
import { fxState, nowSec, shake } from './fxState';
import type { Vec3 } from './layout';
import { drawEmoji } from './textures';

const DISPLAY = '"Unbounded", "Arial Black", system-ui, sans-serif';
// +2 and +4 are shown by StackFx with the running total instead
const BIG: CardType[] = ['skip', 'rev', 'wild', 'swap', 'gift', 'bomb', 'dare', 'rain', 'mirror', 'chaos', 'dump'];

const symbolCache = new Map<string, THREE.CanvasTexture>();

/** A chunky glowing emblem for an action card, drawn once per type and colour. */
function symbolTexture(card: Card): THREE.CanvasTexture {
  const key = `${card.type}-${card.color}`;
  const hit = symbolCache.get(key);
  if (hit) return hit;
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const col = card.color === 'wild' ? '#ffffff' : HEX[card.color];
  const glow = ctx.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 2);
  glow.addColorStop(0, 'rgba(255,255,255,.55)');
  glow.addColorStop(0.45, card.color === 'wild' ? 'rgba(255,220,120,.35)' : `${col}66`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);

  const fill = () => {
    if (card.color !== 'wild') return col;
    const g = ctx.createLinearGradient(-150, -150, 150, 150);
    g.addColorStop(0, HEX.red); g.addColorStop(0.35, HEX.yellow); g.addColorStop(0.65, HEX.green); g.addColorStop(1, HEX.blue);
    return g;
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (card.type === 'skip') {
    // the classic "no entry" ring, extruded look: dark outline, bright body, white highlight
    for (const [w, c] of [[78, '#00000055'], [64, '#1a1a1a'], [44, fill()], [10, '#ffffff99']] as const) {
      ctx.lineWidth = w;
      ctx.strokeStyle = c as string;
      ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-105, 105); ctx.lineTo(105, -105); ctx.stroke();
    }
  } else if (card.type === 'rev') {
    for (const [w, c] of [[58, '#1a1a1a'], [38, fill()], [8, '#ffffff99']] as const) {
      ctx.lineWidth = w;
      ctx.strokeStyle = c as string;
      ctx.beginPath(); ctx.arc(0, 0, 140, Math.PI * 1.1, Math.PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 140, Math.PI * 0.1, Math.PI * 0.85); ctx.stroke();
    }
    ctx.fillStyle = '#1a1a1a';
    const head = (x: number, y: number, r: number) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(r);
      ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(55, 20); ctx.lineTo(-55, 20); ctx.closePath();
      ctx.fill(); ctx.fillStyle = fill(); ctx.scale(0.62, 0.62); ctx.fill(); ctx.restore(); ctx.fillStyle = '#1a1a1a';
    };
    head(66, -125, 1.15);
    head(-66, 125, 1.15 + Math.PI);
  } else {
    const sym = card.type === 'num' ? String(card.value) : SPECIAL[card.type].sym;
    const emoji = /\p{Extended_Pictographic}/u.test(sym);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (emoji) {
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur = 24;
      drawEmoji(ctx, sym, 0, 10, 230);
    } else {
      ctx.font = `900 ${sym.length > 1 ? 210 : 260}px ${DISPLAY}`;
      ctx.lineWidth = 34;
      ctx.strokeStyle = '#1a1a1a';
      ctx.strokeText(sym, 6, 18);
      ctx.strokeText(sym, 0, 10);
      ctx.fillStyle = fill();
      ctx.fillText(sym, 0, 10);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffffff88';
      ctx.strokeText(sym, -3, 4);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  symbolCache.set(key, t);
  return t;
}

interface Props {
  top: Card;
  at: Vec3;
}

/**
 * Reacts to a new card on the pile: a shock ring in the card's colour,
 * and for action cards a giant emblem that pops up over the table.
 */
export function PlayFx({ top, at }: Props) {
  const sprite = useRef<THREE.Sprite>(null!);
  const spriteMat = useRef<THREE.SpriteMaterial>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const start = useRef(-10);
  /** a card was played and is still in the air: the flash waits for it to touch the pile */
  const armed = useRef<number | null>(null);
  const first = useRef(true);
  // the sprite always has a map, so swapping in an emblem never needs a new shader
  const blank = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 2;
    return new THREE.CanvasTexture(cv);
  }, []);
  const shown = useRef<Card | null>(null);
  const col = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    armed.current = nowSec();
    shown.current = top;
    col.set(top.color === 'wild' ? '#ffffff' : HEX[top.color]);
    ringMat.current.color.copy(col);
    if (BIG.includes(top.type)) spriteMat.current.map = symbolTexture(top);
  }, [top.id]); // only when a new card lands on the pile

  useFrame(() => {
    const now = nowSec();
    if (armed.current !== null) {
      // the card schedules its landing on its first frame in the air; if it never flies (joined late), go now
      if (fxState.landAt > armed.current - 0.05) {
        start.current = fxState.landAt;
        armed.current = null;
      } else if (now - armed.current > 0.3) {
        start.current = now;
        armed.current = null;
      }
    }
    const t = now - start.current;
    // shock ring
    const rOn = t >= 0 && t < 0.7;
    ring.current.visible = rOn;
    if (rOn) {
      ring.current.scale.setScalar(0.6 + t * 6);
      ringMat.current.opacity = 0.9 * (1 - t / 0.7);
    }
    // emblem: pop with overshoot, hover, then fade up and away
    const big = !!shown.current && BIG.includes(shown.current.type);
    const sOn = big && t >= 0 && t < 1.6;
    sprite.current.visible = sOn;
    if (sOn) {
      const pop = t < 0.35 ? easeOutBack(t / 0.35) : 1;
      sprite.current.scale.setScalar(3.1 * pop);
      sprite.current.position.set(at[0], 1.6 + t * 0.5, at[2]);
      spriteMat.current.rotation = Math.sin(t * 6) * 0.08 * (1 - t / 1.6);
      spriteMat.current.opacity = t > 1.1 ? 1 - (t - 1.1) / 0.5 : 1;
    }
  });

  return (
    <>
      {/* under the cards, so it never cuts through the pile */}
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[at[0], 0.006, at[2]]}>
        <ringGeometry args={[0.8, 1.0, 48]} />
        <meshBasicMaterial ref={ringMat} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <sprite ref={sprite} renderOrder={10}>
        <spriteMaterial ref={spriteMat} map={blank} transparent depthTest={false} toneMapped={false} />
      </sprite>
    </>
  );
}

function easeOutBack(x: number) {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

const totalCache = new Map<string, THREE.CanvasTexture>();

/** The penalty total, drawn like the +2 emblem: "+6" in the card's colour (rainbow for a +4). */
function totalTexture(n: number, color: Card['color']): THREE.CanvasTexture {
  const key = `${n}-${color}`;
  const hit = totalCache.get(key);
  if (hit) return hit;
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const col = color === 'wild' ? '#ffffff' : HEX[color];
  const glow = ctx.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 2);
  glow.addColorStop(0, 'rgba(255,255,255,.55)');
  glow.addColorStop(0.45, color === 'wild' ? 'rgba(255,220,120,.35)' : `${col}66`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);
  const text = `+${n}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  // shrink long totals (+12, +20…) so they always fit the emblem
  const size = text.length > 2 ? 200 : 250;
  ctx.font = `900 ${size}px ${DISPLAY}`;
  const fill = () => {
    if (color !== 'wild') return col;
    const g = ctx.createLinearGradient(-150, -150, 150, 150);
    g.addColorStop(0, HEX.red); g.addColorStop(0.35, HEX.yellow); g.addColorStop(0.65, HEX.green); g.addColorStop(1, HEX.blue);
    return g;
  };
  ctx.lineWidth = 34;
  ctx.strokeStyle = '#1a1a1a';
  ctx.strokeText(text, 6, 18);
  ctx.strokeText(text, 0, 10);
  ctx.fillStyle = fill();
  ctx.fillText(text, 0, 10);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#ffffff88';
  ctx.strokeText(text, -3, 4);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  totalCache.set(key, t);
  return t;
}

/** seconds per step while the total counts up (+2 → +4 → +6 …) */
const TICK = 0.11;

/**
 * The penalty stack over the pile. A +2 or +4 shows the total that is now waiting, not just its own number:
 * stacking +2 on +2 pops "+2", then punches up to "+4"; a +4 on a +4 counts up to "+8", and so on.
 * It reacts to the total growing (a +4 only adds up once its colour is picked), timed to the card landing.
 */
export function StackFx({ pending, top, at }: { pending: number; top: Card | undefined; at: Vec3 }) {
  const sprite = useRef<THREE.Sprite>(null!);
  const mat = useRef<THREE.SpriteMaterial>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const prev = useRef(pending);
  const show = useRef<{ from: number; to: number; color: Card['color']; start: number | null; armed: number } | null>(null);
  const shown = useRef(-1);
  const punched = useRef(false);
  const blank = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 2;
    return new THREE.CanvasTexture(cv);
  }, []);

  useEffect(() => {
    const before = prev.current;
    prev.current = pending;
    if (pending <= before) return;
    // the penalty grew: from what was already waiting (0 for a fresh +2/+4) up to the new total
    const color = top && (top.type === 'draw2' || top.type === 'wild4') ? (top.type === 'wild4' ? 'wild' : top.color) : 'wild';
    show.current = { from: before, to: pending, color, start: null, armed: nowSec() };
    shown.current = -1;
    punched.current = false;
  }, [pending]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const now = nowSec();
    const sh = show.current;
    if (sh && sh.start === null) {
      // wait for the card to touch the pile; a +4 whose colour was just picked has landed already
      if (fxState.landAt > sh.armed - 0.05) sh.start = Math.max(now, fxState.landAt);
      else if (now - sh.armed > 0.3) sh.start = now;
    }
    const start = sh?.start ?? null;
    const t = start === null ? -1 : now - start;
    const steps = sh ? Math.max(0, Math.round((sh.to - Math.max(sh.from, 0)) / 2)) : 0;
    const stacked = !!sh && sh.from > 0;
    // a fresh +2/+4 shows its number at once; a stack first shows the old total, then counts up
    const countAt = stacked ? 0.32 : 0;
    const countEnd = stacked ? countAt + steps * TICK : 0;
    const life = countEnd + 1.5;
    const on = !!sh && t >= 0 && t < life;
    sprite.current.visible = on;
    ring.current.visible = on && stacked && t > countEnd && t < countEnd + 0.6;
    if (!on || !sh) return;

    let value = sh.to;
    if (stacked) value = t < countAt ? sh.from : Math.min(sh.to, sh.from + 2 * (1 + Math.floor((t - countAt) / TICK)));
    if (value !== shown.current) {
      shown.current = value;
      mat.current.map = totalTexture(value, sh.color);
    }
    // pop in, then a punch on every count step and a bigger one when the total is reached
    const pop = t < 0.3 ? easeOutBack(t / 0.3) : 1;
    const sinceStep = stacked && t >= countAt && t < countEnd ? (t - countAt) % TICK : 1;
    const step = sinceStep < TICK ? Math.sin((sinceStep / TICK) * Math.PI) * 0.1 : 0;
    const final = stacked && t >= countEnd ? Math.max(0, Math.sin(Math.min(1, (t - countEnd) / 0.3) * Math.PI)) * 0.28 : 0;
    if (stacked && !punched.current && t >= countEnd) {
      punched.current = true;
      shake(0.25 + Math.min(0.5, sh.to * 0.03), 0.35);
    }
    // the bigger the stack, the bigger the number
    const size = 3.1 + Math.min(1.4, Math.max(0, sh.to - 4) * 0.12);
    sprite.current.scale.setScalar(size * pop * (1 + step + final));
    const rise = Math.max(0, t - countEnd);
    sprite.current.position.set(at[0], 1.6 + rise * 0.45, at[2]);
    mat.current.rotation = Math.sin(t * 7) * 0.07 * Math.max(0, 1 - rise / 1.2);
    mat.current.opacity = rise > 1.0 ? Math.max(0, 1 - (rise - 1.0) / 0.5) : 1;
    // a shock ring in the stack's colour when the new total lands
    if (ring.current.visible) {
      const r = (t - countEnd) / 0.6;
      ring.current.scale.setScalar(0.8 + r * 7);
      ringMat.current.opacity = 0.85 * (1 - r);
      ringMat.current.color.set(sh.color === 'wild' ? '#ffd23a' : HEX[sh.color]);
    }
  });

  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[at[0], 0.008, at[2]]} visible={false}>
        <ringGeometry args={[0.8, 1.0, 48]} />
        <meshBasicMaterial ref={ringMat} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <sprite ref={sprite} renderOrder={11} visible={false}>
        <spriteMaterial ref={mat} map={blank} transparent depthTest={false} toneMapped={false} />
      </sprite>
    </>
  );
}
