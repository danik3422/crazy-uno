import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { makeView, restCamera, type Rect } from '../../layout';
import { ballOnScreen, underHud, useHudZones } from '../decorKit';
import type { DecorProps } from '../types';
import { glowTexture, merge } from './bits';
import { CAB, cabinGeometry, windowGeometry, windowTexture } from './cabin';
import { fitToHud, layout, type Sizes, type WinterLayout } from './layout';
import { LANTERN_GLOW_Y, bankGeometry, lanternGeometry, pineGeometry, pineRadius } from './props';
import { LIGHT, snowFrag, snowVert } from './snowfall';
import { armGeometry, hatGeometry, scarfGeometry, snowmanGeometry } from './snowman';

/* ---------- the aurora: a curtain of light low over the far edge ---------- */

const auroraVert = /* glsl */ `
  uniform float uTime;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    vec3 p = position;
    float sx = (uv.x - 0.5) * 2.0;
    // bowed toward the camera at the ends, gently rippling
    p.z += sx * sx * 2.6 + sin(uv.x * 9.0 + uTime * 0.25) * 0.6;
    p.y += sin(uv.x * 16.0 + uTime * 0.4) * 0.09 * uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const auroraFrag = /* glsl */ `
  uniform float uTime;
  uniform vec3 uAccent;
  uniform float uStrength;
  varying vec2 vUv;
  void main() {
    float rays = 0.6 + 0.4 * sin(vUv.x * 90.0 + sin(vUv.x * 13.0 + uTime * 0.5) * 4.0);
    float band = smoothstep(0.0, 0.18, vUv.y) * pow(1.0 - vUv.y, 1.6);
    float wave = 0.35 + 0.65 * smoothstep(-0.2, 1.0, sin(vUv.x * 7.0 - uTime * 0.22) * 0.5 + 0.5);
    float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    vec3 c = mix(vec3(0.2, 1.0, 0.62), vec3(0.62, 0.42, 1.0), smoothstep(0.25, 0.95, vUv.y + 0.25 * sin(vUv.x * 5.0 + uTime * 0.15)));
    c = mix(c, uAccent, 0.3);
    gl_FragColor = vec4(c * band * rays * wave * edge * uStrength, 1.0);
  }
