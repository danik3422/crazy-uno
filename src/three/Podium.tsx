import { Billboard, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { avatarOf, robotDataUrl, type Avatar } from '../game/avatars';
import type { Player } from '../game/types';
import { fxState, nowSec } from './fxState';
import type { Vec3 } from './layout';
import { drawEmoji } from './textures';

const avatarCache = new Map<string, THREE.CanvasTexture>();

/** An avatar painted onto a canvas: gradient tile with the emoji, or the robot portrait once its SVG loads. */
function avatarTexture(a: Avatar): THREE.CanvasTexture {
  const hit = avatarCache.get(a.id);
  if (hit) return hit;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const bg = ctx.createLinearGradient(0, 0, S, S);
  bg.addColorStop(0, a.bg[0]);
  bg.addColorStop(1, a.bg[1]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (a.robot) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, S, S);
      tex.needsUpdate = true;
    };
    img.src = robotDataUrl(a.robot);
  } else {
    drawEmoji(ctx, a.emoji ?? '?', S / 2, S / 2 + 6, 170);
  }
  avatarCache.set(a.id, tex);
  return tex;
}

function numberTexture(n: number, color: string) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const ctx = cv.getContext('2d')!;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '900 190px "Unbounded", "Arial Black", sans-serif';
  ctx.lineWidth = 16;
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.strokeText(String(n), 128, 140);
  ctx.fillStyle = color;
  ctx.fillText(String(n), 128, 136);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const STEPS = [
  { place: 1, h: 1.5, x: 0, color: '#f5c518', trim: '#fff1a8', delay: 1.1 },
  { place: 2, h: 1.05, x: -1.45, color: '#c3c8d2', trim: '#f4f6fa', delay: 0.65 },
  { place: 3, h: 0.72, x: 1.45, color: '#cd7f32', trim: '#ffcf9a', delay: 0.25 },
];

