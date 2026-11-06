import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import { HEX } from '../../game/content';
import type { Card } from '../../game/types';
import { drawValue } from '../../game/rules';
import { penaltyTexture } from '../cards/emblems';
import { fxState, nowSec, shake } from './fxState';
import { glowTexture } from '../cards/glowTexture';
import type { Vec3 } from '../layout';

/* ---------- shared motion ---------- */

/** Fly-in: the emblem drops onto the pile with a springy bounce. */
const IN = 0.42;
/** Pop-away at the end: grows a little while it fades. */
const OUT = 0.32;
/** How long a played card waits for its own landing before the effect goes ahead anyway (it never flew: joined late). */
const LAND_WAIT = 0.15;

function easeOutBack(x: number, c1 = 1.9) {
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

/** A damped spring from 1 to 0: the emblem's tilt settles with a couple of fading swings. */
const settle = (x: number) => Math.exp(-5 * x) * Math.cos(x * 14);

interface Motion {
  scale: number;
  y: number;
  rotation: number;
  opacity: number;
  /** strength of the coloured glow behind it, 0..1 */
  glow: number;
}

/**
 * Where an emblem over the pile is `t` seconds into its life of `life` seconds:
 * drops in from above with a bounce and a tilt that settles, floats gently, then pops away.
 */
function emblemMotion(t: number, life: number): Motion {
  const enter = clamp01(t / IN);
  const leave = clamp01((t - (life - OUT)) / OUT);
  const float = Math.sin(t * 2.6) * 0.06;
  return {
    scale: (0.25 + 0.75 * easeOutBack(enter)) * (1 + easeOutCubic(leave) * 0.3),
    y: 1.7 + (1 - easeOutCubic(enter)) * 0.9 + float * enter,
    rotation: -0.35 * settle(t * 1.4),
    opacity: enter < 1 ? Math.min(1, enter * 3) : 1 - easeOutCubic(leave),
    glow: (enter < 1 ? enter : 1) * (1 - leave) * (0.85 + Math.sin(t * 5) * 0.15),
  };
}

/** A sprite for the emblem plus a coloured glow behind it. */
function EmblemSprites({ order, sprite, mat, glow, glowMat, blank }: {
  order: number;
  sprite: RefObject<THREE.Sprite>;
  mat: RefObject<THREE.SpriteMaterial>;
  glow: RefObject<THREE.Sprite>;
  glowMat: RefObject<THREE.SpriteMaterial>;
  blank: THREE.Texture;
}) {
  return (
    <>
      <sprite ref={glow} renderOrder={order - 1} visible={false}>
        <spriteMaterial ref={glowMat} map={glowTexture()} transparent depthTest={false} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </sprite>
      {/* the sprite always has a map, so swapping in an emblem never needs a new shader */}
      <sprite ref={sprite} renderOrder={order} visible={false} userData={{ fit: 'badge' }}>
        <spriteMaterial ref={mat} map={blank} transparent depthTest={false} toneMapped={false} />
      </sprite>
    </>
  );
}

function useBlankTexture() {
  return useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 2;
    return new THREE.CanvasTexture(cv);
  }, []);
}

/** Places the emblem and its glow for this frame. */
function applyMotion(m: Motion, size: number, at: Vec3, sprite: THREE.Sprite, mat: THREE.SpriteMaterial, glow: THREE.Sprite, glowMat: THREE.SpriteMaterial) {
  sprite.scale.setScalar(size * m.scale);
  sprite.position.set(at[0], m.y, at[2]);
  mat.rotation = m.rotation;
  mat.opacity = m.opacity;
  glow.scale.setScalar(size * 1.7 * (0.8 + m.scale * 0.2));
  glow.position.set(at[0], m.y, at[2]);
  glowMat.opacity = 0.55 * m.glow;
}

const colorOf = (c: Card['color']) => (c === 'wild' ? '#ffd23a' : HEX[c]);

/**
 * When an effect for the card just played should start: the moment it touches the pile.
 * Card3D sets `fxState.landAt` on the card's first frame in the air, so a moment after `armedAt`.
 * Returns null while still waiting for that.
 */
export function landingTime(armedAt: number, now: number): number | null {
  if (fxState.landAt > armedAt - 0.05) return Math.max(now, fxState.landAt);
  if (now - armedAt > LAND_WAIT) return now;
  return null;
}

/* ---------- the shared landing ring ---------- */

interface Props {
  top: Card;
  at: Vec3;
}

/** world size of an emblem sprite (the round badge fills about 3/4 of it) */
const EMBLEM_SIZE = 2.6;

/**
 * Reacts to a new card on the pile with a shock ring in the card's colour.
 * What each action card does is shown by its own animation (see cardFx/).
 */
