import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTex } from '../decorKit';
import { paintVertices } from './bits';

/* The Halloween decor's meshes and textures, built once per table (see Decor.tsx). */

const ORANGE = new THREE.Color('#ff7a12');
const DEEP = new THREE.Color('#a8320a');
const TOP = new THREE.Color('#ffa43a');

/**
 * A ribbed pumpkin with its stem and a curl of vine: one geometry with vertex colours (one draw call for all).
 * The ribs are shaded into the colours themselves (deep in the creases, warm on the ridges), so the pumpkin
 * looks carved and round without any texture.
 */
export function pumpkinGeometry(lite: boolean) {
  const body = new THREE.SphereGeometry(0.6, lite ? 16 : 28, lite ? 10 : 16);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const y = p.getY(i);
    const rib = 1 + 0.085 * Math.cos(Math.atan2(z, x) * 8);
    // flattened, with a dimple on top and a flat-ish bottom
    p.setXYZ(i, x * rib * 1.18, y * 0.8 - (y > 0.42 ? (y - 0.42) * 0.7 : 0), z * rib * 1.18);
  }
  body.computeVertexNormals();
  const painted = paintVertices(body, (x, y, z, c) => {
    const ridge = 0.5 + 0.5 * Math.cos(Math.atan2(z, x) * 8);
    c.copy(DEEP).lerp(ORANGE, 0.35 + ridge * 0.65).lerp(TOP, Math.max(0, y) * 0.5);
    // the underside sits in its own shadow
    if (y < -0.2) c.multiplyScalar(1 + (y + 0.2) * 0.9);
  });
  const stem = new THREE.CylinderGeometry(0.05, 0.1, 0.32, 7, 2);
  stem.rotateZ(0.28);
  stem.translate(0.04, 0.5, 0);
  const vine = new THREE.TorusGeometry(0.12, 0.018, 4, 12, Math.PI * 1.5).rotateY(0.6).translate(-0.1, 0.46, 0.06);
  const green = (g: THREE.BufferGeometry) => paintVertices(g, (_x, y, _z, c) => c.set('#3d6a1c').multiplyScalar(0.8 + (y - 0.35) * 1.2));
  const g = mergeGeometries([painted, green(stem), green(vine)]);
  painted.dispose();
  return g;
}

/** The carved face: a patch of a slightly bigger sphere on the front, so it hugs the pumpkin. */
export const faceGeometry = () => new THREE.SphereGeometry(0.735, 14, 8, Math.PI / 2 - 0.85, 1.7, 0.95, 1.25).scale(1.06, 0.8, 1.06);

/** The face glows from the candle inside: crisp shapes (no canvas blur), a warm rim around each hole. */
export const faceTexture = () =>
  canvasTex(256, 256, ctx => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 256);
    ctx.scale(2, 2);
    const shape = () => {
      ctx.beginPath();
      // eyes: tilted triangles, a little cheeky
      ctx.moveTo(26, 52); ctx.lineTo(54, 46); ctx.lineTo(44, 24); ctx.closePath();
      ctx.moveTo(102, 52); ctx.lineTo(74, 46); ctx.lineTo(84, 24); ctx.closePath();
      // nose
      ctx.moveTo(64, 56); ctx.lineTo(71, 68); ctx.lineTo(57, 68); ctx.closePath();
      // a grin with two teeth
      ctx.moveTo(20, 78);
      ctx.quadraticCurveTo(64, 98, 108, 78);
      ctx.quadraticCurveTo(98, 112, 64, 114);
      ctx.quadraticCurveTo(30, 112, 20, 78);
      ctx.closePath();
    };
    ctx.lineJoin = 'round';
    shape();
    ctx.strokeStyle = '#b8420a';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.fillStyle = '#ffd36a';
    ctx.fill();
    // teeth: punch two notches back out of the grin
    ctx.fillStyle = '#000';
    ctx.fillRect(46, 83, 11, 9);
    ctx.fillRect(72, 83, 11, 9);
    // the hot core of the flame showing through
    ctx.fillStyle = 'rgba(255,250,220,.9)';
    ctx.beginPath();
    ctx.ellipse(64, 101, 18, 5, 0, 0, Math.PI * 2);
    ctx.fill();
  });

