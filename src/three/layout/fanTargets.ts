import * as THREE from 'three';
import type { Player } from '../../game/types';
import type { PlaceCtx } from './handTargets';
import { OPP_FAN, oppWall } from './seats';
import type { Vec3 } from './types';

const PI = Math.PI;
const eulTmp = new THREE.Euler(0, 0, 0, 'YXZ');
const qTmp = new THREE.Quaternion();
const vTmp = new THREE.Vector3();

/** An opponent's cards: an upright fan, backs to the camera (a partner's turned to face you); at the finale, spread face up. */
export function placeFan({ g, v, out, dealDelay, over }: PlaceCtx, p: Player, pi: number) {
  const s = g.s;
  const m = p.hand.length;
  // opponents hold their cards in an upright fan, backs to the camera: every seat looks the same
  const w = oppWall(g, pi, v);
  const { scale: S, face } = w;
  const lx: Vec3 = [Math.cos(face), 0, -Math.sin(face)];
  if (over) {
    // finale: leftover cards spread face up on the table in front of their owner
    const fsp = Math.min(0.5, 2.4 / Math.max(m - 1, 1));
    p.hand.forEach((c, k) => {
      const off = k - (m - 1) / 2;
      out.set(c.id, {
        pos: [w.pos[0] * 0.92 + lx[0] * off * fsp, 0.03 + k * 0.004, w.pos[2] * 0.92 + lx[2] * off * fsp],
        rot: [-PI / 2, 0, -off * 0.05],
        zone: 'opp', interactive: false, dim: false, delay: 0,
      });
    });
    return;
  }
  // the same fan whatever the seat: the same lean, the same spread, each card a fixed step in front of the last
  const step = Math.min(OPP_FAN.step, OPP_FAN.spread / Math.max(m - 1, 1));
  // your partner (2 vs 2 and up) shows you their cards: the same fan, turned to face you
  const me = g.seat();
  const open = !!s.teams && me !== null && me >= 0 && pi !== me && s.teams[pi] === s.teams[me] && p.hand.every(c => !c.hidden);
  p.hand.forEach((c, k) => {
    const phi = (k - (m - 1) / 2) * step;
    // backs to you: turned upside down so the back reads upright; faces to you: turned round, upright as is
    const yaw = open ? face + PI : face;
    const roll = open ? -phi : PI + phi;
    eulTmp.set(OPP_FAN.lean, yaw, roll);
    qTmp.setFromEuler(eulTmp);
    // the card's centre swings around the pivot below the fan
    vTmp.set(0, (open ? 1 : -1) * OPP_FAN.radius * S, 0).applyQuaternion(qTmp);
    const d = k * OPP_FAN.depth;
    out.set(c.id, {
      pos: [w.pivot[0] + vTmp.x + w.back[0] * d, w.pivot[1] + vTmp.y + w.back[1] * d, w.pivot[2] + vTmp.z + w.back[2] * d],
      rot: [OPP_FAN.lean, yaw, roll],
      zone: 'opp', interactive: false, dim: false, delay: dealDelay(c.dealIdx), scale: S, bobGroup: pi + 1, seq: k,
    });
  });
}
