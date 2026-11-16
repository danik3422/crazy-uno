import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { nowSec } from '../../effects/fxState';
import { makeView, restCamera, visibleHalfWidth, type Rect } from '../../layout';
import { Placer, ballOf, ballOnScreen, underHud, useHudZones } from '../decorKit';
import type { DecorProps } from '../types';
import { batTexture, dotTexture, wingGeometry } from './bits';
import { fitToHud, fitToScreen, layout, phoneLayout, type HalloweenLayout, type Sizes } from './layout';
import {
  booTexture, candleGeometry, crossGeometry, faceGeometry, faceTexture, flameTexture, ghostGeometry, ghostTexture,
  poolTexture, pumpkinGeometry, tombGeometry,
} from './shapes';

/** turns an object at (x, z) to face the camera (which sits at about z = 11) */
const faceCamera = (x: number, z: number) => Math.atan2(-x, 11 - z);

const setCursor = (c: string) => {
  document.body.style.cursor = c;
};

const ORANGE = new THREE.Color('#ff8a2a');
/** how big the ghosts are drawn */
const GHOST_SCALE = { landscape: 0.78, portrait: 0.95 };
const WITCH = new THREE.Color('#9dff5a');

/**
 * Halloween: a graveyard at the far rim of the table. Jack-o'-lanterns with flickering faces in the far corners,
 * headstones and crosses along the back, candles, two shy ghosts drifting over the graves, a flock of bats
 * high above and will-o'-wisps bobbing in the mist. Pumpkins, ghosts, candles and bats react to the pointer.
 * About a dozen draw calls on a desktop, seven on a phone (no candles, pools or point light there).
 * Nothing stays under the HUD or a plate: the layout is checked against them as measured on the page (fitToHud),
 * and a bat or a will-o'-wisp passing under one fades out until it is clear.
 */
