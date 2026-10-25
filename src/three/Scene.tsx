import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GameView } from '../game/view';
import { standIn } from '../game/avatars';
import { TEAM_NAMES } from '../game/content';
import { AvatarImg } from '../ui/AvatarImg';
import { IconStack } from '../ui/Icons';
import { TurnRing } from '../ui/TurnRing';
import { Card3D } from './Card3D';
import { DeckStack } from './DeckStack';
import { drag } from './drag';
import { Arena, PALETTES } from './Environment';
import { BombDrop, GoldBurst, Lightning, Meteor } from './EventFx';
import { fxState, nowSec } from './fxState';
import { arena, computeTargets, seatAngle, type View } from './layout';
import { Mascot } from './Mascot';
import { PlayFx } from './PlayFx';
import { Podium } from './Podium';

interface Props {
  game: GameView;
  version: number;
  onCard: (id: number) => void;
  onDeck: () => void;
  canDraw: boolean;
  /** the table has been drawn a few times (textures uploaded, shaders compiled) */
  onReady?: () => void;
  /** the table is still loading or the cards are being dealt: no turn clock yet */
  dealing?: boolean;
}

export function GameScene({ game, version, onCard, onDeck, canDraw, onReady, dealing = false }: Props) {
  const size = useThree(s => s.size);
  const portrait = size.width / size.height < 0.9;
  const view: View = useMemo(() => ({ portrait }), [portrait]);
  const targets = useMemo(() => computeTargets(game, view), [game, version, view]);
  const s = game.s;
  const A = arena(view);
  const cards = [...s.deck, ...s.discard, ...s.players.flatMap(p => p.hand)];
  const top = s.discard[s.discard.length - 1];
  const theme = s.theme ?? 'classic';

  return (
    <>
      <CameraRig portrait={portrait} finale={s.phase === 'over'} focus={A.discard} />
      <ReadySignal onReady={onReady} />
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[2, 11, 7]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0004}
      />
      <hemisphereLight args={['#fff4dc', PALETTES[theme][s.color].outer, 0.5]} />
      <Arena color={s.color} theme={theme} view={view} center={[A.discard[0], A.discard[2]]} />
      <DirectionArrows dir={s.dir} at={A.discard} />
      <TurnMarker game={game} view={view} version={version} />
      {cards.map(c => {
        const t = targets.get(c.id);
        return t ? <Card3D key={c.id} card={c} t={t} theme={theme} onPick={onCard} /> : null;
      })}
      <DeckStack at={A.deck} theme={theme} />
      <DeckHit active={canDraw} onClick={onDeck} pending={s.pending} at={A.deck} />
      {/* during the finale the podium shows everyone, so the seat plates step aside */}
      {s.phase !== 'over' && <PlayerPlates game={game} view={view} dealing={dealing} />}
      {top && <PlayFx top={top} at={A.discard} />}
      <DropZone at={A.discard} radius={portrait ? 2.2 : 2.6} />
      {s.bombDeadline !== null && s.timerKind === 'bomb' && <Bomb deadline={s.bombDeadline} offset={game.clockOffset} />}
      <Explosion />
      <Meteor game={game} view={view} />
      <Lightning game={game} view={view} />
      <GoldBurst game={game} view={view} />
      <BombDrop />
      <Mascot scale={portrait ? 0.6 : 0.72} portrait={portrait} />
      {s.phase === 'over' && <Confetti />}
      {s.phase === 'over' && s.winner !== null && (
        <Podium players={s.players} winner={s.winner} teams={s.teams} at={A.discard} scale={portrait ? 0.8 : 1} />
      )}
    </>
  );
}

const finePointer = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

