import { Billboard } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { avatarOf } from '../../../game/avatars';
import type { Player } from '../../../game/types';
import { useLang } from '../../../i18n/index';
import { fxState, nowSec } from '../../effects/fxState';
import { glowTexture } from '../../cards/glowTexture';
import type { Vec3 } from '../../layout';
import { LABEL_H, LABEL_W, avatarTexture, beamTexture, labelTexture, numberTexture, raysTexture } from './textures';

/*
 * Performance notes. The podium is mounted for the whole round and only shown at the end:
 * its shaders compile with the rest of the table under the loading curtain, so the finale never stalls.
 * It adds no real light either (a new light makes three.js recompile every lit material on screen):
 * the spotlight is a painted cone and a glow on the floor. Labels are textures, not DOM overlays.
 */

const STEPS = [
  { place: 1, h: 1.5, x: 0, color: '#f5c518', trim: '#fff1a8', frame: '#ffd84a', delay: 1.1 },
  { place: 2, h: 1.05, x: -1.45, color: '#c3c8d2', trim: '#f4f6fa', frame: '#e9edf3', delay: 0.65 },
  { place: 3, h: 0.72, x: 1.45, color: '#cd7f32', trim: '#ffcf9a', frame: '#f0a560', delay: 0.25 },
] as const;
type Step = (typeof STEPS)[number];

/* ---------- motion ---------- */

/** Avatar centre above the top of its step: high enough that the frame never dips into the step. */
const AVATAR_LIFT = 1.0;
/** The name plate sits on the front edge of the step top. */
const LABEL_Y = 0.16;
const LABEL_Z = 0.66;
const LABEL_W_3D = 1.6;

const easeOutBack = (x: number) => {
  const c1 = 1.7;
  return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};
const easeOutCubic = (x: number) => 1 - Math.pow(1 - x, 3);
const clamp01 = (x: number) => THREE.MathUtils.clamp(x, 0, 1);

/** Bounce down onto a surface: falls with gravity, then two small hops. */
function drop(t: number) {
  if (t <= 0) return 3;
  if (t < 0.45) return 3 * (1 - (t / 0.45) ** 2);
  const b = t - 0.45;
  if (b < 0.3) return Math.sin((b / 0.3) * Math.PI) * 0.35;
  if (b < 0.48) return Math.sin(((b - 0.3) / 0.18) * Math.PI) * 0.1;
  return 0;
}

/* ---------- components ---------- */

interface Props {
  /** the round is over: rise and show the ranking */
  active: boolean;
  players: Player[];
  winner: number | null;
  teams?: number[] | null;
  at: Vec3;
  scale: number;
}

/**
 * The finale: three steps rise out of the table one after another, the players hop onto them,
 * a crown spins over the winner and a beam of light finds them.
 */
export function Podium({ active, players, winner, teams = null, at, scale }: Props) {
  // winner first, then whoever is left with the fewest cards (in teams the partner stands next to the winner)
  const ranking = useMemo(() => {
    const w = winner ?? 0;
    const rest = players
      .map((p, i) => ({ p, i }))
      .filter(x => x.i !== w)
      .sort((a, b) =>
        (teams ? Number(teams[b.i] === teams[w]) - Number(teams[a.i] === teams[w]) : 0) ||
        // No Mercy: whoever was knocked out ranks below everyone still in, the first out lowest
        (a.p.out ? (b.p.out ? b.p.out - a.p.out : 1) : b.p.out ? -1 : a.p.hand.length - b.p.hand.length));
    return [{ p: players[w], i: w }, ...rest].slice(0, 3);
  }, [players, winner, teams]);

  const root = useRef<THREE.Group>(null!);
  const start = useRef(0);
  const wasActive = useRef(false);
  useFrame(() => {
    if (active && !wasActive.current) start.current = fxState.winAt > 0 ? fxState.winAt : nowSec();
    wasActive.current = active;
    root.current.visible = active;
  });

  return (
    <group ref={root} position={[at[0], 0, at[2] + 0.4]} scale={scale} visible={false}>
      {ranking.map((r, k) => (
        <PodiumStep key={k} step={STEPS[k]} player={r.p} start={start} active={active} />
      ))}
      <Beam start={start} active={active} />
    </group>
  );
}