const easeOutBack = (x: number) => {
  const c1 = 1.7;
  return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

/** Bounce down onto a surface: falls with gravity, then two small hops. */
function drop(t: number) {
  if (t <= 0) return 3;
  if (t < 0.45) return 3 * (1 - (t / 0.45) ** 2);
  const b = t - 0.45;
  if (b < 0.3) return Math.sin((b / 0.3) * Math.PI) * 0.35;
  if (b < 0.48) return Math.sin(((b - 0.3) / 0.18) * Math.PI) * 0.1;
  return 0;
}

interface Props {
  players: Player[];
  winner: number;
  teams?: number[] | null;
  at: Vec3;
  scale: number;
}

/**
 * The finale: three steps rise out of the table one after another, the players hop onto them,
 * a crown spins over the winner and a spotlight finds them.
 */
export function Podium({ players, winner, teams = null, at, scale }: Props) {
  // winner first, then whoever is left with the fewest cards
  const ranking = useMemo(() => {
    // in teams the partner stands next to the winner
    const rest = players
      .map((p, i) => ({ p, i }))
      .filter(x => x.i !== winner)
      .sort((a, b) => (teams ? Number(teams[b.i] === teams[winner]) - Number(teams[a.i] === teams[winner]) : 0) || a.p.hand.length - b.p.hand.length);
    return [{ p: players[winner], i: winner }, ...rest].slice(0, 3);
  }, [players, winner, teams]);
  const start = useRef(fxState.winAt > 0 ? fxState.winAt : nowSec());
  // the spotlight aims at an object that has to live in the scene graph
  const aim = useMemo(() => new THREE.Object3D(), []);

  return (
    <group position={[at[0], 0, at[2] + 0.4]} scale={scale}>
      {ranking.map((r, k) => (
        <Step key={r.i} step={STEPS[k]} player={r.p} start={start.current} winner={k === 0} />
      ))}
      <primitive object={aim} position={[0, 1.5, 0]} />
      <spotLight position={[0, 9, 3]} angle={0.32} penumbra={0.6} intensity={60} distance={20} color="#fff6d8" target={aim} />
    </group>
  );
}

function Step({ step, player, start, winner }: { step: (typeof STEPS)[number]; player: Player; start: number; winner: boolean }) {
  const block = useRef<THREE.Group>(null!);
  const hero = useRef<THREE.Group>(null!);
  const crown = useRef<THREE.Group>(null!);
  const label = useRef<HTMLDivElement>(null!);
  const avatar = useMemo(() => avatarOf(player.avatar, player.name, player.bot), [player]);
  const tex = useMemo(() => avatarTexture(avatar), [avatar]);
  const num = useMemo(() => numberTexture(step.place, '#ffffff'), [step.place]);

  useFrame(() => {
    const t = nowSec() - start - step.delay;
    const rise = THREE.MathUtils.clamp(t / 0.7, 0, 1);
    const sy = Math.max(0.001, easeOutBack(rise));
    block.current.scale.set(1, sy, 1);
    // the avatar lands once its step is up; the winner keeps doing happy hops
    const land = t - 0.55;
    let y = step.h + 0.62 + drop(land);
    if (winner && land > 1.2) y += Math.abs(Math.sin((land - 1.2) * 3.2)) * 0.28;
    hero.current.position.y = y;
    hero.current.visible = land > 0;
    hero.current.rotation.z = land > 0 && land < 0.5 ? Math.sin(land * 20) * 0.08 : 0;
    if (crown.current) {
      crown.current.rotation.y += 0.02;
      crown.current.position.y = 0.78 + Math.sin(nowSec() * 2.5) * 0.06;
    }
    if (label.current) label.current.style.opacity = land > 0.4 ? '1' : '0';
  });

  return (
    <group position-x={step.x}>
      <group ref={block}>
        <mesh position-y={step.h / 2} castShadow receiveShadow>
          <boxGeometry args={[1.35, step.h, 1.2]} />
          <meshStandardMaterial color={step.color} metalness={0.55} roughness={0.28} />
        </mesh>
        <mesh position-y={step.h + 0.03}>
          <boxGeometry args={[1.42, 0.06, 1.27]} />
          <meshStandardMaterial color={step.trim} metalness={0.4} roughness={0.2} />
        </mesh>
        <mesh position={[0, Math.min(step.h * 0.42, step.h - 0.42), 0.605]}>
          <planeGeometry args={[0.62, 0.62]} />
          <meshBasicMaterial map={num} transparent toneMapped={false} />
        </mesh>
      </group>
      <group ref={hero} visible={false}>
        <Billboard>
          <mesh position-z={-0.01}>
            <planeGeometry args={[1.08, 1.08]} />
            <meshBasicMaterial color={winner ? '#ffd84a' : '#ffffff'} toneMapped={false} />
          </mesh>
          <mesh>
            <planeGeometry args={[0.95, 0.95]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
          {winner && (
            <group ref={crown}>
              <Crown />
            </group>
          )}
        </Billboard>
        <Html position={[0, -0.75, 0.62]} center zIndexRange={[25, 0]} pointerEvents="none">
          <div ref={label} className={`podium-label p${step.place}`} style={{ opacity: 0 }}>
            <span className="podium-place">{step.place === 1 ? '🏆 Победитель' : `${step.place} место`}</span>
            <span className="podium-name">{player.name}</span>
          </div>
        </Html>
      </group>
    </group>
  );
}

/** A little gold crown with five points and gems. */
function Crown() {
  const pts = [0, 1, 2, 3, 4];
  return (
    <group scale={0.55}>
      <mesh>
        <cylinderGeometry args={[0.55, 0.5, 0.35, 32, 1, true]} />
        <meshStandardMaterial color="#ffd23a" metalness={0.9} roughness={0.2} side={THREE.DoubleSide} emissive="#a86a00" emissiveIntensity={0.3} />
      </mesh>
      {pts.map(i => {
        const a = (i / pts.length) * Math.PI * 2;
        return (
          <group key={i} position={[Math.cos(a) * 0.52, 0.32, Math.sin(a) * 0.52]}>
            <mesh>
              <coneGeometry args={[0.12, 0.34, 4]} />
              <meshStandardMaterial color="#ffd23a" metalness={0.9} roughness={0.2} emissive="#a86a00" emissiveIntensity={0.3} />
            </mesh>
            <mesh position-y={0.2}>
              <sphereGeometry args={[0.06, 12, 8]} />
              <meshStandardMaterial color={i % 2 ? '#ff3a5a' : '#3ad0ff'} emissive={i % 2 ? '#ff3a5a' : '#3ad0ff'} emissiveIntensity={0.8} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