export function Decor({ accent, portrait, lite }: DecorProps) {
  const gl = useThree(s => s.gl);
  // the corner lanterns follow the screen's shape (rounded, so a resize does not rebuild them every pixel)
  const aspect = useThree(s => Math.round((s.size.width / Math.max(1, s.size.height)) * 20) / 20);
  const halfWidth = useMemo(() => (z: number) => visibleHalfWidth({ portrait, aspect }, 0, z), [portrait, aspect]);
  const base = useMemo(() => {
    const b = layout(portrait, lite);
    return portrait ? b : fitToScreen(b, halfWidth);
  }, [portrait, lite, halfWidth]);
  // the layout as it ends up clear of the HUD (worked out in the render loop when the HUD or the screen changes)
  const [L, setL] = useState<HalloweenLayout>(base);
  const hud = useHudZones();
  const fitted = useRef({ version: -1, base, key: '', w: 0, h: 0 });
  const res = useMemo(() => {
    const r = {
      pumpkin: pumpkinGeometry(lite),
      face: faceGeometry(),
      faceTex: faceTexture(),
      ghost: ghostGeometry(),
      ghostTex: ghostTexture(),
      booTex: booTexture(),
      flameTex: flameTexture(),
      poolTex: poolTexture(),
      dotTex: dotTexture(),
      tomb: tombGeometry(),
      cross: crossGeometry(),
      candle: candleGeometry(),
      batTex: batTexture(),
      wing: wingGeometry(),
    };
    // seen at a grazing angle from far away: sharp, not smeared
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    for (const t of [r.faceTex, r.ghostTex, r.booTex, r.batTex]) t.anisotropy = aniso;
    return r;
  }, [lite, gl]);
  const sizes = useMemo((): Sizes => {
    const ball = (g: THREE.BufferGeometry) => {
      if (!g.boundingSphere) g.computeBoundingSphere();
      return { r: g.boundingSphere!.radius, y: g.boundingSphere!.center.y };
    };
    // a pumpkin stands with its middle 0.46 up, a ghost is drawn at GHOST_SCALE (see the render loop)
    const g = ball(res.ghost);
    const k = portrait ? GHOST_SCALE.portrait : GHOST_SCALE.landscape;
    return { pumpkin: { r: ball(res.pumpkin).r, y: 0.46 }, tomb: ball(res.tomb), cross: ball(res.cross), ghost: { r: g.r * k, y: g.y * k } };
  }, [res, portrait]);
  // tighter boxes for a phone's small free room (a pumpkin stands on the ground: its geometry is centred on its middle)
  const balls = useMemo(() => {
    const p = ballOf(res.pumpkin);
    return { pumpkin: { ...p, y: 0.46 }, tomb: ballOf(res.tomb), cross: ballOf(res.cross), ghost: sizes.ghost };
  }, [res, sizes]);
  // per-instance colours exist from the start, so the materials compile with them
  const colors = useMemo(() => {
    const mk = (n: number) => new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3).fill(1), 3);
    return { faces: mk(L.pumpkins.length), pools: mk(L.pumpkins.length), flames: mk(L.candles.length) };
  }, [L]);
  // will-o'-wisps: one Points draw call; positions and colours rewritten each frame (a few dozen floats)
  const wisp = useMemo(() => {
    const [x0, x1, z0, z1] = base.wispBox;
    const seeds = Array.from({ length: base.wisps }, (_, i) => {
      let x = x0 + Math.random() * (x1 - x0);
      // keep the middle of the far side clear (that's where the top player plate sits)
      if (Math.abs(x) < base.wispGap) x = Math.sign(x || 1) * (base.wispGap + Math.random() * 2);
      return { x, z: z0 + Math.random() * (z1 - z0), y: 0.35 + Math.random() * 1.3, ph: Math.random() * 6.28, sp: 0.25 + Math.random() * 0.35, hue: i % 3, vis: 1 };
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(base.wisps * 3), 3));
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(base.wisps * 3), 3));
    return { seeds, geo };
  }, [base]);
  useEffect(
    () => () => {
      Object.values(res).forEach(r => r.dispose());
      setCursor('');
    },
    [res],
  );
  useEffect(() => () => wisp.geo.dispose(), [wisp]);

  const pumpkins = useRef<THREE.InstancedMesh>(null!);
  const faces = useRef<THREE.InstancedMesh>(null!);
  const pools = useRef<THREE.InstancedMesh>(null);
  const tombs = useRef<THREE.InstancedMesh>(null!);
  const crosses = useRef<THREE.InstancedMesh>(null!);
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
    () => ({ o: new THREE.Object3D(), c: new THREE.Color(), acc: new THREE.Color(accent), ghostTint: new THREE.Color(), box: { x0: 0, y0: 0, x1: 0, y1: 0 } as Rect }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const batSeeds = useMemo(
    () => Array.from({ length: base.bats }, (_, i) => ({ a: (i / base.bats) * Math.PI * 2, sp: 0.16 + Math.random() * 0.1, y: 1.5 + Math.random() * 0.9, ph: Math.random() * 6, dx: Math.random() - 0.5, dz: Math.random() - 0.5, s: 0.34 + Math.random() * 0.2, vis: 1 })),
    [base.bats],
  );

  // headstones, crosses, candles and light pools never move: placed once
  useEffect(() => {
    const o = tmp.o;
    const place = (mesh: THREE.InstancedMesh, spots: typeof L.tombs, lean: number) => {
      spots.forEach((t, i) => {
        o.position.set(t.x, -0.04, t.z);
        // old graves lean a little, each its own way
        o.rotation.set(-0.05 + (i % 2) * 0.09, faceCamera(t.x, t.z) + ((i % 3) - 1) * 0.18, (i % 2 ? 1 : -1) * lean);
        o.scale.setScalar(t.s);
        o.updateMatrix();
        mesh.setMatrixAt(i, o.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    };
    place(tombs.current, L.tombs, 0.07);
    place(crosses.current, L.crosses, 0.12);
    if (candles.current) {
      L.candles.forEach((c, i) => {
        o.position.set(c.x, 0, c.z);
        o.rotation.set(0, 0, 0);
        o.scale.set(1, 0.3 + c.s * 0.35, 1);
        o.updateMatrix();
        candles.current!.setMatrixAt(i, o.matrix);
      });
      candles.current.instanceMatrix.needsUpdate = true;
    }
    if (pools.current) {
      L.pumpkins.forEach((p, i) => {
        o.position.set(p.x, 0.012, p.z + 0.35);
        o.rotation.set(-Math.PI / 2, 0, 0);
        o.scale.setScalar(p.s * 3.6);
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
    const { o, c, acc, box } = tmp;
    const { width: w, height: h } = state.size;
    const zones = hud.current;
    const phone = lite && !portrait && !!zones.view.compact;
    // what the drifting bits fade out under: the HUD, and on a phone the cards and the hand's room too
    const avoid = phone ? zones.keep : zones.rects;

    // the layout clear of the HUD: worked out again only when the HUD, the screen or the base layout changes
    const f = fitted.current;
    if (f.version !== zones.version || f.base !== base || f.w !== w || f.h !== h) {
      f.version = zones.version;
      const keepPrev = f.base === base;
      f.base = base;
      f.w = w;
      f.h = h;
      const cam = restCamera(makeView(w, h));
      const clear = (x: number, y: number, z: number, r: number) => !underHud(ballOnScreen(cam, w, h, x, y, z, r, box), zones.rects, 6);
      // a phone on its side: the graveyard goes wherever this screen has room (see phoneLayout)
      const next = phone ? phoneLayout(base, new Placer(w, h, zones), balls, keepPrev ? L : undefined) : fitToHud(base, halfWidth, sizes, clear);
      const key = JSON.stringify(next);
      if (key !== f.key) {
        f.key = key;
        setL(next);
      }
    }
    const fade = 1 - Math.exp(-dt * 5);
    // eases to the new colour of play (the floor repaints with a wave; the lanterns follow just as softly)
    acc.lerp(c.set(accent), 1 - Math.exp(-dt * 2.5));

    // pumpkins: idle breathing, a shake on hover, a hop with a face flare on click
    L.pumpkins.forEach((p, i) => {
      const hop = now - s.hopAt[i];
      const hopping = hop >= 0 && hop < 0.7;
      const jump = hopping ? Math.sin((hop / 0.7) * Math.PI) * 0.8 * p.s : 0;
      const squash = hopping ? 1 + Math.sin((hop / 0.7) * Math.PI * 2) * 0.12 : 1 + Math.sin(t * 1.3 + i) * 0.015;
      const shake = s.hoverP === i ? Math.sin(t * 28) * 0.09 : 0;
      o.position.set(p.x, 0.46 * p.s * squash + jump, p.z);
      o.rotation.set(0, faceCamera(p.x, p.z) + (hopping ? (hop * Math.PI * 2) / 0.7 : 0), shake);
      o.scale.set(p.s / Math.sqrt(squash), p.s * squash, p.s / Math.sqrt(squash));
      o.updateMatrix();
      pumpkins.current.setMatrixAt(i, o.matrix);
      faces.current.setMatrixAt(i, o.matrix);
      // a candle flickers inside, tinted by the colour of play; brighter on hover, blazing right after a click
      const flare = hopping ? 1 - hop / 0.7 : 0;
      const flick = 0.78 + Math.sin(t * 9 + i * 2) * 0.1 + Math.sin(t * 23 + i * 5) * 0.06 + (s.hoverP === i ? 0.4 : 0);
      c.copy(ORANGE).lerp(acc, 0.35 + flare * 0.5).multiplyScalar(flick + flare * 1.4);
      faces.current.setColorAt(i, c);
      if (pools.current) {
        c.multiplyScalar(0.5);
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
        const k = 1 + Math.sin(t * 13 + i * 3.1) * 0.1 + Math.sin(t * 31 + i) * 0.05 + (s.hoverC === i ? 0.4 : 0) + flare * 1.6;
        o.position.set(cd.x + Math.sin(t * 7 + i) * 0.012, 0.3 + cd.s * 0.35 + 0.15 * k, cd.z);
        o.quaternion.copy(state.camera.quaternion);
        o.scale.set(0.32 * (0.85 + k * 0.15), 0.58 * k, 1);
        o.updateMatrix();
        flames.current!.setMatrixAt(i, o.matrix);
        c.set('#ffffff').lerp(acc, 0.12 + flare * 0.75);
        flames.current!.setColorAt(i, c);
      });
      flames.current.instanceMatrix.needsUpdate = true;
      flames.current.instanceColor!.needsUpdate = true;
    }

    // ghosts: drift and bob over their own graves; hover makes them wobble; click: BOO!, then vanish and come back
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
          boo.current.position.set(g.x, g.y + (1.1 + b * 0.3) * (g.s ?? 1), g.z + 0.4);
          boo.current.scale.set(2 * (0.6 + 0.4 * k), 1 * (0.6 + 0.4 * k), 1);
          booMat.current.opacity = b < 0.9 ? k : 1 - (b - 0.9) / 0.4;
        }
      }
      const hov = s.hoverG === i;
      // a lazy figure-eight around the home spot, always drifting outward rather than over the table
      const gs = g.s ?? 1;
      o.position.set(g.x + Math.sin(t * 0.3 + i * 2) * 0.7 * gs, g.y + Math.sin(t * 1.3 + i) * 0.16 * gs, g.z + Math.sin(t * 0.6 + i) * 0.35 * gs);
      o.rotation.set(0.12, faceCamera(o.position.x, o.position.z) + spin + Math.sin(t * 0.8 + i) * 0.2, hov ? Math.sin(t * 12) * 0.18 : Math.sin(t * 1.1 + i) * 0.08);
      o.scale.setScalar(Math.max(0.0001, sc * gs * (hov ? 1.12 : 1) * (portrait ? GHOST_SCALE.portrait : GHOST_SCALE.landscape)));
      o.updateMatrix();
      ghosts.current.setMatrixAt(i, o.matrix);
    });
    ghosts.current.instanceMatrix.needsUpdate = true;
    boo.current.visible = booOn;
    ghostMat.current.color.copy(tmp.ghostTint.set('#ffffff').lerp(acc, 0.2));

    // bats: two hinged wings per bat, flapping, circling high over the graves; they scatter when startled
    const sct = now - s.scatterAt;
    const scatter = sct >= 0 && sct < 2.2 ? Math.sin((sct / 2.2) * Math.PI) ** 0.6 : 0;
    batSeeds.forEach((b, i) => {
      b.a += b.sp * dt * (1 + scatter * 2.5);
      const px = Math.cos(b.a) * L.batRX + b.dx * scatter * 9;
      const pz = L.batZ + Math.sin(b.a) * L.batRZ + b.dz * scatter * 3;
      const py = b.y + Math.sin(t * 2 + b.ph) * 0.22 + scatter * (1.5 + b.dz * 2);
      const flap = Math.sin(t * (13 + scatter * 10) + b.ph) * 0.9;
      // a bat flying under the HUD fades away until it is out again
      b.vis += ((underHud(ballOnScreen(state.camera as THREE.PerspectiveCamera, w, h, px, py, pz, b.s * 1.1, box), avoid, 2) ? 0 : 1) - b.vis) * fade;
      const bs = b.s * b.vis + 1e-4;
      // face the camera (a bat seen edge-on is just a line), banking toward where it flies
      const bank = -Math.sin(b.a) * 0.45;
      for (let side = 1; side >= -1; side -= 2) {
        o.position.set(px, py, pz);
        o.rotation.set(-0.5, 0, bank);
        o.rotateY(side * flap);
        o.scale.set(side * bs, bs, bs);
        o.updateMatrix();
        bats.current.setMatrixAt(i * 2 + (side > 0 ? 0 : 1), o.matrix);
      }
    });
    bats.current.instanceMatrix.needsUpdate = true;

    // will-o'-wisps: slow bobbing lights in the mist, breathing in and out; most witch-green, some in the colour of play
    const pos = wisp.geo.attributes.position as THREE.BufferAttribute;
    const col = wisp.geo.attributes.color as THREE.BufferAttribute;
    wisp.seeds.forEach((p, i) => {
      const x = p.x + Math.sin(t * p.sp + p.ph) * 0.5;
      const y = p.y + Math.sin(t * p.sp * 2.1 + p.ph) * 0.25;
      const z = p.z + Math.cos(t * p.sp * 0.8 + p.ph) * 0.35;
      pos.setXYZ(i, x, y, z);
      // additive: a wisp under the HUD simply goes dark
      p.vis += ((underHud(ballOnScreen(state.camera as THREE.PerspectiveCamera, w, h, x, y, z, 0.2, box), avoid, 2) ? 0 : 1) - p.vis) * fade;
      const glow = (Math.max(0, Math.sin(t * p.sp * 1.7 + p.ph * 3)) ** 2 * 0.85 + 0.15) * p.vis;
      c.copy(p.hue === 0 ? acc : WITCH).multiplyScalar(glow);
      col.setXYZ(i, c.r, c.g, c.b);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;

    if (light.current) {
      light.current.intensity = 12 + Math.sin(t * 7) * 2 + Math.sin(t * 17.3) * 1.2;
      light.current.color.copy(ORANGE).lerp(acc, 0.4);
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
    <group name="decor">
      <instancedMesh name="pumpkin" ref={pumpkins} args={[res.pumpkin, undefined, L.pumpkins.length]} castShadow={!lite} onPointerOver={over('hoverP')} onPointerOut={out('hoverP')} onClick={clickPumpkin}>
        <meshLambertMaterial vertexColors emissive="#ff4a00" emissiveIntensity={0.16} />
      </instancedMesh>
      <instancedMesh name="pumpkin-face" ref={faces} args={[res.face, undefined, L.pumpkins.length]} instanceColor={colors.faces}>
        <meshBasicMaterial map={res.faceTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </instancedMesh>
      {!lite && (
        <instancedMesh name="pool" ref={pools} args={[undefined, undefined, L.pumpkins.length]} instanceColor={colors.pools} renderOrder={-50}>
          <planeGeometry />
          <meshBasicMaterial map={res.poolTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
        </instancedMesh>
      )}
      <instancedMesh name="tomb" ref={tombs} args={[res.tomb, undefined, L.tombs.length]}>
        <meshLambertMaterial vertexColors emissive="#160f22" />
      </instancedMesh>
      <instancedMesh name="cross" ref={crosses} args={[res.cross, undefined, L.crosses.length]}>
        <meshLambertMaterial vertexColors emissive="#160f22" />
      </instancedMesh>
      {L.candles.length > 0 && (
        <>
          <instancedMesh name="candle" ref={candles} args={[res.candle, undefined, L.candles.length]}>
            <meshLambertMaterial vertexColors emissive="#4a3010" />
          </instancedMesh>
          <instancedMesh name="flame" ref={flames} args={[undefined, undefined, L.candles.length]} instanceColor={colors.flames} onPointerOver={over('hoverC')} onPointerOut={out('hoverC')} onClick={clickCandle}>
            <planeGeometry />
            <meshBasicMaterial map={res.flameTex} transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
          </instancedMesh>
        </>
      )}
      <instancedMesh name="ghost" ref={ghosts} args={[res.ghost, undefined, L.ghosts.length]} onPointerOver={over('hoverG')} onPointerOut={out('hoverG')} onClick={clickGhost}>
        <meshBasicMaterial ref={ghostMat} map={res.ghostTex} transparent opacity={0.86} toneMapped={false} />
      </instancedMesh>
      <sprite ref={boo} visible={false} renderOrder={5}>
        <spriteMaterial ref={booMat} map={res.booTex} transparent depthWrite={false} toneMapped={false} />
      </sprite>
      <instancedMesh name="bat" ref={bats} args={[res.wing, undefined, L.bats * 2]} frustumCulled={false} onClick={clickBats}>
        <meshBasicMaterial map={res.batTex} alphaTest={0.4} side={THREE.DoubleSide} />
      </instancedMesh>
      <points name="wisp" geometry={wisp.geo} frustumCulled={false}>
        <pointsMaterial map={res.dotTex} size={lite ? 0.42 : 0.34} vertexColors transparent blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </points>
      {!lite && <pointLight ref={light} position={portrait ? [0, 2.2, -10] : [0, 2.4, -8.5]} distance={20} decay={1.4} />}
    </group>
  );
}
