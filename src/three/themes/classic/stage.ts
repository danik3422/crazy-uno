import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/*
 * The classic table's stage pieces for a phone's free room (see Decor): a spotlight on a stand, its head tipped down
 * toward the table, with a soft cone of light coming out of the lens. Two geometries, each drawn instanced: the stand
 * and lamp (shaded, vertex colours) and the lens with its beam (unlit, additive, fading to nothing at the far end).
 */

/** how high the lamp's head sits, its tilt down toward the table (radians), and the beam's length */
export const HEAD_Y = 1.95;
const TILT = 0.62;
const BEAM = 1.05;

/** sizes at scale 1, for checking a stand on the screen: a ball round the stand, the head and the start of the beam */
export const STAND_BALL = { r: 1.2, y: 1.25, rx: 0.85 };

function paint(g: THREE.BufferGeometry, c: string, k = 1) {
  const out = g.index ? g.toNonIndexed() : g;
  if (out !== g) g.dispose();
  const col = new THREE.Color(c).multiplyScalar(k);
  const n = out.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.toArray(arr, i * 3);
  out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  // merged parts must share the same attributes
  out.deleteAttribute('uv');
  return out;
}

function merge(parts: THREE.BufferGeometry[]) {
  const g = mergeGeometries(parts)!;
  parts.forEach(p => p.dispose());
  return g;
}

/** the lamp head's frame: at the top of the stand, tipped down toward +z (the stand is turned to face the table) */
const head = () => new THREE.Matrix4().compose(new THREE.Vector3(0, HEAD_Y, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(TILT, 0, 0)), new THREE.Vector3(1, 1, 1));

/** A stage spotlight on a tripod stand, its head facing +z (one geometry, vertex coloured). */
export function standGeometry(lite: boolean) {
  const seg = lite ? 10 : 16;
  const metal = '#30303c';
  const gold = '#d9a842';
  const parts: THREE.BufferGeometry[] = [
    // a round weighted foot, a gold collar and the pole
    paint(new THREE.CylinderGeometry(0.34, 0.4, 0.09, seg).translate(0, 0.045, 0), metal),
    paint(new THREE.CylinderGeometry(0.09, 0.09, 0.06, seg).translate(0, 0.12, 0), gold),
    paint(new THREE.CylinderGeometry(0.045, 0.055, HEAD_Y - 0.1, 8).translate(0, (HEAD_Y - 0.1) / 2 + 0.1, 0), metal),
  ];
  // the yoke: a bar across under the head and an arm up each side
  const m = head();
  const yoke = [
    new THREE.BoxGeometry(0.62, 0.05, 0.07).translate(0, -0.27, 0),
    new THREE.BoxGeometry(0.05, 0.32, 0.07).translate(-0.31, -0.12, 0),
    new THREE.BoxGeometry(0.05, 0.32, 0.07).translate(0.31, -0.12, 0),
  ];
  for (const y of yoke) parts.push(paint(y.applyMatrix4(new THREE.Matrix4().makeTranslation(0, HEAD_Y, 0)), gold));
  // the can (open toward +z), a gold rim round its mouth and a little cap at the back
  parts.push(paint(new THREE.CylinderGeometry(0.25, 0.2, 0.5, seg, 1, true).rotateX(Math.PI / 2).applyMatrix4(m), '#1a1a22'));
  parts.push(paint(new THREE.TorusGeometry(0.25, 0.035, 6, seg).translate(0, 0, 0.25).applyMatrix4(m), gold));
  parts.push(paint(new THREE.CircleGeometry(0.2, seg).rotateY(Math.PI).translate(0, 0, -0.25).applyMatrix4(m), '#22222c'));
  return merge(parts);
}

/** The lens and the soft beam out of it, toward +z of the head (unlit; colour fades to black = nothing, additive). */
export function beamGeometry(lite: boolean) {
  const seg = lite ? 14 : 24;
  const m = head();
  const lens = paint(new THREE.CircleGeometry(0.22, seg).translate(0, 0, 0.24).applyMatrix4(m), '#ffffff');
  // an open cone from the lens out: as narrow as the lens where it leaves it, widening toward the table,
  // bright at the lens and gone at the far end. (rotateX(+90°) turns the cylinder's top, its first radius,
  // to +z, the far end — so the wide radius comes first.)
  const cone = new THREE.CylinderGeometry(0.75, 0.22, BEAM, seg, 4, true).rotateX(Math.PI / 2).translate(0, 0, 0.25 + BEAM / 2);
  const pos = cone.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const f = THREE.MathUtils.clamp((pos.getZ(i) - 0.25) / BEAM, 0, 1);
    col.fill(0.13 * (1 - f) ** 1.8, i * 3, i * 3 + 3);
  }
  cone.setAttribute('color', new THREE.BufferAttribute(col, 3));
  cone.deleteAttribute('uv');
  const beam = cone.toNonIndexed();
  cone.dispose();
  beam.applyMatrix4(m);
  return merge([lens, beam]);
}
