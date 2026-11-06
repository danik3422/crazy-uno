import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { nowSec } from '../../effects/fxState';
import { canvasTex } from '../decorKit';
import type { DecorProps } from '../types';
import { batTexture, wingGeometry } from './bits';

/* ---------- shared, built once ---------- */

/** A ribbed pumpkin with its stem, one geometry with vertex colours (one draw call for all of them). */
function pumpkinGeometry(lite: boolean) {
  const body = new THREE.SphereGeometry(0.6, lite ? 14 : 20, lite ? 10 : 14);
  const p = body.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const z = p.getZ(i);
    const y = p.getY(i);
    const rib = 1 + 0.06 * Math.cos(Math.atan2(z, x) * 8);
    // flattened, with a dimple on top
    p.setXYZ(i, x * rib * 1.15, y * 0.82 - (y > 0.45 ? (y - 0.45) * 0.6 : 0), z * rib * 1.15);
  }
  body.computeVertexNormals();
  const stem = new THREE.CylinderGeometry(0.05, 0.09, 0.3, 6, 1);
  stem.rotateZ(0.25);
  stem.translate(0.03, 0.52, 0);
  const paint = (g: THREE.BufferGeometry, c: string) => {
    const col = new THREE.Color(c);
    const arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) col.toArray(arr, i);
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return g.index ? g.toNonIndexed() : g;
  };
  const g = mergeGeometries([paint(body, '#ff7a1a'), paint(stem, '#3d6a1c')]);
  body.dispose();
  stem.dispose();
  return g;
}

/** The carved face: a patch of a slightly bigger sphere on the front, so it hugs the pumpkin. */
const faceGeometry = () => new THREE.SphereGeometry(0.712, 12, 8, Math.PI / 2 - 0.85, 1.7, 0.95, 1.25).scale(1.04, 0.82, 1.04);

const faceTexture = () =>
  canvasTex(128, 128, ctx => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = '#ffd36a';
    ctx.shadowColor = '#ff9a2a';
    ctx.shadowBlur = 10;
    const tri = (x: number, y: number, s: number) => {
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s, y + s * 0.6);
      ctx.lineTo(x - s, y + s * 0.6);
      ctx.closePath();
      ctx.fill();
    };
    tri(40, 42, 15);
    tri(88, 42, 15);
    tri(64, 64, 7);
    ctx.beginPath();
    ctx.moveTo(22, 80);
    for (let i = 0; i <= 8; i++) ctx.lineTo(22 + i * 10.5, 80 + (i % 2 ? 11 : 0));
    ctx.quadraticCurveTo(64, 124, 22, 80);
    ctx.closePath();
    ctx.fill();
  });

/** A ghost: a round head over a flaring, wavy sheet. */
function ghostGeometry() {
  const pts: THREE.Vector2[] = [];
  const n = 12;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    // from the hem (bottom) up to the crown
    const y = -0.75 + t * 1.5;
    const r = t > 0.55 ? Math.sqrt(Math.max(0, 1 - ((t - 0.55) / 0.45) ** 2)) * 0.5 : 0.5 + (0.55 - t) * 0.35;
    pts.push(new THREE.Vector2(Math.max(r, 0.001), y));
  }
  const g = new THREE.LatheGeometry(pts, 16);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) < -0.7) p.setY(i, p.getY(i) + Math.sin(Math.atan2(p.getZ(i), p.getX(i)) * 7) * 0.09);
  }
  g.computeVertexNormals();
  // the lathe's seam sits at the front: turn it to the back so the face is painted in the middle of the texture
  g.rotateY(Math.PI);
  return g;
}

const ghostTexture = () =>
  canvasTex(128, 128, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, '#d8e6ff');
    g.addColorStop(1, '#ffffff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    // eyes and an "o" mouth on the front (u = 0.5), in the head (v ≈ 0.7)
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    ctx.ellipse(56, 30, 4.5, 8, 0, 0, Math.PI * 2);
    ctx.ellipse(72, 30, 4.5, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(64, 48, 5, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,120,160,.5)';
    ctx.beginPath();
    ctx.arc(49, 42, 4, 0, Math.PI * 2);
    ctx.arc(79, 42, 4, 0, Math.PI * 2);
    ctx.fill();
  });