function CameraRig({ portrait, finale, focus }: { portrait: boolean; finale: boolean; focus: [number, number, number] }) {
  const { camera } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const roll = useRef(0);
  useFrame((state, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    // finale: come down closer and look at the podium
    const base = finale ? (portrait ? [focus[0], 6.2, 11.8] : [focus[0], 4.6, 8.6]) : portrait ? [0, 15, 10.6] : [0, 7.6, 9.8];
    const fov = portrait ? 50 : 42;
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
      cam.updateProjectionMatrix();
    }
    const now = nowSec();
    let sx = 0;
    let sy = 0;
    if (now < fxState.shakeUntil) {
      const a = fxState.shakeAmp * ((fxState.shakeUntil - now) / 0.5);
      sx = (Math.random() - 0.5) * a;
      sy = (Math.random() - 0.5) * a;
    }
    // a gentle sway around the podium, otherwise a light parallax that follows the pointer
    const orbit = finale ? Math.sin((now - fxState.winAt) * 0.35) * 0.25 : 0;
    // parallax only with a mouse: on touch screens the pointer jumps to every tap and the whole table would twitch
    const px = finePointer ? state.pointer.x * 0.35 : 0;
    const py = finePointer ? state.pointer.y * 0.2 : 0;
    const tx = base[0] + px + Math.sin(orbit) * base[2] + sx;
    const tz = base[2] * Math.cos(orbit);
    cam.position.x += (tx - cam.position.x) * Math.min(1, dt * 3);
    cam.position.y += (base[1] + py + sy - cam.position.y) * Math.min(1, dt * 3);
    cam.position.z += (tz - cam.position.z) * Math.min(1, dt * 3);
    // on phones the results sheet takes the lower half, so aim low and lift the podium up the screen
    if (finale) look.lerp(new THREE.Vector3(focus[0], portrait ? -1.2 : 0.75, focus[2]), Math.min(1, dt * 2.5));
    else look.lerp(new THREE.Vector3(0, 0, portrait ? 1.4 : 0.55), Math.min(1, dt * 4));
    cam.lookAt(look);
    // "upside down" event: roll the whole view over
    roll.current += ((now < fxState.upsideUntil ? Math.PI : 0) - roll.current) * Math.min(1, dt * 2.2);
    if (Math.abs(roll.current) > 0.001) cam.rotateZ(roll.current);
  });
  return null;
}

/** Two big glowing arrows sweeping around the pile in the direction of play. */
function DirectionArrows({ dir, at }: { dir: 1 | -1; at: [number, number, number] }) {
  const spin = useRef<THREE.Group>(null!);
  const R = 2.75;
  const ARC = 1.9;
  const speed = useRef(0);
  useFrame((_, dt) => {
    const racing = nowSec() < fxState.carouselUntil;
    speed.current += (dir * (racing ? 7 : 0.45) - speed.current) * Math.min(1, dt * (racing ? 6 : 2));
    spin.current.rotation.y -= speed.current * dt;
  });
  const arrow = (k: number) => (
    <group key={k} rotation-z={k * Math.PI}>
      <mesh>
        <torusGeometry args={[R, 0.07, 8, 64, ARC]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.5} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[Math.cos(ARC) * R, Math.sin(ARC) * R, 0]} rotation-z={ARC}>
        <coneGeometry args={[0.24, 0.55, 3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.7} toneMapped={false} depthWrite={false} />
      </mesh>
    </group>
  );
  return (
    <group position={[at[0], 0.035, at[2]]} scale={[1, 1, 0.69]}>
      <group ref={spin}>
        {/* torus lies in XY; +90° about X maps its angles onto the seat angles (x = cos a, z = sin a) */}
        <group rotation-x={Math.PI / 2} scale={[1, dir, 1]}>
          {arrow(0)}
          {arrow(1)}
        </group>
      </group>
    </group>
  );
}

