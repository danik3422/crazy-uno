import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { DecorProps } from '../types';
import { Sparkles, softGlow, spotDisc } from './sparkles';

/** the arena is centred on the pile, a little right of and behind the table centre */
const CX = 0.25;
const CZ = -0.15;
const WHITE = new THREE.Color('#ffffff');
const GOLD = new THREE.Color('#ffd65a');

/* ---------- spotlight beams ---------- */

const beamVert = /* glsl */ `
  varying float vV;
  varying float vF;
  varying vec3 vCol;
  void main() {
    mat4 m = modelMatrix * instanceMatrix;
    vec4 wp = m * vec4(position, 1.0);
    vec3 n = normalize(mat3(m) * normal);
    vF = abs(dot(n, normalize(cameraPosition - wp.xyz)));
    vV = uv.y;
    vCol = instanceColor;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const beamFrag = /* glsl */ `
  uniform float uOpacity;
  varying float vV;
  varying float vF;
  varying vec3 vCol;
  void main() {
    // soft at the silhouette, brightest near the lamp, still visible where it meets the floor
    float a = vF * vF * mix(0.5, 1.0, vV) * uOpacity;
    gl_FragColor = vec4(vCol, a);
    #include <colorspace_fragment>
  }
`;

/** an open cone, apex at the origin, opening down to radius 1 at y = -1 */
function coneGeo(seg: number) {
  const g = new THREE.CylinderGeometry(0.04, 1, 1, seg, 1, true);
  g.translate(0, -0.5, 0);
  return g;
}

/** a tapped bulb sends a bright wave round the marquee; the spotlights swing onto it meanwhile */
const WAVE = 1.4;
const FOCUS = 1.9;

/**
 * Classic: a game-show stage. A marquee of small chasing bulbs round the back of the arena and spotlights
 * sweeping the floor. Hover a bulb and it lights up; tap it and a golden wave runs round the marquee from it,
 * sparkles burst out and the spotlights swing onto it.
 */
export function Decor({ accent, portrait, lite }: DecorProps) {
  const { camera, size, viewport } = useThree();
  const acc = useMemo(() => new THREE.Color(accent), []); // eslint-disable-line react-hooks/exhaustive-deps
  const tmp = useMemo(() => new THREE.Color(), []);
  const tmp2 = useMemo(() => new THREE.Color(), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const focus = useRef({ at: -10, pos: new THREE.Vector3() });

  /* marquee bulbs on an ellipse round the back and sides of the arena */
  const nBulbs = lite ? 26 : 44;
  const bulbs = useRef<THREE.InstancedMesh>(null!);
  const halos = useRef<THREE.InstancedMesh>(null!);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(0.075, lite ? 6 : 8, lite ? 4 : 6), [lite]);
  const hitGeo = useMemo(() => new THREE.SphereGeometry(0.3, 6, 4), []);
  const haloGeo = useMemo(() => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), []);
  const bulbPos = useMemo(() => {
    const rx = portrait ? 4.8 : 9.4;
    const rz = portrait ? 7.4 : 6.3;
    return Array.from({ length: nBulbs }, (_, i) => {
      // from the left, round the back, to the right (never at the near edge, in front of the hand)
      const a = Math.PI + 0.05 - (i / (nBulbs - 1)) * (Math.PI + 0.1);
      return new THREE.Vector3(CX + Math.cos(a) * rx, 0.08, CZ - Math.sin(a) * rz);
    });
  }, [nBulbs, portrait]);

  /* spotlight beams from high above the back, with pools of light where they land */
  const nBeams = lite ? 2 : 4;
  const beams = useRef<THREE.InstancedMesh>(null!);
  const pools = useRef<THREE.InstancedMesh>(null!);
  /** the same pools again, normally blended with a dark rim: they still read on the bright yellow / blue floors */
  const spots = useRef<THREE.InstancedMesh>(null!);
  const beamGeo = useMemo(() => coneGeo(lite ? 10 : 16), [lite]);
  const beamMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: beamVert,
        fragmentShader: beamFrag,
        uniforms: { uOpacity: { value: lite ? 0.5 : 0.42 } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    [lite],
  );
  const lamps = useMemo(() => {
    const s = portrait ? 0.55 : 1;
    const all = [
      { src: new THREE.Vector3(-11 * s, 11, -10), ph: 0.0, sp: 0.21 },
      { src: new THREE.Vector3(11 * s, 11, -10), ph: 2.1, sp: 0.18 },
      { src: new THREE.Vector3(-4 * s, 12, -14), ph: 4.0, sp: 0.25 },
      { src: new THREE.Vector3(4 * s, 12, -14), ph: 5.3, sp: 0.16 },
    ].slice(0, nBeams);
    return all.map((l) => ({ ...l, aim: new THREE.Vector3(CX, 0, CZ - 3) }));
  }, [nBeams, portrait]);
  const up = useMemo(() => new THREE.Vector3(0, -1, 0), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const want = useMemo(() => new THREE.Vector3(), []);

  /* bulb interaction: which one is under the pointer, and the last tap */
  const hot = useRef(-1);
  const wave = useRef({ at: -10, from: 0 });

  const sparkles = useMemo(() => new Sparkles(lite ? 24 : 48, -3), [lite]);
  const burstCols = useMemo(() => [new THREE.Color(), WHITE, GOLD], []);

  useEffect(() => () => sparkles.dispose(), [sparkles]);
  useEffect(() => () => beamMat.dispose(), [beamMat]);
  const hovering = useRef(false);
  useEffect(
    () => () => {
      if (hovering.current) document.body.style.cursor = '';
    },
    [],
  );

  const over = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hot.current = e.instanceId ?? -1;
    hovering.current = true;
    document.body.style.cursor = 'pointer';
  };
  const out = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hot.current = -1;
    hovering.current = false;
    document.body.style.cursor = '';
  };
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const i = e.instanceId;
    if (i === undefined) return;
    const now = performance.now() / 1000;
    wave.current.at = now;
    wave.current.from = i;
    focus.current.at = now;
    focus.current.pos.copy(bulbPos[i]);
    burstCols[0].copy(acc);
    const p = bulbPos[i];
    sparkles.burst(p.x, p.y + 0.2, p.z, lite ? 14 : 26, burstCols, 2.6, 0.3, 1.4);
  };

  useFrame((st, dt) => {
    const t = st.clock.elapsedTime;
    const now = performance.now() / 1000;
    acc.lerp(tmp.set(accent), Math.min(1, dt * 2));
    const cam = camera as THREE.PerspectiveCamera;
    sparkles.setScale((size.height * viewport.dpr) / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)));

    // bulbs: a chase running round the marquee, every fourth bulb bright, the rest glowing in the colour
    const step = Math.floor(t * 7);
    const b = bulbs.current;
    const h = halos.current;
    // a tapped bulb's wave: a bright front running both ways round the marquee
    const wt = now - wave.current.at;
    const front = wt < WAVE ? (wt / WAVE) * nBulbs : -99;
    for (let i = 0; i < nBulbs; i++) {
      const lit = (i + step) % 4 === 0;
      const twinkle = 0.75 + 0.25 * Math.sin(t * 3 + i * 0.7);
      const w = front < 0 ? 0 : Math.max(0, 1 - Math.abs(Math.abs(i - wave.current.from) - front) / 2.5);
      if (i === hot.current || w > 0.05) tmp2.copy(GOLD).lerp(WHITE, 0.6).multiplyScalar(1.4 + w * 0.8);
      else if (lit) tmp2.copy(GOLD).lerp(WHITE, 0.4).multiplyScalar(1.1);
      else tmp2.copy(acc).lerp(WHITE, 0.25).multiplyScalar(0.6 + 0.2 * twinkle);
      b.setColorAt(i, tmp2);
      if (h) h.setColorAt(i, tmp2.multiplyScalar(lit ? 0.4 : 0.3));
    }
    b.instanceColor!.needsUpdate = true;
    if (h) h.instanceColor!.needsUpdate = true;

    // beams: each wanders over the floor; for a moment after a bulb is tapped they all swing onto it
    const f = focus.current;
    const fk = now - f.at < FOCUS ? Math.min(1, (now - f.at) * 5) * Math.min(1, (FOCUS - (now - f.at)) * 3) : 0;
    const bm = beams.current;
    const pm = pools.current;
    lamps.forEach((l, i) => {
      const s = portrait ? 0.5 : 1;
      want.set(CX + Math.sin(t * l.sp + l.ph) * 6.5 * s, 0, CZ - 2.2 + Math.cos(t * l.sp * 1.3 + l.ph) * 3.2);
      if (fk > 0) want.lerp(f.pos, fk);
      l.aim.lerp(want, Math.min(1, dt * (fk > 0 ? 6 : 2)));
      dir.subVectors(l.aim, l.src);
      const len = dir.length();
      dummy.position.copy(l.src);
      dummy.quaternion.setFromUnitVectors(up, dir.normalize());
      const r = 0.95 + fk * -0.3;
      dummy.scale.set(r, len, r);
      dummy.updateMatrix();
      bm.setMatrixAt(i, dummy.matrix);
      tmp2.copy(acc).lerp(WHITE, 0.55 + fk * 0.3);
      bm.setColorAt(i, tmp2);
      // the pool on the floor right under where the beam points
      dummy.position.set(l.aim.x, 0.015, l.aim.z);
      dummy.quaternion.identity();
      dummy.scale.setScalar(2.8 - fk * 0.8);
      dummy.updateMatrix();
      pm.setMatrixAt(i, dummy.matrix);
      dummy.position.y = 0.012;
      dummy.updateMatrix();
      spots.current.setMatrixAt(i, dummy.matrix);
      spots.current.setColorAt(i, tmp.copy(tmp2).lerp(WHITE, 0.5));
      pm.setColorAt(i, tmp2.multiplyScalar(0.45 + fk * 0.3));
    });
    bm.instanceMatrix.needsUpdate = true;
    bm.instanceColor!.needsUpdate = true;
    pm.instanceMatrix.needsUpdate = true;
    pm.instanceColor!.needsUpdate = true;
    spots.current.instanceMatrix.needsUpdate = true;
    spots.current.instanceColor!.needsUpdate = true;

    sparkles.update(dt);
  });

  return (
    <group>
      {/* invisible, larger targets round the bulbs: easy to hover and tap, never drawn */}
      <instancedMesh args={[hitGeo, undefined, nBulbs]} onPointerOver={over} onPointerOut={out} onClick={click}
        onUpdate={(m) => bulbPos.forEach((p, i) => { dummy.position.copy(p); dummy.quaternion.identity(); dummy.scale.setScalar(1); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); })}>
        <meshBasicMaterial visible={false} />
      </instancedMesh>
      <instancedMesh ref={bulbs} args={[bulbGeo, undefined, nBulbs]} frustumCulled={false}
        onUpdate={(m) => bulbPos.forEach((p, i) => { dummy.position.copy(p); dummy.quaternion.identity(); dummy.scale.setScalar(1); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, WHITE); })}>
        <meshBasicMaterial toneMapped={false} />
      </instancedMesh>
      {!lite && (
        <instancedMesh ref={halos} args={[haloGeo, undefined, nBulbs]} frustumCulled={false}
          onUpdate={(m) => bulbPos.forEach((p, i) => { dummy.position.set(p.x, 0.012, p.z); dummy.quaternion.identity(); dummy.scale.setScalar(0.8); dummy.updateMatrix(); m.setMatrixAt(i, dummy.matrix); m.setColorAt(i, WHITE); })}>
          <meshBasicMaterial map={softGlow()} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
        </instancedMesh>
      )}
      <instancedMesh ref={beams} args={[beamGeo, beamMat, nBeams]} frustumCulled={false}
        onUpdate={(m) => { for (let i = 0; i < nBeams; i++) m.setColorAt(i, WHITE); }} />
      <instancedMesh ref={pools} args={[haloGeo, undefined, nBeams]} frustumCulled={false}
        onUpdate={(m) => { for (let i = 0; i < nBeams; i++) m.setColorAt(i, WHITE); }}>
        <meshBasicMaterial map={softGlow()} transparent depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={spots} args={[haloGeo, undefined, nBeams]} frustumCulled={false}
        onUpdate={(m) => { for (let i = 0; i < nBeams; i++) m.setColorAt(i, WHITE); }}>
        <meshBasicMaterial map={spotDisc()} transparent depthWrite={false} toneMapped={false} />
      </instancedMesh>
      <primitive object={sparkles.points} />
    </group>
  );
}
