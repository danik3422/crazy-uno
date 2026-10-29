import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { memo, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Card, ThemeId } from '../game/types';
import { DRAG_HEIGHT, drag, dropZone, keySel } from './drag';
import { SPIN_TIME, fxState, nowSec } from './fxState';
import { lastPlace, spawn, type Target } from './layout';
import { isPhone } from '../ui/hooks/phone';
import { cardBodyGeometry, cardFaceGeometry, CARD_H, CARD_W } from './cardShape';
import { cardTexture } from './textures';

/** the printed faces, cut to the card's rounded outline */
const plane = cardFaceGeometry();
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);
const THICK = 0.012;
/** seconds between cards when several are drawn in one go */
const DRAW_GAP = 0.16;
const deckQueue = { at: 0 };

/** The card's body: a thin rounded slab, so a tilted card shows a real edge instead of a paper plane. */
const body = cardBodyGeometry(THICK);
const edgeMat = new THREE.MeshStandardMaterial({ color: '#e4ddcf', roughness: 0.7 });

/** Opponents' cards stand on a glossy floor and show a faint reflection (computers only: it doubles their draws). */
const REFLECTIONS = !isPhone();
/** mirrors anything through the table plane (y = 0) */
const MIRROR_Y = new THREE.Matrix4().makeScale(1, -1, 1);
/** where the back face sits inside a card (see the back mesh below) */
const BACK_LOCAL = new THREE.Matrix4().compose(
  new THREE.Vector3(0, 0, -THICK / 2 - 0.0015),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, Math.PI)),
  new THREE.Vector3(1, 1, 1),
);
/** the reflection fades out away from the line where the card touches the floor */
const reflectFade = (() => {
  const cv = document.createElement('canvas');
  cv.width = 4;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#000');
  g.addColorStop(0.55, '#333');
  g.addColorStop(1, '#fff');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 128);
  return new THREE.CanvasTexture(cv);
})();

/** A soft glow the shape of a card, behind cards you can play right now. Shared: they all pulse together. */
const glowPlane = new THREE.PlaneGeometry(CARD_W * 1.42, CARD_H * 1.3);
const glowMat = (() => {
  const W = 132;
  const H = 186;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d')!;
  ctx.filter = 'blur(7px)';
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.roundRect(18, 18, W - 36, H - 36, 16);
  ctx.fill();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: tex, color: '#fff2b0', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
})();

/** The card you just drew shows up big in front of you for a moment before it goes into your hand. */
const REVEAL = { up: 0.42, hold: 0.6, down: 0.4, size: 1.4 };
/** how many of your cards left the deck in the same frame (a +4 sends four at once: no big reveal then) */
const revealBatch = { frame: -1, count: 0 };

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
/** a toss: leaves the hand with speed and glides in */
const easeOut = (p: number) => {
  // cubic Hermite: leaves the hand with some speed (but no snap) and still has momentum when it lands
  const m0 = 0.55;
  const m1 = 0.3;
  return (p ** 3 - 2 * p ** 2 + p) * m0 + (3 * p ** 2 - 2 * p ** 3) + (p ** 3 - p ** 2) * m1;
};
/** the little pop when a card hits the pile */
const SLAM = 0.24;
const slamPop = (since: number) => (since > 0 && since < SLAM ? Math.sin((since / SLAM) * Math.PI) * 0.07 : 0);

/** A scripted hop from one place to another: lifts off, arcs over the table, turns over in the air, lands. */
interface Flight {
  t0: number;
  dur: number;
  from: THREE.Vector3;
  /** start orientation; for a turn-over, already flipped onto the other side (see flipQ) */
  fromQ: THREE.Quaternion;
  apex: number;
  /** size at take-off (fan cards are smaller): it grows or shrinks to the new size on the way */
  fromS: number;
  toss: boolean;
  /** the card turns over on the way (face down -> face up or back): it rolls around its long side */
  flip: boolean;
  /** first stop in front of the camera, then the rest of the way (the card you just drew) */
  via?: { pos: THREE.Vector3; q: THREE.Quaternion; frame: number; always: boolean };
}
const NORMAL = new THREE.Vector3();
const TO_CAM = new THREE.Vector3();
const FLIP = new THREE.Quaternion().setFromAxisAngle(Y_AXIS, Math.PI);
/** which side of a card the camera sees: > 0 the face, < 0 the back */
function faceSide(q: THREE.Quaternion) {
  NORMAL.set(0, 0, 1).applyQuaternion(q);
  // the camera looks down at the table from the near side
  return NORMAL.y * 0.8 + NORMAL.z * 0.6;
}

