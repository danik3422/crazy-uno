import * as THREE from 'three';
import type { GameView } from '../../game/view';
import { CARD_H, CARD_W } from '../cards/cardShape';
import { CAMERA, PARALLAX_X, visibleHalfWidth } from './camera';
import { arena } from './table';
import type { Vec3, View } from './types';

/* Where the opponents sit around the far side of the table, and the upright fan each one holds. */

const PI = Math.PI;

/**
 * Angle of player i around the table (+z is the near edge, angle π/2).
 * Opponents are spread over the far half, left to right in turn order.
 */
export function seatAngle(g: GameView, i: number) {
  const n = g.s.players.length;
  const rel = (i - g.seat() + n) % n;
  if (rel === 0) return PI / 2;
  const k = n - 1;
  if (k === 1) return 1.5 * PI;
  if (k === 2) return PI + (PI * (rel - 0.5)) / 2;
  // a crowded table reaches a little further down the sides, so the end seats' plates clear their neighbours' fans
  const over = k >= 6 ? 0.24 : 0.12;
  return PI - over + ((PI + 2 * over) * (rel - 1)) / (k - 1);
}


/** Where player i sits: for an opponent, the foot of their fan of cards (see oppWall). */
export function seatPos(g: GameView, i: number, v: View): Vec3 {
  if (i !== g.seat()) return oppWall(g, i, v).pos;
  const a = seatAngle(g, i);
  const { rx, rz } = arena(v);
  return [Math.cos(a) * rx, 0, Math.sin(a) * rz];
}

/**
 * An opponent's hand, as in the console UNO: an upright fan of card backs turned to the camera.
 * Every seat gets exactly the same fan (lean, spread, overlap); only its place on the table differs.
 * Units are card sizes (times the wall's scale).
 */
export const OPP_FAN = {
  /** leaning back, so the camera (which looks down) sees the backs rather than an edge */
  lean: 0.22,
  /** the fan turns around a point this far below the middle card's centre */
  radius: 2.4,
  /** in-plane angle between neighbours, and the whole fan's spread at most (radians) */
  step: 0.07,
  spread: 0.56,
  /** each card stands this much in front of the one before (a card is 0.012 thick: never closer) */
  depth: 0.026,
};
/** the fan floats this much (card heights) over the table, so its outer cards' corners stay above it */
const FAN_LIFT = (OPP_FAN.radius * (1 - Math.cos(OPP_FAN.spread / 2)) + (CARD_W / 2) * Math.sin(OPP_FAN.spread / 2)) / CARD_H + 0.02;
/** half the width of a full fan (card widths, at scale 1) */
const FAN_HALF = OPP_FAN.radius * Math.sin(OPP_FAN.spread / 2) + (CARD_W / 2) * Math.cos(OPP_FAN.spread / 2) + (CARD_H / 2) * Math.sin(OPP_FAN.spread / 2);

const eulTmp = new THREE.Euler(0, 0, 0, 'YXZ');
const qTmp = new THREE.Quaternion();
const vTmp = new THREE.Vector3();

export interface OppWall {
  /** the foot of the fan, on the table */
  pos: Vec3;
  /** the point the fan turns around */
  pivot: Vec3;
  /** toward the viewer, out of the fan (each next card steps this way) */
  back: Vec3;
  /** straight up along the fan */
  up: Vec3;
  /** yaw that turns the backs to the camera */
  face: number;
  scale: number;
  /** height of the fan's top above the table */
  top: number;
}

/**
 * Opponent i's fan. The same size on screen at every seat (a seat nearer the camera gets slightly smaller cards),
 * smaller for a crowded table, and pulled in from the edges just enough to stay on screen.
 */
export function oppWall(g: GameView, i: number, v: View): OppWall {
  const A = arena(v);
  const a = seatAngle(g, i);
  const cam = v.portrait ? CAMERA.portrait.pos : CAMERA.landscape.pos;
  const n = g.s.players.length;
  // the size of every fan on screen: a little smaller as the table fills up
  const base = (v.portrait ? 0.62 : 0.86) * (n <= 4 ? 1 : n === 5 ? 0.94 : n === 6 ? 0.88 : n === 7 ? 0.82 : 0.78);
  let x = Math.cos(a) * A.rx;
  // a phone lying on its side is short: the far seats come a little closer, so their plates fit above them
  const near = v.compact && Math.sin(a) < 0 ? Math.max(0.76, Math.min(0.92, 0.85 + ((v.h ?? 390) - 390) * 0.001)) : 1;
  const z = Math.sin(a) * A.rz * near;
  const midY = 0.75 * base;
  // the far seat is the reference: a fan nearer the camera shrinks so it looks the same size
  const dRef = Math.hypot(cam[0], cam[1] - midY, cam[2] + A.rz);
  const scale = base * Math.min(1, Math.hypot(cam[0] - x, cam[1] - midY, cam[2] - z) / dRef);
  // keep the whole fan (and the mouse parallax) on screen
  const room = visibleHalfWidth(v, midY, z) - PARALLAX_X - FAN_HALF * scale - (v.portrait ? 0.15 : 0.3);
  if (Math.abs(x) > room) x = Math.sign(x) * Math.max(0, room);
  const face = Math.atan2(x - cam[0], z - cam[2]);
  eulTmp.set(OPP_FAN.lean, face, 0);
  qTmp.setFromEuler(eulTmp);
  vTmp.set(0, 1, 0).applyQuaternion(qTmp);
  const up: Vec3 = [vTmp.x, vTmp.y, vTmp.z];
  vTmp.set(0, 0, -1).applyQuaternion(qTmp);
  const back: Vec3 = [vTmp.x, vTmp.y, vTmp.z];
  const k = (FAN_LIFT * CARD_H + CARD_H / 2 - OPP_FAN.radius) * scale;
  return {
    pos: [x, 0, z],
    pivot: [x + up[0] * k, up[1] * k, z + up[2] * k],
    back,
    up,
    face,
    scale,
    top: (FAN_LIFT + 1) * CARD_H * scale * up[1],
  };
}