const booTexture = () =>
  canvasTex(256, 128, ctx => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 76px "Unbounded", "Arial Black", sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#1a0626';
    ctx.strokeText('BOO!', 128, 66);
    ctx.fillStyle = '#e9fff0';
    ctx.shadowColor = '#7dff6a';
    ctx.shadowBlur = 16;
    ctx.fillText('BOO!', 128, 66);
  });

const flameTexture = () =>
  canvasTex(64, 128, ctx => {
    const halo = ctx.createRadialGradient(32, 76, 2, 32, 76, 32);
    halo.addColorStop(0, 'rgba(255,170,60,.55)');
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

const poolTexture = () =>
  canvasTex(128, 128, ctx => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,.9)');
    g.addColorStop(0.4, 'rgba(255,255,255,.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });

function tombGeometry() {
  const s = new THREE.Shape();
  s.moveTo(-0.42, 0);
  s.lineTo(-0.42, 0.78);
  s.absarc(0, 0.78, 0.42, Math.PI, 0, true);
  s.lineTo(0.42, 0);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 7 });
  g.translate(0, 0, -0.08);
  return g;
}

/* ---------- layout ---------- */

interface Spot { x: number; z: number; s: number }
const faceCamera = (x: number, z: number) => Math.atan2(-x, 11 - z);

function layout(portrait: boolean, lite: boolean) {
  const pumpkins: Spot[] = portrait
    ? [{ x: -2.7, z: -8.6, s: 0.95 }, { x: 2.9, z: -8.3, s: 0.9 }, { x: -0.3, z: -11.2, s: 0.8 }]
    : [{ x: -8.7, z: -3.9, s: 1.1 }, { x: 8.5, z: -4.6, s: 1.1 }, { x: -5.1, z: -8.7, s: 0.85 }, { x: 5.5, z: -8.9, s: 0.9 }];
  const tombs: Spot[] = portrait
    ? [{ x: -3.7, z: -10.2, s: 1 }, { x: 1.4, z: -11.8, s: 0.9 }, { x: 3.9, z: -10.6, s: 1.05 }]
    : [{ x: -7.1, z: -7.9, s: 1.05 }, { x: -2.9, z: -9.8, s: 0.9 }, { x: 3.1, z: -10, s: 0.95 }, { x: 7.8, z: -7.4, s: 1.1 }, { x: -9.9, z: -6.8, s: 0.95 }];
  const candles: Spot[] = portrait
    ? [{ x: -3.2, z: -9.4, s: 1 }, { x: -2.0, z: -9.1, s: 0.7 }, { x: 2.2, z: -9.0, s: 0.8 }, { x: 3.4, z: -9.6, s: 1.1 }]
    : [
        { x: -7.6, z: -6.9, s: 1 }, { x: -6.3, z: -7.3, s: 0.7 }, { x: -4.0, z: -8.3, s: 0.9 }, { x: -2.3, z: -9.2, s: 0.65 },
        { x: 2.5, z: -9.4, s: 0.75 }, { x: 4.3, z: -8.4, s: 1 }, { x: 7.1, z: -6.7, s: 0.8 }, { x: 8.4, z: -6.5, s: 1.15 },
      ];
  const ghosts = portrait
    ? [{ x: -2.4, y: 1.4, z: -9.6 }, { x: 2.6, y: 1.6, z: -10.2 }]
    : [{ x: -3.7, y: 0.95, z: -6.9 }, { x: 4.1, y: 1.0, z: -7.2 }];
  return {
    pumpkins: lite ? pumpkins.slice(0, 3) : pumpkins,
    tombs: lite ? tombs.slice(0, 3) : tombs,
    candles: lite ? [] : candles,
    ghosts: lite ? ghosts.slice(0, 1) : ghosts,
    bats: lite ? 6 : 12,
    batZ: portrait ? -10 : -7.4,
    batRX: portrait ? 4.5 : 9.5,
  };
}

/* ---------- pointer helpers ---------- */

const setCursor = (c: string) => {
  document.body.style.cursor = c;
};

const ORANGE = new THREE.Color('#ff8a2a');

/**
 * Halloween: jack-o'-lanterns with flickering faces, tombstones and candles along the far edge,
 * ghosts drifting over the graves and a flock of bats. Pumpkins, ghosts, candles and bats react to the pointer.
 */
export function Decor({ accent, portrait, lite }: DecorProps) {
  const L = useMemo(() => layout(portrait, lite), [portrait, lite]);
  const res = useMemo(
    () => ({
      pumpkin: pumpkinGeometry(lite),
      face: faceGeometry(),
      faceTex: faceTexture(),
      ghost: ghostGeometry(),
      ghostTex: ghostTexture(),
      booTex: booTexture(),
      flameTex: flameTexture(),
      poolTex: poolTexture(),
      tomb: tombGeometry(),
      candle: new THREE.CylinderGeometry(0.07, 0.08, 1, 8, 1).translate(0, 0.5, 0),
      batTex: batTexture(),
      wing: wingGeometry(),
    }),
    [lite],
  );
  // per-instance colours exist from the start, so the materials compile with them
  const colors = useMemo(() => {
    const mk = (n: number) => new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3).fill(1), 3);
    return { faces: mk(L.pumpkins.length), pools: mk(L.pumpkins.length), flames: mk(L.candles.length) };
  }, [L]);
  useEffect(
    () => () => {
      Object.values(res).forEach(r => r.dispose());
      setCursor('');
    },
    [res],
  );

  const pumpkins = useRef<THREE.InstancedMesh>(null!);
  const faces = useRef<THREE.InstancedMesh>(null!);
  const pools = useRef<THREE.InstancedMesh>(null);
  const tombs = useRef<THREE.InstancedMesh>(null!);
  const candles = useRef<THREE.InstancedMesh>(null);
  const flames = useRef<THREE.InstancedMesh>(null);
  const ghosts = useRef<THREE.InstancedMesh>(null!);
  const ghostMat = useRef<THREE.MeshBasicMaterial>(null!);
  const bats = useRef<THREE.InstancedMesh>(null!);
  const boo = useRef<THREE.Sprite>(null!);
  const booMat = useRef<THREE.SpriteMaterial>(null!);
  const light = useRef<THREE.PointLight>(null);

  // interaction state, all in refs (no React renders)
  const st = useRef({
    hoverP: -1, hoverG: -1, hoverC: -1,
    hopAt: new Float64Array(8).fill(-10),
    booAt: new Float64Array(4).fill(-10),
    flareAt: new Float64Array(12).fill(-10),
    scatterAt: -10,
  });
  const tmp = useMemo(
    () => ({ o: new THREE.Object3D(), c: new THREE.Color(), acc: new THREE.Color(accent), q: new THREE.Quaternion(), ghostTint: new THREE.Color() }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const batSeeds = useMemo(() => Array.from({ length: L.bats }, (_, i) => ({ a: (i / L.bats) * Math.PI * 2, sp: 0.18 + Math.random() * 0.12, y: 0.9 + Math.random() * 0.9, ph: Math.random() * 6, dx: Math.random() - 0.5, dz: Math.random() - 0.5, s: 0.36 + Math.random() * 0.22 })), [L.bats]);

  // tombstones and candles never move: placed once
  useEffect(() => {
    const o = tmp.o;
    L.tombs.forEach((t, i) => {
      o.position.set(t.x, -0.05, t.z);
      o.rotation.set(-0.06 + (i % 2) * 0.1, faceCamera(t.x, t.z) + (i % 3 - 1) * 0.15, (i % 2 ? 1 : -1) * 0.08);
      o.scale.setScalar(t.s);
      o.updateMatrix();
      tombs.current.setMatrixAt(i, o.matrix);
    });
    tombs.current.instanceMatrix.needsUpdate = true;
    if (candles.current) {
      L.candles.forEach((c, i) => {
        o.position.set(c.x, 0, c.z);
        o.rotation.set(0, 0, 0);
        o.scale.set(1, 0.35 + c.s * 0.35, 1);
        o.updateMatrix();
        candles.current!.setMatrixAt(i, o.matrix);
      });
      candles.current.instanceMatrix.needsUpdate = true;
    }
    if (pools.current) {
      L.pumpkins.forEach((p, i) => {
        o.position.set(p.x, 0.012, p.z + 0.3);
        o.rotation.set(-Math.PI / 2, 0, 0);
        o.scale.setScalar(p.s * 3.4);
        o.updateMatrix();
        pools.current!.setMatrixAt(i, o.matrix);
      });
      pools.current.instanceMatrix.needsUpdate = true;
    }
  }, [L, tmp]);

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const t = state.clock.elapsedTime;
    const now = nowSec();
    const s = st.current;
    const { o, c, acc } = tmp;
    acc.lerp(c.set(accent), Math.min(1, dt * 2));

    // pumpkins: idle breathing, a shake on hover, a hop with a face flare on click
    L.pumpkins.forEach((p, i) => {
      const hop = now - s.hopAt[i];
      const hopping = hop >= 0 && hop < 0.7;
      const jump = hopping ? Math.sin((hop / 0.7) * Math.PI) * 0.9 * p.s : 0;
      const squash = hopping ? 1 + Math.sin((hop / 0.7) * Math.PI * 2) * 0.12 : 1 + Math.sin(t * 1.3 + i) * 0.015;
      const shake = s.hoverP === i ? Math.sin(t * 28) * 0.09 : 0;
      o.position.set(p.x, 0.47 * p.s * squash + jump, p.z);
      o.rotation.set(0, faceCamera(p.x, p.z) + (hopping ? hop * Math.PI * 2 / 0.7 : 0), shake);
      o.scale.set(p.s / Math.sqrt(squash), p.s * squash, p.s / Math.sqrt(squash));
      o.updateMatrix();
      pumpkins.current.setMatrixAt(i, o.matrix);
      faces.current.setMatrixAt(i, o.matrix);
      // candle flicker inside; brighter on hover, blazing (in the accent colour) right after a click
      const flare = hopping ? 1 - hop / 0.7 : 0;
      const flick = 0.7 + Math.sin(t * 9 + i * 2) * 0.12 + Math.sin(t * 23 + i * 5) * 0.08 + (s.hoverP === i ? 0.45 : 0);
      c.copy(ORANGE).lerp(acc, 0.25 + flare * 0.6).multiplyScalar(flick + flare * 1.6);
      faces.current.setColorAt(i, c);
      if (pools.current) {
        c.multiplyScalar(0.55);
        pools.current.setColorAt(i, c);
      }
    });
    pumpkins.current.instanceMatrix.needsUpdate = true;
    faces.current.instanceMatrix.needsUpdate = true;
    faces.current.instanceColor!.needsUpdate = true;
    if (pools.current?.instanceColor) pools.current.instanceColor.needsUpdate = true;

    // candle flames: billboards toward the camera, flickering; a tall witch-fire flare on click
    if (flames.current) {
      L.candles.forEach((cd, i) => {
        const f = now - s.flareAt[i];
        const flare = f >= 0 && f < 1.4 ? Math.sin(Math.min(1, f / 0.15) * Math.PI * 0.5) * (1 - f / 1.4) : 0;
        const k = 1 + Math.sin(t * 13 + i * 3.1) * 0.12 + Math.sin(t * 31 + i) * 0.06 + (s.hoverC === i ? 0.4 : 0) + flare * 1.6;
        o.position.set(cd.x + Math.sin(t * 7 + i) * 0.015, 0.35 + cd.s * 0.35 + 0.16 * k, cd.z);
        o.quaternion.copy(state.camera.quaternion);
        o.scale.set(0.34 * (0.85 + k * 0.15), 0.62 * k, 1);
        o.updateMatrix();
        flames.current!.setMatrixAt(i, o.matrix);
        c.set('#ffffff').lerp(acc, flare * 0.85);
        flames.current!.setColorAt(i, c);
      });
      flames.current.instanceMatrix.needsUpdate = true;
      flames.current.instanceColor!.needsUpdate = true;
    }

    // ghosts: drift and bob; hover makes them wobble and peek; click: BOO!, then vanish and come back
    let booOn = false;
    L.ghosts.forEach((g, i) => {
      const b = now - s.booAt[i];
      let sc = 1;
      let spin = 0;
      if (b >= 0 && b < 3.4) {
        if (b < 0.25) sc = 1 + (b / 0.25) * 0.35; // swell
        else if (b < 0.9) {
          const k = (b - 0.25) / 0.65;
          sc = 1.35 * (1 - k * k);
          spin = k * Math.PI * 3;
        } else if (b < 2.6) sc = 0; // gone
        else sc = Math.min(1, (b - 2.6) / 0.8) ** 0.5; // back
        if (b < 1.3) {
          booOn = true;
          const k = Math.min(1, b / 0.18);
          boo.current.position.set(g.x, g.y + 1.25 + b * 0.35, g.z + 0.4);
          boo.current.scale.set(2.2 * (0.6 + 0.4 * k), 1.1 * (0.6 + 0.4 * k), 1);
          booMat.current.opacity = b < 0.9 ? k : 1 - (b - 0.9) / 0.4;
        }
      }
      const hov = s.hoverG === i;
      o.position.set(g.x + Math.sin(t * 0.35 + i * 2) * 0.9, g.y + Math.sin(t * 1.4 + i) * 0.18, g.z + Math.cos(t * 0.3 + i) * 0.3);
      o.rotation.set(0.12, faceCamera(o.position.x, o.position.z) + spin + Math.sin(t * 0.8 + i) * 0.2, (hov ? Math.sin(t * 12) * 0.18 : Math.sin(t * 1.1 + i) * 0.08));
      o.scale.setScalar(Math.max(0.0001, sc * (hov ? 1.12 : 1) * (portrait ? 1 : 0.82)));
      o.updateMatrix();
      ghosts.current.setMatrixAt(i, o.matrix);
    });
    ghosts.current.instanceMatrix.needsUpdate = true;
    boo.current.visible = booOn;
    // a faint tint of the current colour in the ghosts
    ghostMat.current.color.copy(tmp.ghostTint.set('#ffffff').lerp(acc, 0.22));

    // bats: two hinged wings per bat, flapping, circling high over the graves; they scatter when startled
    const sc = now - s.scatterAt;
    const scatter = sc >= 0 && sc < 2.2 ? Math.sin((sc / 2.2) * Math.PI) ** 0.6 : 0;
    batSeeds.forEach((b, i) => {
      b.a += b.sp * dt * (1 + scatter * 2.5);
      const px = Math.cos(b.a) * L.batRX + b.dx * scatter * 9;
      const pz = L.batZ + Math.sin(b.a) * 1.8 + b.dz * scatter * 4;
      const py = b.y + Math.sin(t * 2 + b.ph) * 0.25 + scatter * (1.5 + b.dz * 2);
      const flap = Math.sin(t * (14 + scatter * 10) + b.ph) * 0.9;
      // face the camera (a bat seen edge-on is just a line), banking toward where it flies
      const bank = -Math.sin(b.a) * 0.45;
      for (const side of [1, -1]) {
        o.position.set(px, py, pz);
        o.rotation.set(-0.6, 0, bank);
        o.rotateY(side * flap);
        o.scale.set(side * b.s, b.s, b.s);
        o.updateMatrix();
        bats.current.setMatrixAt(i * 2 + (side > 0 ? 0 : 1), o.matrix);
      }
    });
    bats.current.instanceMatrix.needsUpdate = true;

    if (light.current) {
      light.current.intensity = 14 + Math.sin(t * 7) * 2.5 + Math.sin(t * 17.3) * 1.5;
      light.current.color.copy(ORANGE).lerp(acc, 0.5);
    }
  });

  // pointer handlers: each keeps its hover in a ref and stops the event, so cards never see it
  const over = (key: 'hoverP' | 'hoverG' | 'hoverC') => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    st.current[key] = e.instanceId ?? -1;
    setCursor('pointer');
  };
  const out = (key: 'hoverP' | 'hoverG' | 'hoverC') => (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    st.current[key] = -1;
    setCursor('');
  };
  const clickPumpkin = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const i = e.instanceId ?? 0;
    const now = nowSec();
    if (now - st.current.hopAt[i] > 0.7) st.current.hopAt[i] = now;
    // the bats take fright
    if (now - st.current.scatterAt > 1.2) st.current.scatterAt = now;
  };
  const clickGhost = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const i = e.instanceId ?? 0;
    const now = nowSec();
    if (now - st.current.booAt[i] > 3.4) st.current.booAt[i] = now;
  };
  const clickCandle = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    st.current.flareAt[e.instanceId ?? 0] = nowSec();
  };
  const clickBats = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (nowSec() - st.current.scatterAt > 1.2) st.current.scatterAt = nowSec();
  };

  return (
    <>
      <instancedMesh
        ref={pumpkins}
        args={[res.pumpkin, undefined, L.pumpkins.length]}
        castShadow={!lite}
        onPointerOver={over('hoverP')}
        onPointerOut={out('hoverP')}
        onClick={clickPumpkin}
      >
        <meshLambertMaterial vertexColors emissive="#ff4a00" emissiveIntensity={0.22} />
      </instancedMesh>
      <instancedMesh ref={faces} args={[res.face, undefined, L.pumpkins.length]} instanceColor={colors.faces}>
        <meshBasicMaterial map={res.faceTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {!lite && (
        <instancedMesh ref={pools} args={[undefined, undefined, L.pumpkins.length]} instanceColor={colors.pools} renderOrder={-50}>
          <planeGeometry />
          <meshBasicMaterial map={res.poolTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </instancedMesh>
      )}
      <instancedMesh ref={tombs} args={[res.tomb, undefined, L.tombs.length]}>
        <meshLambertMaterial color="#5d566b" emissive="#1b1426" />
      </instancedMesh>
      {L.candles.length > 0 && (
        <>
          <instancedMesh ref={candles} args={[res.candle, undefined, L.candles.length]}>
            <meshLambertMaterial color="#efe3c4" emissive="#4a3010" />
          </instancedMesh>
          <instancedMesh
            ref={flames}
            args={[undefined, undefined, L.candles.length]}
            instanceColor={colors.flames}
            onPointerOver={over('hoverC')}
            onPointerOut={out('hoverC')}
            onClick={clickCandle}
          >
            <planeGeometry />
            <meshBasicMaterial map={res.flameTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </instancedMesh>
        </>
      )}
      <instancedMesh ref={ghosts} args={[res.ghost, undefined, L.ghosts.length]} onPointerOver={over('hoverG')} onPointerOut={out('hoverG')} onClick={clickGhost}>
        <meshBasicMaterial ref={ghostMat} map={res.ghostTex} transparent opacity={0.88} toneMapped={false} />
      </instancedMesh>
      <sprite ref={boo} visible={false} renderOrder={5}>
        <spriteMaterial ref={booMat} map={res.booTex} transparent depthWrite={false} toneMapped={false} />
      </sprite>
      <instancedMesh ref={bats} args={[res.wing, undefined, L.bats * 2]} frustumCulled={false} onClick={clickBats}>
        <meshBasicMaterial map={res.batTex} alphaTest={0.4} side={THREE.DoubleSide} />
      </instancedMesh>
      {!lite && <pointLight ref={light} position={portrait ? [0, 2.2, -9] : [0, 2.4, -7]} distance={18} decay={1.4} />}
    </>
  );
}