`;

const faceCamera = (x: number, z: number) => Math.atan2(-x, 11 - z);

/** a small seeded random, so the banks come out the same every time */
function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

const setCursor = (c: string) => {
  document.body.style.cursor = c;
};

const LIGHT_COLS = ['#ffcf5a', '#ff6a7a', '#7affc8', '#8fd4ff', '#fff4e0'].map(c => new THREE.Color(c));
const LANTERN_COL = new THREE.Color('#ffc46a');
const WARM = new THREE.Color('#ffb85a');

/**
 * Winter: a frozen lake in moonlit snow, iron lanterns along the shore, snowy pines in the far corners,
 * a log cabin with warm windows and fairy lights, a snowman in a top hat with a scarf in the colour of play,
 * crisp snow falling at the edges of the screen (never over the play area) and an aurora low over the far edge.
 * Click a pine to shake its snow off, the cabin to switch its lights on, the snowman to wave and lose his hat.
 * Nothing stands under the HUD or a plate: the layout is checked against them as measured on the page (fitToHud).
 */
export function Decor({ accent, portrait, lite }: DecorProps) {
  const base = useMemo(() => layout(portrait, lite), [portrait, lite]);
  // the layout as it ends up clear of the HUD (worked out in the render loop when the HUD or the screen changes)
  const [L, setL] = useState<WinterLayout>(base);
  const hud = useHudZones();
  const fitted = useRef({ version: -1, base, key: '', w: 0, h: 0 });
  const box = useMemo((): Rect => ({ x0: 0, y0: 0, x1: 0, y1: 0 }), []);
  const res = useMemo(
    () => ({
      pine: pineGeometry(lite),
      lantern: lanternGeometry(lite),
      glow: glowTexture(),
      cabin: cabinGeometry(),
      windows: windowGeometry(),
      windowTex: windowTexture(),
      snowman: snowmanGeometry(lite, lite ? '#d83a4a' : null),
      scarf: scarfGeometry(),
      arm: armGeometry(),
      hat: hatGeometry(),
      aurora: new THREE.PlaneGeometry(1, 1, lite ? 24 : 48, 1).translate(0, 0.5, 0),
    }),
    [lite],
  );
  const sizes = useMemo((): Sizes => {
    const ball = (g: THREE.BufferGeometry, top = 0) => {
      if (!g.boundingSphere) g.computeBoundingSphere();
      const b = g.boundingSphere!;
      return { r: Math.max(b.radius, top / 2), y: Math.max(b.center.y, top / 2) };
    };
    // the snowman's hat sits on top of his own geometry (at 1.98)
    return { pine: ball(res.pine), lantern: ball(res.lantern), cabin: ball(res.cabin), snowman: ball(res.snowman, 2.3) };
  }, [res]);
  const placed = useMemo(() => {
    // snow drifts heaped round the foot of everything that stands in the snow, so nothing floats on the floor
    const r = rng(7);
    const banks = [...L.pines, ...L.lanterns, ...(L.cabin ? [L.cabin] : []), ...(L.snowman ? [L.snowman] : [])].flatMap(o =>
      [0, 1].map(k => {
        const a = r() * Math.PI * 2;
        const d = (0.7 + r() * 0.5) * o.s * (k ? 1.4 : 1);
        return { x: o.x + Math.cos(a) * d, z: o.z + Math.sin(a) * d * 0.7, s: (0.55 + r() * 0.4) * o.s, a: r() * Math.PI };
      }),
    );
    // the lanterns' warm pools on the snow: one quad each, merged
    const pools = merge(
      L.lanterns.map(l => {
        const g = new THREE.PlaneGeometry(2.4 * l.s, 2.4 * l.s).rotateX(-Math.PI / 2).translate(l.x, 0.02, l.z).toNonIndexed();
        return g;
      }),
    );
    return { banks: bankGeometry(banks, lite), pools };
  }, [L, lite]);

  // the cabin's transform, used to place its fairy lights and its burst of snow
  const cabinM = useMemo(() => {
    const o = new THREE.Object3D();
    if (L.cabin) {
      o.position.set(L.cabin.x, 0, L.cabin.z);
      o.rotation.y = faceCamera(L.cabin.x, L.cabin.z);
      o.scale.setScalar(L.cabin.s);
    }
    o.updateMatrix();
    return o.matrix.clone();
  }, [L]);

  const cloud = useMemo(() => {
    const lights: { p: THREE.Vector3; c: THREE.Color; kind: number }[] = [];
    // along the front eaves of the cabin
    const { w, d, wall, gable } = CAB;
    const half = w / 2 + 0.3;
    for (let i = 0; i <= 12 && L.cabin; i++) {
      const x = -half + (i / 12) * half * 2;
      const y = wall - 0.04 + (gable + 0.1) * (1 - Math.abs(x) / half);
      lights.push({ p: new THREE.Vector3(x, y - 0.06, d / 2 + 0.26).applyMatrix4(cabinM), c: LIGHT_COLS[i % LIGHT_COLS.length], kind: LIGHT.fairy });
    }
    // wound round the two nearest pines
    if (!lite) {
      L.pines.slice(0, 2).forEach(p => {
        for (let k = 0; k < 12; k++) {
          const f = k / 12;
          const y = 0.5 + f * 1.5;
          const a = f * Math.PI * 4.5;
          const r = pineRadius(y) * 1.02 + 0.04;
          lights.push({ p: new THREE.Vector3(p.x + Math.cos(a) * r * p.s, y * p.s, p.z + Math.sin(a) * r * p.s), c: LIGHT_COLS[k % LIGHT_COLS.length], kind: LIGHT.fairy });
        }
      });
    }
    // each lantern's flame, nudged toward the camera so the glass never hides it
    for (const l of L.lanterns) {
      const p = new THREE.Vector3(l.x, LANTERN_GLOW_Y * l.s, l.z);
      p.add(L.cam.clone().sub(p).normalize().multiplyScalar(0.16 * l.s));
      lights.push({ p, c: LANTERN_COL, kind: LIGHT.lantern });
    }
    const n = L.flakes + L.burst + lights.length;
    const pos = new Float32Array(n * 3);
    const kind = new Float32Array(n);
    const seed = new Float32Array(n);
    const dir = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const { box } = L;
    const r = rng(11);
    for (let i = 0; i < n; i++) {
      seed[i] = r();
      if (i < L.flakes) {
        pos.set([(r() * 2 - 1) * box.x, r() * box.y, box.z0 + r() * (box.z1 - box.z0)], i * 3);
      } else if (i < L.flakes + L.burst) {
        kind[i] = LIGHT.burst;
        const a = r() * Math.PI * 2;
        const up = 0.2 + r() * 0.9;
        const rr = 0.4 + r() * 0.6;
        dir.set([Math.cos(a) * rr, up, Math.sin(a) * rr], i * 3);
      } else {
        const l = lights[i - L.flakes - L.burst];
        kind[i] = l.kind;
        l.p.toArray(pos, i * 3);
        l.c.toArray(col, i * 3);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    g.setAttribute('aDir', new THREE.BufferAttribute(dir, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    return g;
  }, [L, lite, cabinM]);

  const snowU = useMemo(
    () => ({
      uTime: { value: 0 },
      uViewH: { value: 800 },
      uBurst: { value: new THREE.Vector4(0, 0, 0, -100) },
      uSpread: { value: 1.5 },
      uLights: { value: 0 },
      uBox: { value: new THREE.Vector3(L.box.x, L.box.y, 0) },
      uMask: { value: L.mask },
    }),
    [L],
  );
  const auroraU = useMemo(() => ({ uTime: { value: 0 }, uAccent: { value: new THREE.Color(accent) }, uStrength: { value: 0.75 } }), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      Object.values(res).forEach(r => r.dispose());
      setCursor('');
    },
    [res],
  );
  useEffect(
    () => () => {
      placed.banks.dispose();
      placed.pools.dispose();
      cloud.dispose();
    },
    [placed, cloud],
  );

  const pines = useRef<THREE.InstancedMesh>(null!);
  const lanterns = useRef<THREE.InstancedMesh>(null!);
  const snowman = useRef<THREE.Group>(null);
  const arm = useRef<THREE.Mesh>(null);
  const hat = useRef<THREE.Mesh>(null);
  const scarfMat = useRef<THREE.MeshLambertMaterial>(null);
  const winMat = useRef<THREE.MeshBasicMaterial>(null);
  const poolMat = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);

  // interaction state lives in refs: no React renders
  const st = useRef({ hoverPine: -1, hoverCabin: false, hoverMan: false, shakeAt: new Float64Array(16).fill(-10), lightsAt: -10, waveAt: -10, clock: 0 });
  const tmp = useMemo(() => ({ o: new THREE.Object3D(), c: new THREE.Color(), acc: new THREE.Color(accent), v: new THREE.Vector3() }), []); // eslint-disable-line react-hooks/exhaustive-deps
  // per-instance colours exist from the start, so the material compiles with them
  const pineColors = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(L.pines.length * 3).fill(1), 3), [L]);

  // the lanterns never move: their matrices are set once
  useEffect(() => {
    const { o } = tmp;
    L.lanterns.forEach((l, i) => {
      o.position.set(l.x, 0, l.z);
      o.rotation.set(0, faceCamera(l.x, l.z) + Math.PI / 4, 0);
      o.scale.setScalar(l.s);
      o.updateMatrix();
      lanterns.current.setMatrixAt(i, o.matrix);
    });
    lanterns.current.instanceMatrix.needsUpdate = true;
  }, [L, tmp]);

  const burst = (x: number, y: number, z: number, spread: number) => {
    snowU.uBurst.value.set(x, y, z, st.current.clock);
    snowU.uSpread.value = spread;
  };

  useFrame((state, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1);
    const t = state.clock.elapsedTime;
    const s = st.current;
    s.clock = t;
    const { o, c, acc } = tmp;

    // the layout clear of the HUD: worked out again only when the HUD, the screen or the base layout changes
    const { width: w, height: h } = state.size;
    const zones = hud.current;
    const f = fitted.current;
    if (f.version !== zones.version || f.base !== base || f.w !== w || f.h !== h) {
      f.version = zones.version;
      f.base = base;
      f.w = w;
      f.h = h;
      const cam = restCamera(makeView(w, h));
      const check = (x: number, y: number, z: number, r: number, pad: number) => {
        ballOnScreen(cam, w, h, x, y, z, r, box);
        // its middle on the screen, not just a sliver at the edge
        const seen = box.x0 < box.x1 && (box.x0 + box.x1) / 2 > 0 && (box.x0 + box.x1) / 2 < w && (box.y0 + box.y1) / 2 > 0 && (box.y0 + box.y1) / 2 < h;
        return { clear: !underHud(box, zones.rects, pad), seen };
      };
      const next = fitToHud(base, sizes, check);
      const key = JSON.stringify([next.pines, next.lanterns, next.cabin, next.snowman]);
      if (key !== f.key) {
        f.key = key;
        setL(next);
      }
    }
    acc.lerp(c.set(accent), Math.min(1, dt * 2));
    snowU.uTime.value = t;
    snowU.uViewH.value = state.size.height * state.viewport.dpr;

    // pines: a slow sway; hover brightens, a click shakes the snow off
    const pm = pines.current;
    for (let i = 0; i < L.pines.length; i++) {
      const p = L.pines[i];
      const k = t - s.shakeAt[i];
      const shake = k >= 0 && k < 1.2 ? Math.sin(k * 30) * 0.12 * (1 - k / 1.2) : 0;
      const hov = s.hoverPine === i;
      o.position.set(p.x, 0, p.z);
      o.rotation.set(Math.sin(t * 0.6 + i) * 0.01 + shake * 0.5, i * 1.3, Math.sin(t * 0.8 + i * 2) * 0.012 + shake + (hov ? Math.sin(t * 9) * 0.03 : 0));
      o.scale.setScalar(p.s * (hov ? 1.04 : 1));
      o.updateMatrix();
      pm.setMatrixAt(i, o.matrix);
      // a little variety in shade from tree to tree
      pm.setColorAt(i, c.setScalar((0.86 + ((i * 37) % 10) * 0.016) * (hov ? 1.3 : 1)));
    }
    pm.instanceMatrix.needsUpdate = true;
    pm.instanceColor!.needsUpdate = true;

    // cabin windows: a warm flicker; a click flicks them off and on, then they blaze for a while
    const lk = t - s.lightsAt;
    let glow = 1 + Math.sin(t * 6.3) * 0.04 + Math.sin(t * 13.1) * 0.03 + (s.hoverCabin ? 0.35 : 0);
    let flare = 0;
    if (lk >= 0 && lk < 4) {
      if (lk < 0.6) glow *= Math.sin(lk * 40) > 0 ? 1.6 : 0.15;
      else flare = lk < 1 ? 1 : 1 - (lk - 1) / 3;
    }
    glow += flare * 0.8;
    winMat.current?.color.copy(WARM).lerp(acc, 0.15 + flare * 0.25).multiplyScalar(glow);
    snowU.uLights.value = (s.hoverCabin ? 0.3 : 0) + flare * 1.2;
    if (light.current) {
      light.current.intensity = L.cabin ? 5 * glow : 0;
      light.current.color.copy(WARM).lerp(acc, 0.2);
    }
    if (poolMat.current) poolMat.current.opacity = 0.5 + Math.sin(t * 7.3) * 0.03 + Math.sin(t * 12.9) * 0.02 + flare * 0.2;

    // the snowman: a gentle lean, a wobble on hover; a click makes him wave and his hat pop up and spin
    const wk = t - s.waveAt;
    const waving = wk >= 0 && wk < 2;
    const man = snowman.current;
    if (man && arm.current && hat.current) {
      man.rotation.z = Math.sin(t * 0.8) * 0.015 + (s.hoverMan ? Math.sin(t * 10) * 0.05 : 0) + (waving && wk < 0.4 ? Math.sin(wk * 25) * 0.06 * (1 - wk / 0.4) : 0);
      arm.current.rotation.z = waving ? 0.5 + Math.abs(Math.sin(wk * 7)) * 0.9 * Math.min(1, (2 - wk) * 2) : 0.35 + Math.sin(t * 1.3) * 0.05;
      const hk = waving ? wk / 1.1 : 1;
      const hm = hat.current;
      if (hk < 1) {
        hm.position.y = 1.98 + Math.sin(hk * Math.PI) * 1.1;
        hm.rotation.set(Math.sin(hk * Math.PI) * 0.4, hk * Math.PI * 4, 0);
      } else {
        hm.position.y = 1.98;
        hm.rotation.set(0, 0, -0.12 + (s.hoverMan ? Math.sin(t * 10) * 0.08 : 0));
      }
    }
    if (scarfMat.current) scarfMat.current.color.copy(acc);

    auroraU.uTime.value = t;
    auroraU.uAccent.value.copy(acc);
  });

  const stop = (e: ThreeEvent<PointerEvent | MouseEvent>) => e.stopPropagation();
  const overPine = (e: ThreeEvent<PointerEvent>) => {
    stop(e);
    st.current.hoverPine = e.instanceId ?? -1;
    setCursor('pointer');
  };
  const outPine = (e: ThreeEvent<PointerEvent>) => {
    stop(e);
    st.current.hoverPine = -1;
    setCursor('');
  };
  const clickPine = (e: ThreeEvent<MouseEvent>) => {
    stop(e);
    const i = e.instanceId ?? 0;
    const p = L.pines[i];
    st.current.shakeAt[i] = st.current.clock;
    burst(p.x, 1.5 * p.s, p.z, 1.6 * p.s);
  };
  const hover = (key: 'hoverCabin' | 'hoverMan', on: boolean) => (e: ThreeEvent<PointerEvent>) => {
    stop(e);
    st.current[key] = on;
    setCursor(on ? 'pointer' : '');
  };
  const clickCabin = (e: ThreeEvent<MouseEvent>) => {
    stop(e);
    if (st.current.clock - st.current.lightsAt > 1) st.current.lightsAt = st.current.clock;
    tmp.v.set(0, CAB.wall + CAB.gable + 0.2, 0).applyMatrix4(cabinM);
    burst(tmp.v.x, tmp.v.y, tmp.v.z, 1.8 * (L.cabin?.s ?? 1));
  };
  const clickMan = (e: ThreeEvent<MouseEvent>) => {
    stop(e);
    if (L.snowman && st.current.clock - st.current.waveAt > 2) {
      st.current.waveAt = st.current.clock;
      burst(L.snowman.x, 2.0 * L.snowman.s, L.snowman.z, 1.2);
    }
  };

  const man = L.snowman;
  const cabinAt = L.cabin ?? base.cabin ?? { x: 0, z: 0 };
  return (
    <group name="decor">
      <instancedMesh name="pine" ref={pines} args={[res.pine, undefined, L.pines.length]} instanceColor={pineColors} onPointerOver={overPine} onPointerOut={outPine} onClick={clickPine}>
        <meshLambertMaterial vertexColors emissive="#0a1a2a" />
      </instancedMesh>
      <mesh name="banks" geometry={placed.banks}>
        <meshLambertMaterial vertexColors emissive="#1a2440" />
      </mesh>
      <instancedMesh name="lantern" ref={lanterns} args={[res.lantern, undefined, L.lanterns.length]}>
        <meshLambertMaterial vertexColors emissive="#141a26" />
      </instancedMesh>
      {!lite && (
        <mesh name="pools" geometry={placed.pools} renderOrder={1}>
          <meshBasicMaterial ref={poolMat} map={res.glow} color="#ffb24a" transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </mesh>
      )}
      {L.cabin && (
        <group position={[L.cabin.x, 0, L.cabin.z]} rotation={[0, faceCamera(L.cabin.x, L.cabin.z), 0]} scale={L.cabin.s}>
          <mesh name="cabin" geometry={res.cabin} onPointerOver={hover('hoverCabin', true)} onPointerOut={hover('hoverCabin', false)} onClick={clickCabin}>
            <meshLambertMaterial vertexColors emissive="#140a10" />
          </mesh>
          <mesh name="windows" geometry={res.windows} renderOrder={2}>
            <meshBasicMaterial ref={winMat} map={res.windowTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </mesh>
        </group>
      )}
      {man && (
        <group ref={snowman} position={[man.x, 0, man.z]} rotation={[0, faceCamera(man.x, man.z), 0]} scale={man.s}>
          <mesh name="snowman" geometry={res.snowman} onPointerOver={hover('hoverMan', true)} onPointerOut={hover('hoverMan', false)} onClick={clickMan}>
            <meshLambertMaterial vertexColors emissive="#1a2238" />
          </mesh>
          {!lite && (
            <mesh geometry={res.scarf}>
              <meshLambertMaterial ref={scarfMat} emissive="#200810" />
            </mesh>
          )}
          <mesh ref={arm} geometry={res.arm} position={[0.38, 1.32, 0]}>
            <meshLambertMaterial vertexColors />
          </mesh>
          <mesh ref={hat} geometry={res.hat} position={[0, 1.98, 0]} onPointerOver={hover('hoverMan', true)} onPointerOut={hover('hoverMan', false)} onClick={clickMan}>
            <meshLambertMaterial vertexColors emissive="#101018" />
          </mesh>
        </group>
      )}
      {/* premultiplied blending: flakes cover what is behind them, lights add to it (alpha 0) */}
      <points geometry={cloud} frustumCulled={false} renderOrder={6}>
        <shaderMaterial
          vertexShader={snowVert}
          fragmentShader={snowFrag}
          uniforms={snowU}
          transparent
          depthWrite={false}
          blending={THREE.CustomBlending}
          blendSrc={THREE.OneFactor}
          blendDst={THREE.OneMinusSrcAlphaFactor}
        />
      </points>
      {!lite && (
        <mesh name="aurora" geometry={res.aurora} position={[0, 0.15, L.aurora.z]} scale={[L.aurora.w, L.aurora.h, 1]} renderOrder={-10} frustumCulled={false}>
          <shaderMaterial vertexShader={auroraVert} fragmentShader={auroraFrag} uniforms={auroraU} transparent depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* stays mounted (dark) when the cabin has no room: a light coming and going would rebuild every material */}
      {!lite && <pointLight ref={light} position={[cabinAt.x, 1.2, cabinAt.z + 2.2]} distance={9} decay={1.5} />}
    </group>
  );
}