/** A ghost: a round head over a flaring, wavy sheet. */
export function ghostGeometry() {
  const pts: THREE.Vector2[] = [];
  const n = 14;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // from the hem (bottom) up to the crown
    const y = -0.75 + t * 1.5;
    const r = t > 0.55 ? Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2)) * 0.5 : 0.5 + (0.55 - t) * 0.35;
    pts.push(new THREE.Vector2(Math.max(r, 0.001), y));
  }
  const g = new THREE.LatheGeometry(pts, 20);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < -0.7) p.setY(i, p.getY(i) + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 7) * 0.09);
  }
  g.computeVertexNormals();
  // the lathe's seam sits at the front: turn it to the back so the face is painted in the middle of the texture
  g.rotateY(Math.PI);
  return g;
}

export const ghostTexture = () =>
  canvasTex(256, 256, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#eef2ff');
    g.addColorStop(0.7, '#ffffff');
    g.addColorStop(1, '#c9c2ee');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    // eyes and an "o" mouth on the front (u = 0.5), in the head
    ctx.scale(2, 2);
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    ctx.ellipse(56, 30, 4.5, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(72, 30, 4.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(64, 48, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(57.5, 27, 1.6, 0, Math.PI * 2);
    ctx.arc(73.5, 27, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,120,160,.5)';
    ctx.beginPath();
    ctx.arc(49, 42, 4, 0, Math.PI * 2);
    ctx.arc(79, 42, 4, 0, Math.PI * 2);
    ctx.fill();
  });

export const booTexture = () =>
  canvasTex(256, 128, ctx => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 76px "Unbounded", "Arial Black", sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#1a0626';
    ctx.strokeText('BOO!', 128, 66);
    ctx.fillStyle = '#e9fff0';
    ctx.fillText('BOO!', 128, 66);
  });

/** A candle flame: a soft halo and a crisp teardrop with a white-hot core. */
export const flameTexture = () =>
  canvasTex(64, 128, ctx => {
    const halo = ctx.createRadialGradient(32, 76, 2, 32, 76, 32);
    halo.addColorStop(0, 'rgba(255,170,60,.5)');
    halo.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, 64, 128);
    const g = ctx.createRadialGradient(32, 80, 1, 32, 70, 22);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.35, '#ffe68a');
    g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(32, 30);
    ctx.quadraticCurveTo(46, 66, 42, 82);
    ctx.quadraticCurveTo(32, 96, 22, 82);
    ctx.quadraticCurveTo(18, 66, 32, 30);
    ctx.fill();
  });

/** A warm pool of light on the floor under a lantern. */
export const poolTexture = () =>
  canvasTex(128, 128, ctx => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,.32)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });

const STONE = new THREE.Color('#5a5470');
const MOSS = new THREE.Color('#2f4a2a');

/** Old stone: lighter at the top, mossy and dark where it meets the ground. */
const stonePaint = (h: number) => (_x: number, y: number, _z: number, c: THREE.Color) => {
  const k = Math.min(1, Math.max(0, y / h));
  c.copy(MOSS).lerp(STONE, 0.35 + k * 0.65).multiplyScalar(0.55 + k * 0.5);
};

/** The two kinds of grave marker, merged into one geometry each: an arched headstone and a stone cross. */
export function tombGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.42, 0);
  s.lineTo(-0.42, 0.78);
  s.absarc(0, 0.78, 0.42, Math.PI, 0, true);
  s.lineTo(0.42, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 9 });
  g.translate(0, 0, -0.08);
  return paintVertices(g, stonePaint(1.2));
}

export function crossGeometry() {
  const post = new THREE.BoxGeometry(0.18, 1.35, 0.14).translate(0, 0.62, 0);
  const arm = new THREE.BoxGeometry(0.72, 0.17, 0.14).translate(0, 0.92, 0);
  const paint = stonePaint(1.3);
  const g = mergeGeometries([paintVertices(post, paint), paintVertices(arm, paint)]);
  return g;
}

/** A candle: a stout wax stick with a rounded, dripping top. */
export function candleGeometry() {
  const g = new THREE.CylinderGeometry(0.075, 0.085, 1, 9, 1).translate(0, 0.5, 0);
  return paintVertices(g, (_x, y, _z, c) => c.set('#f2e6c8').multiplyScalar(0.7 + y * 0.35));
}
