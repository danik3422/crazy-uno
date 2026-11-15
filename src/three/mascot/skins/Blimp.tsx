import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type RefObject } from 'react';
import * as THREE from 'three';
import type { MascotPose } from './index';

const PI = Math.PI;
const BLUE = '#2f6bd8';
const YELLOW = '#f5c518';
const DISPLAY = '"Unbounded", "Arial Black", system-ui, sans-serif';
const BANNER_LINES = ['НЕ ВСІ МОЖУТЬ', 'ДИВИТИСЯ В ЗАВТРА'];
const NAME = '«ЗАВТРА»';

/** the envelope: an ellipsoid with these half-sizes, centred at y = ENV_Y */
const RX = 0.62;
const RY = 0.56;
const RZ = 1.15;
const ENV_Y = 0.16;
/** the banner: this long and tall, starting this far behind the origin */
const BAN_W = 1.6;
const BAN_H = 0.42;
const BAN_Z = -1.78;
const SEG = 24;
/** the tow line starts here, under the bottom fin */
const TOW_Z = -1.0;
/** folded away (pose.furl = 1), the line and the banner keep this much of their length */
const FURLED = 0.3;

function canvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  const paint = () => {
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, w, h);
    draw(c);
  };
  paint();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { tex, paint };
}

/** Writes `text` centred at (x, y), shrunk to fit `maxW`. */
function fitText(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxW: number) {
  let s = size;
  c.font = `900 ${s}px ${DISPLAY}`;
  while (s > 10 && c.measureText(text).width > maxW) c.font = `900 ${--s}px ${DISPLAY}`;
  c.strokeText(text, x, y);
  c.fillText(text, x, y);
}

function drawBanner(c: CanvasRenderingContext2D) {
  const W = 1024;
  const H = 256;
  c.fillStyle = '#fffdf6';
  c.fillRect(0, 0, W, H);
  // a blue hem along the top, a yellow one along the bottom
  c.fillStyle = BLUE;
  c.fillRect(0, 0, W, 18);
  c.fillStyle = YELLOW;
  c.fillRect(0, H - 18, W, 18);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = 6;
  c.strokeStyle = '#fffdf6';
  c.fillStyle = '#1b2f6b';
  fitText(c, BANNER_LINES[0], W / 2, 82, 84, W - 60);
  fitText(c, BANNER_LINES[1], W / 2, 174, 84, W - 60);
}

function drawName(c: CanvasRenderingContext2D) {
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.lineJoin = 'round';
  c.lineWidth = 14;
  c.strokeStyle = '#173e8c';
  c.fillStyle = YELLOW;
  fitText(c, NAME, 256, 66, 92, 490);
}