let glowTex: THREE.CanvasTexture | null = null;
/** A soft round glow that fades to nothing at the edge (no hard ellipse on the floor). */
function softGlow() {
  if (glowTex) return glowTex;
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,240,190,0.9)');
  g.addColorStop(0.45, 'rgba(255,220,140,0.35)');
  g.addColorStop(1, 'rgba(255,200,100,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  glowTex = new THREE.CanvasTexture(cv);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Whose turn it is: a soft pool of light under them and a thin ring of light dashes going round. */
function TurnMarker({ game, view, version }: { game: GameView; view: View; version: number }) {
  const ref = useRef<THREE.Group>(null!);
  const glow = useRef<THREE.MeshBasicMaterial>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const s = game.s;
  const seat = game.seat();
  const target = useMemo(() => {
    const A = arena(view);
    if (s.cur === seat) return new THREE.Vector3(0, 0.012, A.hand.z - 0.9);
    const a = seatAngle(game, s.cur);
    return new THREE.Vector3(Math.cos(a) * A.rx * 0.95, 0.012, Math.sin(a) * A.rz);
  }, [version, view]);
  const mine = s.cur === seat;
  useFrame((st, dt) => {
    ref.current.position.lerp(target, 1 - Math.exp(-dt * 6));
    const k = 1 - Math.exp(-dt * 8);
    const show = s.phase === 'over' ? 0 : 1;
    const breathe = 0.5 + Math.sin(st.clock.elapsedTime * 2.4) * 0.5;
    glow.current.opacity += ((mine ? 0.42 : 0.55) * show * (0.75 + breathe * 0.25) - glow.current.opacity) * k;
    ringMat.current.opacity += (0.5 * show - ringMat.current.opacity) * k;
    ring.current.rotation.z -= dt * 0.6;
    const sc = mine ? 1.35 : 1;
    ref.current.scale.x += (sc * 1.7 - ref.current.scale.x) * k;
    ref.current.scale.z += (sc - ref.current.scale.z) * k;
  });
  return (
    <group ref={ref} scale={[1.7, 1, 1]}>
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[3, 3]} />
        <meshBasicMaterial ref={glow} map={softGlow()} transparent opacity={0} depthWrite={false} toneMapped={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position-y={0.002}>
        <ringGeometry args={[1.02, 1.07, 64, 1, 0, Math.PI * 1.6]} />
        <meshBasicMaterial ref={ringMat} color="#fff6d0" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

function DeckHit({ active, onClick, pending, at }: { active: boolean; onClick: () => void; pending: number; at: [number, number, number] }) {
  const ring = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(st => {
    ring.current.opacity = active ? 0.55 + Math.sin(st.clock.elapsedTime * 5) * 0.3 : 0;
  });
  return (
    <group position={at}>
      <mesh
        position-y={0.4}
        visible={false}
        onClick={e => { if (!active) return; e.stopPropagation(); onClick(); }}
        onPointerOver={() => { if (active) document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = ''; }}
      >
        <boxGeometry args={[1.5, 1, 1.9]} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.008}>
        <ringGeometry args={[1.0, 1.18, 48]} />
        <meshBasicMaterial ref={ring} color={pending ? '#ff6b5e' : '#ffffff'} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Avatar plates above each opponent's fan: name ribbon, portrait, card counter. */
function PlayerPlates({ game, view, dealing }: { game: GameView; view: View; dealing: boolean }) {
  const s = game.s;
  const seat = game.seat();
  const A = arena(view);
  return (
    <>
      {s.players.map((p, i) => {
        if (i === seat) return null;
        const a = seatAngle(game, i);
        // side seats: pull the plate in toward the middle, so it stays on screen with its fan
        const side = Math.abs(Math.cos(a));
        const pos: [number, number, number] = [Math.cos(a) * A.rx * (1.02 - side * 0.3), view.portrait ? 2.1 : 2.25, Math.sin(a) * A.rz * 1.02 - 0.2];
        const cur = i === s.cur && s.phase !== 'over';
        const sub = standIn(p.name);
        return (
          <Html key={i} position={pos} center zIndexRange={[20, 0]} pointerEvents="none">
            <div className={`oplate ${cur ? 'cur' : ''} ${i === s.winner ? 'win' : ''} ${p.offline ? 'off' : ''} ${s.teams ? `team t${s.teams[i]}` : ''} ${view.portrait ? 'small' : ''} ${view.portrait && s.players.length > 3 ? 'tiny' : ''}`} title={p.name}>
              {s.teams && (
                <span className="oplate-team">{s.teams[i] === s.teams[game.seat()] ? '🤝 напарник' : TEAM_NAMES[s.teams[i]]}</span>
              )}
              <span className="ava-wrap swap-in" key={p.offline ? 'bot' : 'me'}>
                {/* someone dropped out: a bot sits in under its own name and face until they are back */}
                <AvatarImg id={p.offline ? sub.avatar : p.avatar} name={p.offline ? sub.name : p.name} bot={p.bot} size={view.portrait ? 40 : 54} className="oplate-ava" />
                {cur && !dealing && s.turnDeadline !== null && (
                  <TurnRing key={s.turn} deadline={s.turnDeadline} total={s.turnTotal} offset={game.clockOffset} />
                )}
              </span>
              <span className="oplate-info">
                <span className="plate-name" key={p.offline ? 'bot' : 'me'}>{p.offline ? sub.name : p.name}</span>
                {p.offline ? (
                  <span className="oplate-away">за {p.name} · нет связи</span>
                ) : (
                  <span className="oplate-count" aria-label={`${p.hand.length} карт`}><IconStack />{p.hand.length}</span>
                )}
              </span>
              {p.hand.length === 1 && s.phase !== 'over' && <span className="plate-uno">UNO!</span>}
            </div>
          </Html>
        );
      })}
    </>
  );
}

function Bomb({ deadline, offset }: { deadline: number; offset: number }) {
  const g = useRef<THREE.Group>(null!);
  const spark = useRef<THREE.Mesh>(null!);
  const light = useRef<THREE.PointLight>(null!);
  useFrame(st => {
    const t = st.clock.elapsedTime;
    const left = Math.max(0, (deadline - Date.now() - offset) / 1000);
    const panic = left < 3 ? 3 : 1;
    g.current.position.y = 1.4 + Math.sin(t * 3 * panic) * 0.12;
    g.current.rotation.z = Math.sin(t * 8 * panic) * 0.08 * panic;
    const f = 0.7 + Math.random() * 0.6;
    spark.current.scale.setScalar(f);
    light.current.intensity = 6 * f;
  });
  return (
    <group ref={g} position={[0, 1.4, 2.2]}>
      <mesh castShadow>
        <sphereGeometry args={[0.42, 32, 24]} />
        <meshStandardMaterial color="#1b1b20" roughness={0.3} metalness={0.4} />
      </mesh>
      <mesh position={[0.22, 0.36, 0]} rotation-z={-0.6}>
        <cylinderGeometry args={[0.1, 0.12, 0.16, 16]} />
        <meshStandardMaterial color="#555" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0.36, 0.52, 0]} rotation-z={-0.8}>
        <cylinderGeometry args={[0.025, 0.025, 0.28, 8]} />
        <meshStandardMaterial color="#c9a46a" />
      </mesh>
      <mesh ref={spark} position={[0.47, 0.63, 0]}>
        <sphereGeometry args={[0.07, 12, 8]} />
        <meshBasicMaterial color="#ffcf4a" toneMapped={false} />
      </mesh>
      <pointLight ref={light} position={[0.47, 0.63, 0.1]} color="#ff9a3c" distance={4} />
    </group>
  );
}

function Explosion() {
  const m = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const light = useRef<THREE.PointLight>(null!);
  useFrame(() => {
    const t = nowSec() - fxState.boomAt;
    const on = t >= 0 && t < 0.7;
    m.current.visible = on;
    light.current.intensity = on ? 60 * (1 - t / 0.7) : 0;
    if (on) {
      m.current.scale.setScalar(0.3 + t * 9);
      mat.current.opacity = 1 - t / 0.7;
    }
  });
  return (
    <group position={[0, 1.4, 2.2]}>
      <mesh ref={m}>
        <sphereGeometry args={[0.5, 24, 16]} />
        <meshBasicMaterial ref={mat} color="#ff8a2a" transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <pointLight ref={light} color="#ff7a2a" distance={14} />
    </group>
  );
}

function Confetti() {
  const N = 320;
  const ref = useRef<THREE.InstancedMesh>(null!);
  const parts = useMemo(
    () =>
      Array.from({ length: N }, () => ({
        p: new THREE.Vector3((Math.random() - 0.5) * 12, 6 + Math.random() * 8, (Math.random() - 0.5) * 8),
        v: 1.2 + Math.random() * 1.8,
        r: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: (Math.random() - 0.5) * 8,
      })),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useLayoutEffect(() => {
    const cols = ['#e5413a', '#f2bf16', '#26a556', '#2c79dc', '#ffd04a', '#fffdf6'];
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) ref.current.setColorAt(i, c.set(cols[i % cols.length]));
    ref.current.instanceColor!.needsUpdate = true;
  }, []);
  useFrame((_, dt) => {
    parts.forEach((q, i) => {
      q.p.y -= q.v * dt;
      q.p.x += Math.sin(q.p.y + i) * dt * 0.4;
      if (q.p.y < 0.05) q.p.y = 0.05;
      else {
        q.r.x += q.w * dt;
        q.r.y += q.w * dt * 0.7;
      }
      dummy.position.copy(q.p);
      dummy.rotation.copy(q.r);
      dummy.updateMatrix();
      ref.current.setMatrixAt(i, dummy.matrix);
    });
    ref.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <planeGeometry args={[0.12, 0.2]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  );
}

/** While a card is being dragged: a glowing ring on the pile that brightens when the card is over it. */
function DropZone({ at, radius }: { at: [number, number, number]; radius: number }) {
  const ring = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame((st, dt) => {
    const on = drag.id !== null && drag.moved;
    const target = on ? (drag.over ? 0.95 : 0.35 + Math.sin(st.clock.elapsedTime * 6) * 0.12) : 0;
    mat.current.opacity += (target - mat.current.opacity) * Math.min(1, dt * 12);
    ring.current.visible = mat.current.opacity > 0.01;
    const sc = on && drag.over ? 1.08 : 1;
    ring.current.scale.setScalar(ring.current.scale.x + (sc - ring.current.scale.x) * Math.min(1, dt * 10));
  });
  return (
    <mesh ref={ring} rotation-x={-Math.PI / 2} position={[at[0], 0.01, at[2]]} visible={false}>
      <ringGeometry args={[radius * 0.62, radius * 0.7, 64]} />
      <meshBasicMaterial ref={mat} color="#ffffff" transparent opacity={0} toneMapped={false} depthWrite={false} />
    </mesh>
  );
}

/** Fires once after the first few frames: by then every card texture and shader is on the GPU. */
function ReadySignal({ onReady }: { onReady?: () => void }) {
  const frames = useRef(0);
  const done = useRef(false);
  useFrame(() => {
    if (done.current || ++frames.current < 4) return;
    done.current = true;
    onReady?.();
  });
  return null;
}