/**
 * Critically damped spring (like Unity's SmoothDamp): starts gently, never overshoots, settles softly.
 * Unlike plain exponential easing it has no jolt on the first frame of a move.
 */
function smoothDamp(cur: number, target: number, vel: { v: number }, smoothTime: number, dt: number) {
  const omega = 2 / smoothTime;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

interface Props {
  card: Card;
  t: Target;
  theme: ThemeId;
  onPick: (id: number) => void;
}

/**
 * A card that always flies toward its target transform.
 * Moving between zones (deal, play, swap, chaos…) animates automatically:
 * the card arcs up while far from its target and settles with exponential damping.
 */
export const Card3D = memo(function Card3D({ card, t, theme, onPick }: Props) {
  const ref = useRef<THREE.Group>(null!);
  const frontMat = useRef<THREE.MeshStandardMaterial>(null!);
  const frontRef = useRef<THREE.Mesh>(null!);
  const backRef = useRef<THREE.Mesh>(null!);
  const glowRef = useRef<THREE.Mesh>(null!);
  const reflRef = useRef<THREE.Mesh>(null);
  const hovered = useRef(false);
  const startAt = useRef<number | null>(null);
  const placed = useRef(false);
  const tq = useMemo(() => new THREE.Quaternion(), []);
  const spinQ = useMemo(() => new THREE.Quaternion(), []);
  const lastPos = useRef<[number, number, number] | null>(null);
  const lastZone = useRef(t.zone);
  const slamAt = useRef(-10);
  /** this card falls out of the bombing plane: hidden until released, then tumbles down */
  const dropping = useRef(false);
  const eul = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), []);
  const vel = useMemo(() => ({ x: { v: 0 }, y: { v: 0 }, z: { v: 0 }, s: { v: 0 } }), []);
  const flight = useRef<Flight | null>(null);
  /** the card has not made its first move yet (it waits in the deck or where it was) */
  const launched = useRef(false);
  /** started somewhere else than its new place (online re-id), and should hop from there */
  const hopFromPrev = useRef(false);
  const fq = useMemo(() => new THREE.Quaternion(), []);
  const tRef = useRef(t);
  tRef.current = t;
  const pickRef = useRef(onPick);
  pickRef.current = onPick;
  const { camera, gl } = useThree();

  /** Grab a playable hand card: follow the finger over the table, drop it on the pile to play. */
  const startDrag = (e: ThreeEvent<PointerEvent>) => {
    const tt = tRef.current;
    if (!tt.interactive || tt.zone !== 'hand' || e.button > 0) return;
    e.stopPropagation();
    drag.id = card.id;
    drag.moved = false;
    drag.over = false;
    drag.startX = e.nativeEvent.clientX;
    drag.startY = e.nativeEvent.clientY;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -DRAG_HEIGHT);
    const move = (ev: PointerEvent) => {
      if (!drag.moved && Math.hypot(ev.clientX - drag.startX, ev.clientY - drag.startY) < 10) return;
      drag.moved = true;
      document.body.style.cursor = 'grabbing';
      const r = gl.domElement.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      if (!ray.ray.intersectPlane(plane, drag.point)) return;
      // anywhere near the pile, or simply pushed well up from the hand, counts as "play it"
      const near = Math.hypot(drag.point.x - dropZone.x, drag.point.z - dropZone.z) < dropZone.radius;
      drag.over = near || drag.point.z < dropZone.handZ - 2.2;
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      document.body.style.cursor = '';
      if (drag.moved) {
        drag.suppressClickUntil = performance.now() + 350;
        if (drag.over && tRef.current.interactive) pickRef.current(card.id);
      }
      drag.id = null;
      drag.moved = false;
      drag.over = false;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  useFrame((st, rawDt) => {
    // the same number for every card within one frame
    const frameKey = st.clock.elapsedTime;
    // a long frame (tab switch, GC pause) must not teleport cards: cap the step
    const dt = Math.min(rawDt, 1 / 30);
    const g = ref.current;
    const tt = tRef.current;
    const now = nowSec();
    // remember where this card really was last frame (see lastPlace)
    if (placed.current) {
      const q = g.quaternion;
      const e = lastPlace.get(card.id);
      if (e) {
        e.pos[0] = g.position.x; e.pos[1] = g.position.y; e.pos[2] = g.position.z;
        e.quat[0] = q.x; e.quat[1] = q.y; e.quat[2] = q.z; e.quat[3] = q.w;
        e.zone = lastZone.current;
      } else lastPlace.set(card.id, { pos: [g.position.x, g.position.y, g.position.z], quat: [q.x, q.y, q.z, q.w], zone: lastZone.current });
    }
    // the camera only ever sees one side of a card: skip drawing the other (half the face draw calls).
    // Decided from last frame's pose, with a wide margin so a fast flip never hides the side coming into view.
    if (placed.current) {
      NORMAL.set(0, 0, 1).applyQuaternion(g.quaternion);
      TO_CAM.subVectors(camera.position, g.position);
      const facing = NORMAL.dot(TO_CAM) / (TO_CAM.length() || 1);
      frontRef.current.visible = facing > -0.3;
      backRef.current.visible = facing < 0.3;
    }
    const inHandZone = tt.zone === 'hand' || tt.zone === 'opp';
    const bombing = fxState.drop.until > now && inHandZone;
    if (!placed.current) {
      // first frame: start in the deck, then wait for this card's turn in the deal
      // online a card may have just changed its id: start where it was under the old one
      // after a rebuilt canvas (lost GPU context) cards reappear right where they were
      const settled = Number.isFinite(fxState.dealAt) && fxState.dealAt < now ? lastPlace.get(card.id) : undefined;
      const prev = (card.fromId !== undefined ? lastPlace.get(card.fromId) : undefined) ?? settled;
      g.position.set(...(prev?.pos ?? spawn.pos));
      if (prev) g.quaternion.set(...prev.quat);
      else {
        eul.set(Math.PI / 2, -0.35, 0);
        g.quaternion.setFromEuler(eul);
      }
      startAt.current = prev ? 0 : null;
      // it came from another zone under its old id (an opponent's card hitting the pile): hop over
      hopFromPrev.current = !!prev && prev !== settled && prev.zone !== tt.zone;
      if (prev === settled && prev) launched.current = true;
      placed.current = true;
      if (bombing) {
        // a brand-new card (online) during a bombing run comes out of the plane
        dropping.current = true;
        startAt.current = fxState.drop.at + (Math.abs(card.id) % 4) * 0.14;
      }
    }
    // the deal has not started yet (table still loading): stay in the deck
    if (startAt.current === null) {
      // until the deal reaches it, a card waits inside the deck, wherever the deck is (shuffled mid-table)
      const o = fxState.deckOffset;
      g.position.set(spawn.pos[0] + o[0], spawn.pos[1] + o[1], spawn.pos[2] + o[2]);
      if (!Number.isFinite(fxState.dealAt) || now < fxState.dealAt) {
        g.visible = tt.zone === 'deck' && !tt.hidden && !fxState.deckHidesTop;
        if (tt.zone === 'deck') g.position.set(tt.pos[0] + o[0], tt.pos[1] + o[1], tt.pos[2] + o[2]);
        return;
      }
      // the stagger only applies to the opening deal; a card drawn later leaves the deck at once
      const inDeal = now < fxState.dealEnd;
      startAt.current = Math.max(now, fxState.dealAt) + (inDeal ? tt.delay : 0);
    }
    // a new destination during a hold (e.g. a meteor still falling) waits for the impact
    const lp = lastPos.current;
    if (!lp || lp[0] !== tt.pos[0] || lp[1] !== tt.pos[1] || lp[2] !== tt.pos[2]) {
      if (lp && bombing && lastZone.current === 'deck') {
        dropping.current = true;
        startAt.current = fxState.drop.at + (Math.abs(card.id) % 4) * 0.14;
      } else if (lp && fxState.holdUntil > now) startAt.current = Math.max(startAt.current!, fxState.holdUntil + (card.id % 10) * 0.045);
      lastPos.current = tt.pos;
    }
    if (dropping.current) {
      if (now < startAt.current!) {
        g.visible = false;
        return;
      }
      // release: appear under the plane, spinning, then fall into the hand
      dropping.current = false;
      g.position.set(...fxState.drop.pos);
      eul.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      g.quaternion.setFromEuler(eul);
      g.scale.setScalar(0.6);
      vel.x.v = vel.y.v = vel.z.v = 0;
    }
    // cards buried in the deck or deep in the pile are not drawn (and cast no shadow);
    // the real top cards hide while the deck is being riffled
    // cards still lying on the deck (its top, or waiting for the deal) hide while the stack draws its own top
    const onDeck = tt.zone === 'deck' || (!launched.current && now < startAt.current!);
    g.visible = !tt.hidden && !(onDeck && fxState.deckHidesTop);
    if (now < startAt.current!) {
      // still waiting for its turn in the deal: it lies on the deck and rides along when the deck moves
      if (!launched.current && !hopFromPrev.current && !dropping.current) {
        const o = fxState.deckOffset;
        g.position.set(spawn.pos[0] + o[0], spawn.pos[1] + o[1], spawn.pos[2] + o[2]);
      }
      return;
    }
    // fly properly on the first move out of the deck and every time a card changes hands
    const zoneChanged = tt.zone !== lastZone.current;
    if (!launched.current || zoneChanged) {
      const fromDeck = !launched.current && !hopFromPrev.current;
      if (zoneChanged || fromDeck || hopFromPrev.current) {
        const dist = Math.hypot(tt.pos[0] - g.position.x, tt.pos[2] - g.position.z);
        const dealing = now < fxState.dealEnd;
        const toss = tt.zone === 'discard' && !dealing;
        // a played card is quick and decisive; a draw travels a little slower
        const dur = dealing ? 0.42 : toss ? THREE.MathUtils.clamp(0.36 + dist * 0.045, 0.42, 0.66) : THREE.MathUtils.clamp(0.42 + dist * 0.05, 0.5, 0.75);
        // several cards leaving the deck at once (draw until playable, +N penalties): one after another
        let t0 = now;
        const leavesDeck = (fromDeck || lastZone.current === 'deck') && !dealing;
        // after a reconnect the hands are laid out all at once; real draws leave the deck one after another
        const relayout = now < fxState.revealFrom;
        if (leavesDeck && !relayout) {
          t0 = Math.max(now, deckQueue.at);
          deckQueue.at = t0 + DRAW_GAP;
        }
        eul.set(...tt.rot);
        tq.setFromEuler(eul);
        const flip = faceSide(g.quaternion) * faceSide(tq) < 0;
        const fromQ = g.quaternion.clone();
        if (flip) fromQ.multiply(FLIP);
        flight.current = { t0, dur, from: g.position.clone(), fromQ, apex: (toss ? 0.5 : 0.45) + dist * 0.1, fromS: g.scale.x, toss, flip };
        if (tt.reveal && tt.zone === 'hand' && !dealing && !relayout && (leavesDeck || hopFromPrev.current)) {
          if (revealBatch.frame !== frameKey) {
            revealBatch.frame = frameKey;
            revealBatch.count = 0;
          }
          revealBatch.count++;
          // in front of the camera, over the near half of the table, facing you
          const pos = new THREE.Vector3(dropZone.x, 0.9, dropZone.z + 0.9).lerp(camera.position, 0.3);
          // leaning back a little, like the cards in your hand: facing the camera head-on it caught a glare
          const q = camera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, -0.38));
          flight.current.via = { pos, q, frame: frameKey, always: tt.reveal === 'always' };
          flight.current.dur = REVEAL.down;
          flight.current.flip = false;
        }
        if (tt.zone === 'discard') {
          // the slam when it lands; the pile's flash and ring wait for the same moment
          slamAt.current = t0 + dur;
          fxState.landAt = t0 + dur;
        }
      }
      launched.current = true;
      hopFromPrev.current = false;
      lastZone.current = tt.zone;
    }

    let [x, y, z] = tt.pos;
    let [rx, ry, rz] = tt.rot;
    // the deck moves (shuffled in the middle, then slides home): its cards ride along
    if (tt.zone === 'deck') {
      const o = fxState.deckOffset;
      x += o[0];
      y += o[1];
      z += o[2];
    }
    const dragging = drag.id === card.id && drag.moved;
    const chaos = now < fxState.chaosUntil && (tt.zone === 'hand' || tt.zone === 'opp');
    if (chaos) {
      // a tornado over the pile, sized to the table (smaller on phones), low enough to stay clear of the name plates
      const a = card.id * 2.39996 + now * 4.2;
      const k = dropZone.radius / 2.6;
      const r = (1.1 + (card.id % 6) * 0.36) * k;
      x = dropZone.x + Math.cos(a) * r;
      z = dropZone.z + 0.5 + Math.sin(a) * r * 0.8;
      y = 0.9 + (card.id % 9) * 0.16 + Math.sin(now * 3 + card.id) * 0.2;
      if (tt.zone === 'opp') {
        // someone else's cards swirl back up (only rocking a little), so nobody gets a peek
        rx = Math.PI / 2 + Math.sin(now * 3 + card.id) * 0.35;
        ry = now * 2 + card.id;
        rz = 0;
      } else {
        rx = now * 3 + card.id;
        ry = now * 2;
        rz = card.id;
      }
    } else if (dragging) {
      x = drag.point.x;
      y = drag.point.y + (drag.over ? 0.15 : 0);
      z = drag.point.z;
      rx = drag.over ? -1.35 : -0.95;
      ry = 0;
      rz = 0;
    } else if ((hovered.current || keySel.id === card.id) && tt.interactive) {
      // lift toward the viewer along the card's own normal, never sideways into its neighbours
      y += 0.3;
      z += 0.16;
    }

    // the swirl wins over a spin: both at once would whip the card around
    const spinning = (tt.zone === 'hand' || tt.zone === 'opp') && now < fxState.spinUntil && !chaos && !dragging;
    if (spinning) y += Math.sin((1 - (fxState.spinUntil - now) / SPIN_TIME) * Math.PI) * 0.7;
    // a scripted hop in progress finishes even through a spin (the spin would snap the card over);
    // a card picked up by the finger or caught by the swirl leaves it and springs on from where it is
    let f = flight.current;
    // several cards left the deck together (a penalty): they fly straight into the hand
    if (f?.via && !f.via.always && revealBatch.frame === f.via.frame && revealBatch.count > 1) {
      f = flight.current = { ...f, via: undefined, dur: THREE.MathUtils.clamp(0.42 + Math.hypot(tt.pos[0] - f.from.x, tt.pos[2] - f.from.z) * 0.05, 0.5, 0.75) };
    }
    if (f?.via && !dragging && !chaos) {
      const v = f.via;
      const el = now - f.t0;
      if (el < REVEAL.up + REVEAL.hold) {
        // up from the deck, turning over to face you, growing big; then a short hold with a gentle bob
        const p = THREE.MathUtils.clamp(el / REVEAL.up, 0, 1);
        const e = easeInOut(p);
        const bob = el > REVEAL.up ? Math.sin((el - REVEAL.up) * 7) * 0.025 : 0;
        g.position.set(f.from.x + (v.pos.x - f.from.x) * e, f.from.y + (v.pos.y - f.from.y) * e + Math.sin(Math.PI * e) * 0.4 + bob, f.from.z + (v.pos.z - f.from.z) * e);
        fq.copy(f.fromQ).slerp(v.q, e);
        g.quaternion.copy(fq);
        g.scale.setScalar(f.fromS + (REVEAL.size - f.fromS) * e);
        vel.x.v = vel.y.v = vel.z.v = vel.s.v = 0;
        frontMat.current.color.setScalar(1);
        if (glowRef.current) glowRef.current.visible = false;
        return;
      }
      // then into the hand like any other card
      f = flight.current = { ...f, via: undefined, t0: f.t0 + REVEAL.up + REVEAL.hold, from: v.pos.clone(), fromQ: v.q.clone(), fromS: REVEAL.size, apex: 0.15 };
    }
    if (f && !dragging && !chaos) {
      // waiting its turn in a multi-card draw: stays on top of the deck until then
      const p = THREE.MathUtils.clamp((now - f.t0) / f.dur, 0, 1);
      // a played card is tossed: it glides over and comes down onto the pile with some weight (a falling arc);
      // everything else lifts off, travels and sets down softly
      const e = f.toss ? easeOut(p) : easeInOut(p);
      const arc = f.toss ? 4 * e * (1 - e) : Math.sin(Math.PI * e);
      g.position.set(
        f.from.x + (x - f.from.x) * e,
        f.from.y + (y - f.from.y) * e + arc * f.apex,
        f.from.z + (z - f.from.z) * e,
      );
      eul.set(rx, ry, rz);
      tq.setFromEuler(eul);
      // turn toward the landing pose; a card that changes sides also rolls over its long edge on the way,
      // instead of tumbling around whatever axis happens to be shortest
      fq.copy(f.fromQ).slerp(tq, e);
      if (f.flip) fq.multiply(spinQ.setFromAxisAngle(Y_AXIS, Math.PI * (1 - e)));
      g.quaternion.copy(fq);
      vel.x.v = vel.y.v = vel.z.v = 0;
      if (p >= 1) flight.current = null;
      // a touch bigger in the air (closer to the camera), exactly its size again when it lands
      const size = f.fromS + ((tt.scale ?? 1) - f.fromS) * e;
      g.scale.setScalar(size * (1 + Math.sin(Math.PI * p) * 0.1));
      vel.s.v = 0;
      const shade = tt.dim ? 0.5 : 1;
      const c = frontMat.current.color;
      c.setScalar(c.r + (shade - c.r) * Math.min(1, dt * 8));
      return;
    }
    if (f) flight.current = null;

    // lying on the deck: part of the stack, it moves with it exactly (a spring would trail behind a sliding deck)
    if (tt.zone === 'deck' && !dragging && !chaos) {
      g.position.set(x, y, z);
      eul.set(rx, ry, rz);
      g.quaternion.setFromEuler(eul);
      g.scale.setScalar(tt.scale ?? 1);
      vel.x.v = vel.y.v = vel.z.v = vel.s.v = 0;
      return;
    }

    // how long a move takes to settle: snappy under the finger, a touch slower for a swirl;
    // a spin turns the card fast but moves it at the usual pace
    const smooth = dragging ? 0.05 : chaos ? 0.22 : 0.17;
    const k = 1 - Math.exp(-dt / ((spinning ? 0.05 : smooth) * 0.55));
    const dx = x - g.position.x;
    const dz = z - g.position.z;
    // in-hand flights arc up; a card under the finger goes straight there
    const far = dragging ? 0 : Math.min(Math.hypot(dx, dz), 6);
    g.position.x = smoothDamp(g.position.x, x, vel.x, smooth, dt);
    g.position.z = smoothDamp(g.position.z, z, vel.z, smooth, dt);
    g.position.y = smoothDamp(g.position.y, y + far * 0.3, vel.y, smooth, dt);
    eul.set(rx, ry, rz);
    tq.setFromEuler(eul);
    if (spinning) {
      const prog = 1 - (fxState.spinUntil - now) / SPIN_TIME;
      // your own cards turn over twice; someone else's only twirl in place, so their faces never show
      const turn = THREE.MathUtils.smoothstep(prog, 0, 1) * Math.PI * 4;
      tq.multiply(spinQ.setFromAxisAngle(tt.zone === 'hand' ? Y_AXIS : Z_AXIS, tt.zone === 'hand' ? turn : turn / 2));
    }
    g.quaternion.slerp(tq, k);

    // a played card lands with a little slam: it grows in flight and settles on the pile
    const slam = slamPop(now - slamAt.current);
    const base = tt.scale ?? 1;
    const sTarget = dragging ? (drag.over ? 1.25 : 1.12) : (hovered.current || keySel.id === card.id) && tt.interactive ? base * 1.12 : base;
    if (slam) {
      // a short, exact pop: the spring would lag behind it and leave the card swollen
      g.scale.setScalar(base * (1 + slam));
      vel.s.v = 0;
    } else g.scale.setScalar(smoothDamp(g.scale.x, sTarget, vel.s, 0.12, dt));

    // playable cards are simply raised (see layout); the rest are dimmed
    const shade = tt.dim ? 0.42 : 1;
    const c = frontMat.current.color;
    c.setScalar(c.r + (shade - c.r) * k);
  });

  // after the card has moved: the glow behind a playable card, and the reflection of an opponent's card
  useFrame(st => {
    const g = ref.current;
    const tt = tRef.current;
    const glow = glowRef.current;
    const settled = !flight.current;
    glow.visible = tt.interactive && tt.zone === 'hand' && settled && g.visible && !(drag.id === card.id && drag.moved);
    if (glow.visible) glowMat.opacity = 0.75 + Math.sin(st.clock.elapsedTime * 4) * 0.25;
    const refl = reflRef.current;
    if (!refl) return;
    // only a card standing on the table in an opponent's row (not one flying past or lying flat)
    refl.visible = tt.zone === 'opp' && g.visible && g.position.y < 1.6 && !flight.current;
    if (refl.visible) {
      g.updateMatrix();
      refl.matrix.multiplyMatrices(MIRROR_Y, g.matrix).multiply(BACK_LOCAL);
    }
  });

  const front = cardTexture(card);
  const back = cardTexture(null, theme);

  return (
    <>
    {REFLECTIONS && (
      <mesh ref={reflRef} geometry={plane} matrixAutoUpdate={false} visible={false} renderOrder={-10}>
        <meshBasicMaterial map={back} alphaMap={reflectFade} transparent opacity={0.3} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
    )}
    <group
      ref={ref}
      onPointerOver={e => {
        if (!t.interactive) return;
        e.stopPropagation();
        hovered.current = true;
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        hovered.current = false;
        document.body.style.cursor = '';
      }}
      onPointerDown={startDrag}
      onClick={e => {
        if (!t.interactive) return;
        e.stopPropagation();
        if (performance.now() < drag.suppressClickUntil) return;
        hovered.current = false;
        document.body.style.cursor = '';
        onPick(card.id);
      }}
    >
      <mesh geometry={body} material={edgeMat} castShadow />
      <mesh ref={frontRef} geometry={plane} position-z={THICK / 2 + 0.0015}>
        <meshStandardMaterial ref={frontMat} map={front} roughness={0.38} metalness={0} />
      </mesh>
      <mesh ref={backRef} geometry={plane} position-z={-THICK / 2 - 0.0015} rotation={[0, Math.PI, Math.PI]}>
        <meshStandardMaterial map={back} roughness={0.38} />
      </mesh>
      <mesh ref={glowRef} geometry={glowPlane} material={glowMat} position-z={-THICK / 2 - 0.006} visible={false} />
    </group>
    </>
  );
});
