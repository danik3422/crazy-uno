import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { memo, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Card, ThemeId } from '../game/types';
import { DRAG_HEIGHT, drag, dropZone } from './drag';
import { SPIN_TIME, fxState, nowSec } from './fxState';
import { lastPlace, spawn, type Target } from './layout';
import { cardTexture } from './textures';

const CARD_W = 1;
const CARD_H = 1.5;
const plane = new THREE.PlaneGeometry(CARD_W, CARD_H);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const THICK = 0.012;

/** The card's body: a thin rounded slab, so a tilted card shows a real edge instead of a paper plane. */
const body = (() => {
  const w = CARD_W - 0.01;
  const h = CARD_H - 0.01;
  const r = 0.11;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + r, -h / 2);
  s.lineTo(w / 2 - r, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  s.lineTo(w / 2, h / 2 - r);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  s.lineTo(-w / 2 + r, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  s.lineTo(-w / 2, -h / 2 + r);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  const g = new THREE.ExtrudeGeometry(s, { depth: THICK, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -THICK / 2);
  return g;
})();
const edgeMat = new THREE.MeshStandardMaterial({ color: '#efeadf', roughness: 0.65 });

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/** A scripted hop from one place to another: lifts off, arcs over the table, turns over in the air, lands. */
interface Flight { t0: number; dur: number; from: THREE.Vector3; fromQ: THREE.Quaternion; apex: number }

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

  useFrame((_, rawDt) => {
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
      if (!Number.isFinite(fxState.dealAt)) {
        g.visible = tt.zone === 'deck' && !tt.hidden;
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
    // cards buried in the deck or deep in the pile are not drawn (and cast no shadow)
    g.visible = !tt.hidden;
    if (now < startAt.current!) return;
    // fly properly on the first move out of the deck and every time a card changes hands
    const zoneChanged = tt.zone !== lastZone.current;
    if (!launched.current || zoneChanged) {
      const fromDeck = !launched.current && !hopFromPrev.current;
      if (zoneChanged || fromDeck || hopFromPrev.current) {
        const dist = Math.hypot(tt.pos[0] - g.position.x, tt.pos[2] - g.position.z);
        const dealing = now < fxState.dealEnd;
        const dur = dealing ? 0.42 : THREE.MathUtils.clamp(0.42 + dist * 0.06, 0.55, 0.85);
        flight.current = { t0: now, dur, from: g.position.clone(), fromQ: g.quaternion.clone(), apex: 0.45 + dist * 0.12 };
        if (tt.zone === 'discard') slamAt.current = now + dur * 0.82; // the slam when it lands
      }
      launched.current = true;
      hopFromPrev.current = false;
      lastZone.current = tt.zone;
    }

    let [x, y, z] = tt.pos;
    let [rx, ry, rz] = tt.rot;
    const dragging = drag.id === card.id && drag.moved;
    const chaos = now < fxState.chaosUntil && (tt.zone === 'hand' || tt.zone === 'opp');
    if (chaos) {
      const a = card.id * 2.39996 + now * 4.2;
      const r = 1.3 + (card.id % 6) * 0.42;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r - 0.3;
      y = 1.4 + (card.id % 9) * 0.22 + Math.sin(now * 3 + card.id) * 0.25;
      rx = now * 3 + card.id;
      ry = now * 2;
      rz = card.id;
    } else if (dragging) {
      x = drag.point.x;
      y = drag.point.y + (drag.over ? 0.15 : 0);
      z = drag.point.z;
      rx = drag.over ? -1.35 : -0.95;
      ry = 0;
      rz = 0;
    } else if (hovered.current && tt.interactive) {
      // lift toward the viewer along the card's own normal, never sideways into its neighbours
      y += 0.3;
      z += 0.16;
    }

    const spinning = (tt.zone === 'hand' || tt.zone === 'opp') && now < fxState.spinUntil;
    if (spinning) y += Math.sin((1 - (fxState.spinUntil - now) / SPIN_TIME) * Math.PI) * 0.7;
    // a scripted hop in progress (not while dragged, swirled or spun by an event)
    const f = flight.current;
    if (f && !dragging && !chaos && !spinning) {
      const p = Math.min(1, (now - f.t0) / f.dur);
      const e = easeInOut(p);
      g.position.set(
        f.from.x + (x - f.from.x) * e,
        f.from.y + (y - f.from.y) * e + Math.sin(Math.PI * e) * f.apex,
        f.from.z + (z - f.from.z) * e,
      );
      eul.set(rx, ry, rz);
      tq.setFromEuler(eul);
      // a little extra spin in the air makes the turn-over read as a flip, not a slide
      fq.copy(f.fromQ).slerp(tq, e);
      g.quaternion.copy(fq);
      vel.x.v = vel.y.v = vel.z.v = 0;
      if (p >= 1) flight.current = null;
      const sinceSlam = now - slamAt.current;
      const slam = sinceSlam > 0 && sinceSlam < 0.5 ? Math.sin((sinceSlam / 0.5) * Math.PI) * 0.18 : 0;
      g.scale.setScalar(smoothDamp(g.scale.x, 1 + Math.sin(Math.PI * e) * 0.12 + slam, vel.s, 0.06, dt));
      const shade = tt.dim ? 0.45 : 1;
      const c = frontMat.current.color;
      c.setScalar(c.r + (shade - c.r) * Math.min(1, dt * 8));
      return;
    }
    if (f) flight.current = null;

    // how long a move takes to settle: snappy under the finger, a touch slower for a swirl
    const smooth = dragging || spinning ? 0.05 : chaos ? 0.22 : 0.17;
    const k = 1 - Math.exp(-dt / (smooth * 0.55));
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
      tq.multiply(spinQ.setFromAxisAngle(Y_AXIS, prog * Math.PI * 4));
    }
    g.quaternion.slerp(tq, k);

    // a played card lands with a little slam: it grows in flight and settles on the pile
    const sinceSlam = now - slamAt.current;
    const slam = sinceSlam > 0 && sinceSlam < 0.5 ? Math.sin((sinceSlam / 0.5) * Math.PI) * 0.18 : 0;
    const sTarget = (dragging ? (drag.over ? 1.25 : 1.12) : hovered.current && tt.interactive ? 1.12 : 1) + slam;
    g.scale.setScalar(smoothDamp(g.scale.x, sTarget, vel.s, slam ? 0.06 : 0.12, dt));

    // playable cards are simply raised (see layout); the rest are dimmed
    const shade = tt.dim ? 0.45 : 1;
    const c = frontMat.current.color;
    c.setScalar(c.r + (shade - c.r) * k);
  });

  const front = cardTexture(card);
  const back = cardTexture(null, theme);

  return (
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
      <mesh geometry={plane} position-z={THICK / 2 + 0.0015}>
        <meshStandardMaterial ref={frontMat} map={front} alphaTest={0.5} roughness={0.38} metalness={0} />
      </mesh>
      <mesh geometry={plane} position-z={-THICK / 2 - 0.0015} rotation={[0, Math.PI, Math.PI]}>
        <meshStandardMaterial map={back} alphaTest={0.5} roughness={0.38} />
      </mesh>
    </group>
  );
});