/** A strip laid onto the envelope's side (side +1 or -1), so the name sits on the skin rather than floating. */
function nameGeometry(side: 1 | -1) {
  const g = new THREE.PlaneGeometry(1.1, 0.28, 16, 3);
  g.rotateY((side * PI) / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i) + 0.4;
    const z = p.getZ(i) + 0.1;
    const k = 1 - ((y - ENV_Y) / RY) ** 2 - (z / RZ) ** 2;
    p.setXYZ(i, side * (RX * Math.sqrt(Math.max(0, k)) + 0.006), y, z);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * The airship "Tomorrow": a fat blue-and-yellow cartoon blimp with fins, a gondola and a rear propeller (the
 * spinning `prop`), towing a fluttering banner with the famous line about looking into tomorrow.
 */
export function Blimp({ prop, pose }: { prop: RefObject<THREE.Group>; pose?: MascotPose }) {
  const tow = useRef<THREE.Group>(null!);
  const res = useMemo(() => {
    const banner = canvasTexture(1024, 256, drawBanner);
    // the far side of the banner reads the right way round too
    const bannerBack = banner.tex.clone();
    bannerBack.repeat.x = -1;
    bannerBack.offset.x = 1;
    const name = canvasTexture(512, 128, drawName);
    const cloth = new THREE.PlaneGeometry(BAN_W, BAN_H, SEG, 2);
    cloth.rotateY(PI / 2); // lies along -z, faces +x
    cloth.translate(0, 0, -BAN_W / 2);
    const base = Float32Array.from(cloth.attributes.position.array);
    return { banner, bannerBack, name, cloth, base, nameL: nameGeometry(-1), nameR: nameGeometry(1) };
  }, []);
  useEffect(() => {
    let live = true;
    // the display font may still be on its way: repaint once it is here
    void document.fonts?.load(`900 40px "Unbounded"`, BANNER_LINES.join('') + NAME).then(() => {
      if (!live) return;
      res.banner.paint();
      res.name.paint();
      res.banner.tex.needsUpdate = true;
      res.bannerBack.needsUpdate = true;
      res.name.tex.needsUpdate = true;
    });
    return () => {
      live = false;
      for (const x of [res.banner.tex, res.bannerBack, res.name.tex, res.cloth, res.nameL, res.nameR]) x.dispose();
    };
  }, [res]);

  useFrame(st => {
    if (pose && !pose.active) return;
    // low over the table or over the hand, the banner is reeled in and bunches up into folds (and lets the cards show)
    const furl = pose?.furl ?? 0;
    tow.current.scale.z = 1 - (1 - FURLED) * furl;
    const t = st.clock.elapsedTime;
    const p = res.cloth.attributes.position as THREE.BufferAttribute;
    const nrm = res.cloth.attributes.normal as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    const n = nrm.array as Float32Array;
    const b = res.base;
    const k = 9 + 14 * furl;
    const amp = 1 + 1.2 * furl;
    for (let i = 0; i < p.count; i++) {
      const d = -b[i * 3 + 2] / BAN_W; // 0 at the leading edge, 1 at the tail
      const w = d * k - t * 10;
      const h = (0.02 + d * 0.11) * amp;
      a[i * 3] = Math.sin(w) * h;
      a[i * 3 + 1] = b[i * 3 + 1] + Math.sin(d * 6 - t * 7) * d * 0.05;
      // the normal of the wave x(z), worked out directly (computeVertexNormals would allocate every frame)
      const slope = -(Math.cos(w) * k * h + Math.sin(w) * 0.11 * amp) / BAN_W;
      const len = Math.hypot(1, slope);
      n[i * 3] = 1 / len;
      n[i * 3 + 1] = 0;
      n[i * 3 + 2] = -slope / len;
    }
    p.needsUpdate = true;
    nrm.needsUpdate = true;
  });

  return (
    <group>
      {/* the envelope: blue on top, yellow underneath, a red nose cap */}
      <group position-y={ENV_Y} scale={[RX, RY, RZ]}>
        <mesh castShadow>
          <sphereGeometry args={[1, 32, 12, 0, PI * 2, 0, PI / 2]} />
          <meshStandardMaterial color={BLUE} roughness={0.45} />
        </mesh>
        <mesh>
          <sphereGeometry args={[1, 32, 12, 0, PI * 2, PI / 2, PI / 2]} />
          <meshStandardMaterial color={YELLOW} roughness={0.45} />
        </mesh>
        <mesh rotation-x={PI / 2}>
          <torusGeometry args={[1, 0.025, 6, 40]} />
          <meshStandardMaterial color="#f4f1ea" roughness={0.5} />
        </mesh>
      </group>
      <mesh position={[0, ENV_Y, RZ - 0.04]} scale={[1, 1, 0.6]}>
        <sphereGeometry args={[0.14, 14, 10]} />
        <meshStandardMaterial color="#e5413a" roughness={0.4} />
      </mesh>
      {[res.nameL, res.nameR].map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial map={res.name.tex} transparent roughness={0.5} depthWrite={false} />
        </mesh>
      ))}

      {/* four fins at the tail */}
      {[0, 1, 2, 3].map(k => (
        <group key={k} position={[0, ENV_Y, -0.86]} rotation-z={(k * PI) / 2}>
          <mesh position={[0, 0.5, -0.06]} rotation-x={-0.35} castShadow>
            <boxGeometry args={[0.05, 0.42, 0.42]} />
            <meshStandardMaterial color={k % 2 ? YELLOW : BLUE} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* the gondola on two struts, with a strip of windows */}
      <mesh position={[0, -0.47, 0.5]} rotation-x={PI / 2} castShadow>
        <capsuleGeometry args={[0.12, 0.36, 6, 14]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.5} />
      </mesh>
      <mesh position={[0, -0.45, 0.5]}>
        <boxGeometry args={[0.25, 0.07, 0.38]} />
        <meshStandardMaterial color="#8fe3ff" emissive="#2fa8e0" emissiveIntensity={0.4} metalness={0.3} roughness={0.15} />
      </mesh>
      {[0.36, 0.64].map(z => (
        <mesh key={z} position={[0, -0.35, z]}>
          <cylinderGeometry args={[0.018, 0.018, 0.16, 6]} />
          <meshStandardMaterial color="#555b66" metalness={0.6} />
        </mesh>
      ))}

      {/* the rear propeller */}
      <mesh position={[0, ENV_Y, -1.2]} rotation-x={-PI / 2}>
        <coneGeometry args={[0.08, 0.18, 14]} />
        <meshStandardMaterial color="#d8dbe2" metalness={0.8} roughness={0.2} />
      </mesh>
      <group ref={prop} position={[0, ENV_Y, -1.24]}>
        <mesh>
          <boxGeometry args={[0.08, 0.72, 0.03]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
        <mesh rotation-z={PI / 2}>
          <boxGeometry args={[0.08, 0.72, 0.03]} />
          <meshStandardMaterial color="#2a2a2a" />
        </mesh>
      </group>

      {/* the tow line from the bottom fin, the banner pole, and the banner itself */}
      <group ref={tow} position-z={TOW_Z}>
        <mesh position={[0, -0.39, (BAN_Z - TOW_Z) / 2]} rotation-x={PI / 2}>
          <cylinderGeometry args={[0.008, 0.008, TOW_Z - BAN_Z, 4]} />
          <meshStandardMaterial color="#3a3f48" />
        </mesh>
        {/* leaning over a little, so the words show from the high camera over the table too */}
        <group position={[0, -0.38, BAN_Z - TOW_Z]} rotation-z={-0.5}>
          <mesh>
            <cylinderGeometry args={[0.018, 0.018, BAN_H + 0.08, 6]} />
            <meshStandardMaterial color="#7a5232" roughness={0.8} />
          </mesh>
          <mesh geometry={res.cloth}>
            <meshStandardMaterial map={res.banner.tex} roughness={0.8} side={THREE.FrontSide} />
          </mesh>
          <mesh geometry={res.cloth}>
            <meshStandardMaterial map={res.bannerBack} roughness={0.8} side={THREE.BackSide} />
          </mesh>
        </group>
      </group>
    </group>
  );
}