/** A painted spotlight: a soft cone from above and a pool of light on the floor around the steps. */
function Beam({ start, active }: { start: MutableRefObject<number>; active: boolean }) {
  const cone = useRef<THREE.MeshBasicMaterial>(null!);
  const pool = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(() => {
    if (!active) return;
    const t = nowSec() - start.current;
    // switches on as the winner's step rises, with a slight flicker like a real lamp warming up
    const on = clamp01((t - 0.9) / 0.6);
    const flicker = t < 1.6 ? 0.85 + Math.sin(t * 40) * 0.15 : 1;
    const breathe = 1 + Math.sin(t * 1.4) * 0.06;
    cone.current.opacity = 0.16 * on * flicker * breathe;
    pool.current.opacity = 0.55 * on * flicker;
  });
  return (
    <>
      <mesh position={[0, 4.6, 0]} renderOrder={2}>
        <cylinderGeometry args={[0.25, 2.1, 9, 40, 1, true]} />
        <meshBasicMaterial ref={cone} map={beamTexture()} color="#fff3c8" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} renderOrder={1}>
        <planeGeometry args={[6.2, 4.6]} />
        <meshBasicMaterial ref={pool} map={glowTexture()} color="#fff0c0" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
      </mesh>
    </>
  );
}

function PodiumStep({ step, player, start, active }: { step: Step; player: Player; start: MutableRefObject<number>; active: boolean }) {
  const winner = step.place === 1;
  const block = useRef<THREE.Group>(null!);
  const hero = useRef<THREE.Group>(null!);
  const crown = useRef<THREE.Group>(null!);
  const rays = useRef<THREE.Mesh>(null!);
  const raysMat = useRef<THREE.MeshBasicMaterial>(null!);
  const label = useRef<THREE.Group>(null!);
  const labelMat = useRef<THREE.MeshBasicMaterial>(null!);
  const tex = useMemo(() => avatarTexture(avatarOf(player.avatar, player.name, player.bot)), [player.avatar, player.name, player.bot]);
  const lng = useLang();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the label is drawn in the current language
  const labelTex = useMemo(() => labelTexture(step.place, player.name), [step.place, player.name, lng]);

  useFrame(() => {
    if (!active) return;
    const now = nowSec();
    const t = now - start.current - step.delay;
    const sy = Math.max(0.001, easeOutBack(clamp01(t / 0.7)));
    block.current.scale.set(1, sy, 1);
    // the avatar lands once its step is up; the winner keeps doing happy hops (the name plate stays put)
    const land = t - 0.55;
    let y = step.h + AVATAR_LIFT + drop(land);
    if (winner && land > 1.2) y += Math.abs(Math.sin((land - 1.2) * 3.2)) * 0.18;
    hero.current.position.y = y;
    hero.current.visible = land > 0;
    // squash on landing, a little wobble while settling
    const squash = land > 0.45 && land < 0.7 ? Math.sin(((land - 0.45) / 0.25) * Math.PI) * 0.12 : 0;
    hero.current.scale.set(1 + squash, 1 - squash, 1);
    hero.current.rotation.z = land > 0 && land < 0.5 ? Math.sin(land * 20) * 0.08 : 0;
    // the name plate pops up on the step once they are standing
    const lab = clamp01((land - 0.35) / 0.35);
    labelMat.current.opacity = easeOutCubic(lab);
    label.current.visible = lab > 0;
    label.current.scale.setScalar(0.6 + 0.4 * easeOutBack(lab));
    if (crown.current) {
      crown.current.rotation.y = now * 1.2;
      crown.current.position.y = 0.78 + Math.sin(now * 2.5) * 0.06;
    }
    if (rays.current) {
      rays.current.rotation.z = now * 0.35;
      raysMat.current.opacity = 0.55 * easeOutCubic(clamp01((land - 0.2) / 0.6));
    }
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
          <meshBasicMaterial map={numberTexture(step.place)} transparent toneMapped={false} />
        </mesh>
      </group>
      <group ref={hero} visible={false}>
        <Billboard>
          {winner && (
            <mesh ref={rays} position-z={-0.03}>
              <planeGeometry args={[2.6, 2.6]} />
              <meshBasicMaterial ref={raysMat} map={raysTexture()} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
            </mesh>
          )}
          <mesh position-z={-0.01}>
            <planeGeometry args={[1.1, 1.1]} />
            <meshBasicMaterial color={step.frame} toneMapped={false} />
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
      </group>
      {/* drawn over everything (no depth test), so the step it stands on can never cut through it */}
      <group ref={label} position={[0, step.h + LABEL_Y, LABEL_Z]} visible={false}>
        <Billboard>
          <mesh renderOrder={20}>
            <planeGeometry args={[LABEL_W_3D, LABEL_W_3D * (LABEL_H / LABEL_W)]} />
            <meshBasicMaterial ref={labelMat} map={labelTex} transparent opacity={0} depthTest={false} depthWrite={false} toneMapped={false} />
          </mesh>
        </Billboard>
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