export function PlayFx({ top, at }: Props) {
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const start = useRef(-10);
  /** a card was played and is still in the air: the effect waits for it to touch the pile */
  const armed = useRef<number | null>(null);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    armed.current = nowSec();
    ringMat.current.color.set(top.color === 'wild' ? '#ffffff' : HEX[top.color]);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a new card lands on the pile
  }, [top.id]);

  useFrame(() => {
    const now = nowSec();
    if (armed.current !== null) {
      const at0 = landingTime(armed.current, now);
      if (at0 !== null) {
        start.current = at0;
        armed.current = null;
      }
    }
    const t = now - start.current;
    const rOn = t >= 0 && t < 0.7;
    ring.current.visible = rOn;
    if (rOn) {
      ring.current.scale.setScalar(0.6 + easeOutCubic(t / 0.7) * 4.2);
      ringMat.current.opacity = 0.9 * (1 - t / 0.7);
    }
  });

  return (
    // under the cards, so it never cuts through the pile
    <mesh ref={ring} rotation-x={-Math.PI / 2} position={[at[0], 0.006, at[2]]} visible={false}>
      <ringGeometry args={[0.8, 1.0, 48]} />
      <meshBasicMaterial ref={ringMat} transparent toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/** seconds per step while the total counts up (+2 → +4 → +6 …) */
const TICK = 0.11;
/** how long a stacked total shows the old number before counting up */
const COUNT_DELAY = 0.3;
/** how long the final total stays up */
const HOLD = 1.2;

interface StackShow {
  from: number;
  to: number;
  color: Card['color'];
  /** when the number appears; null while waiting for the card to land */
  start: number | null;
  /** a card was just played with it: wait for it to land (otherwise, e.g. a +4 whose colour was just picked, go now) */
  armed: number | null;
}

/**
 * The penalty stack over the pile. A +2 or +4 shows the total that is now waiting, not just its own number:
 * stacking +2 on +2 pops "+2", then punches up to "+4"; a +4 on a +4 counts up to "+8", and so on.
 * It reacts to the total growing (a +4 only adds up once its colour is picked), timed to the card landing.
 */
export function StackFx({ pending, top, at }: { pending: number; top: Card | undefined; at: Vec3 }) {
  const sprite = useRef<THREE.Sprite>(null!);
  const mat = useRef<THREE.SpriteMaterial>(null!);
  const glow = useRef<THREE.Sprite>(null!);
  const glowMat = useRef<THREE.SpriteMaterial>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const prev = useRef(pending);
  const prevTop = useRef(top?.id);
  const show = useRef<StackShow | null>(null);
  const shown = useRef(-1);
  const punched = useRef(false);
  const blank = useBlankTexture();

  useEffect(() => {
    const before = prev.current;
    prev.current = pending;
    // did a card land on the pile together with this change?
    const newCard = top?.id !== prevTop.current;
    prevTop.current = top?.id;
    if (pending <= before) return;
    // the penalty grew: from what was already waiting (0 for a fresh +2/+4) up to the new total
    const color = top && drawValue(top) > 0 ? top.color : 'wild';
    const now = nowSec();
    show.current = newCard
      ? { from: before, to: pending, color, start: null, armed: now }
      // nothing new is flying (a +4 after its colour was picked): show it now, or the moment the card touches down
      : { from: before, to: pending, color, start: Math.max(now, fxState.landAt), armed: null };
    shown.current = -1;
    punched.current = false;
    const c = colorOf(color);
    glowMat.current.color.set(c);
    ringMat.current.color.set(c);
  }, [pending, top?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const now = nowSec();
    const sh = show.current;
    if (sh && sh.start === null && sh.armed !== null) sh.start = landingTime(sh.armed, now);
    const t = sh?.start == null ? -1 : now - sh.start;
    const stacked = !!sh && sh.from > 0;
    const steps = sh ? Math.max(0, Math.round((sh.to - Math.max(sh.from, 0)) / 2)) : 0;
    // a fresh +2/+4 shows its number at once; a stack first shows the old total, then counts up
    const countEnd = stacked ? COUNT_DELAY + steps * TICK : 0;
    const life = countEnd + HOLD + OUT;
    const on = !!sh && t >= 0 && t < life;
    sprite.current.visible = glow.current.visible = on;
    // a shock ring when the (new) total lands
    const ringT = t - countEnd;
    ring.current.visible = on && ringT >= 0 && ringT < 0.6;
    if (!on || !sh) return;

    let value = sh.to;
    if (stacked) value = t < COUNT_DELAY ? sh.from : Math.min(sh.to, sh.from + 2 * (1 + Math.floor((t - COUNT_DELAY) / TICK)));
    if (value !== shown.current) {
      shown.current = value;
      mat.current.map = penaltyTexture(value, sh.color);
    }
    if (stacked && !punched.current && t >= countEnd) {
      punched.current = true;
      shake(0.25 + Math.min(0.5, sh.to * 0.03), 0.35);
    }
    const m = emblemMotion(t, life);
    // a punch on every count step and a bigger one when the total is reached
    const sinceStep = stacked && t >= COUNT_DELAY && t < countEnd ? (t - COUNT_DELAY) % TICK : 1;
    const step = sinceStep < TICK ? Math.sin((sinceStep / TICK) * Math.PI) * 0.1 : 0;
    const final = stacked && ringT >= 0 ? Math.max(0, Math.sin(Math.min(1, ringT / 0.3) * Math.PI)) * 0.25 : 0;
    m.scale *= 1 + step + final;
    if (final) m.glow = Math.min(1, m.glow + final * 2);
    // the bigger the stack, the bigger the number
    const size = EMBLEM_SIZE + Math.min(1.1, Math.max(0, sh.to - 4) * 0.1);
    applyMotion(m, size, at, sprite.current, mat.current, glow.current, glowMat.current);
    if (ring.current.visible) {
      const r = ringT / 0.6;
      ring.current.scale.setScalar(0.8 + easeOutCubic(r) * 5);
      ringMat.current.opacity = 0.85 * (1 - r);
    }
  });

  return (
    <>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[at[0], 0.008, at[2]]} visible={false}>
        <ringGeometry args={[0.8, 1.0, 48]} />
        <meshBasicMaterial ref={ringMat} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <EmblemSprites order={11} sprite={sprite} mat={mat} glow={glow} glowMat={glowMat} blank={blank} />
    </>
  );
}
