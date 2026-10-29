import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { GameView } from '../game/view';
import { standIn } from '../game/avatars';
import { teamName } from '../game/content';
import { useT } from '../i18n';
import { AvatarImg } from '../ui/components/AvatarImg';
import { IconStack } from '../ui/components/Icons';
import { TurnTimer } from '../ui/game/TurnTimer';
import { Card3D, setPlayableGlow } from './Card3D';
import { DeckStack } from './DeckStack';
import { dealTiming } from '../net/protocol';
import { drag } from './drag';
import { Arena, PALETTES } from './Environment';
import { BombDrop, GoldBurst, Lightning, Meteor } from './EventFx';
import { DEBUG, fxState, nowSec } from './fxState';
import { FitProbe } from './FitProbe';
import { CAMERA, PARALLAX_X, RING_R, RING_Z, arena, cameraFov, computeTargets, deckCenter, deckSpot, seatAngle, type View } from './layout';
import { Mascot } from './Mascot';
import { PlayFx, StackFx } from './PlayFx';
import { CardFx } from './cardFx/CardFx';
import { Podium } from './Podium';
import { THEMES } from './themes';
import { isPhone } from '../ui/hooks/phone';
import '../ui/game/Plates.css';

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
  // a phone lying on its side: wide but very short, so the HUD and plates get compact
  const compact = !portrait && size.height < 520;
  // rounded, so resizing a window does not rebuild the layout on every pixel
  const aspect = Math.round((size.width / size.height) * 50) / 50;
  const view: View = useMemo(() => ({ portrait, compact, aspect }), [portrait, compact, aspect]);
  const targets = useMemo(() => computeTargets(game, view), [game, version, view]);
  const s = game.s;
  const A = arena(view);
  const deck = useMemo(() => deckSpot(game, view), [game, version, view]);
  const deckMid = useMemo(() => deckCenter(game, view), [game, version, view]);
  const cards = [...s.deck, ...s.discard, ...s.players.flatMap(p => p.hand)];
  const top = s.discard[s.discard.length - 1];
  const theme = s.theme ?? 'classic';
  const Landing = THEMES[theme].Landing;
  const lite = isPhone();
  useLayoutEffect(() => setPlayableGlow(THEMES[theme].glow), [theme]);

  return (
    <>
      <CameraRig view={view} finale={s.phase === 'over'} focus={A.discard} />
      <ReadySignal onReady={onReady} />
      {DEBUG && <FitProbe />}
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
      <DeckStack at={deck} center={deckMid} theme={theme} portrait={portrait} slideAt={dealTiming(s.players.length, s.table?.handSize ?? 7).slideMs / 1000} />
      <DeckHit active={canDraw} onClick={onDeck} pending={s.pending} at={deck} />
      {/* during the finale the podium shows everyone, so the seat plates step aside */}
      {s.phase !== 'over' && <PlayerPlates game={game} view={view} dealing={dealing} />}
      {top && <PlayFx top={top} at={A.discard} />}
      {top && Landing && <Landing top={top} at={A.discard} lite={lite} />}
      <StackFx pending={s.pending} top={top} at={A.discard} />
      <CardFx game={game} version={version} view={view} theme={theme} pile={A.discard} />
      <DropZone at={A.discard} radius={portrait ? 2.2 : 2.6} />
      <Bomb deadline={s.timerKind === 'bomb' ? s.bombDeadline : null} offset={game.clockOffset} />
      <Explosion />
      <Meteor game={game} view={view} />
      <Lightning game={game} view={view} />
      <GoldBurst game={game} view={view} />
      <BombDrop />
      <Mascot scale={portrait ? 0.6 : 0.72} portrait={portrait} />
      {/* mounted all round (hidden) so their shaders are ready: the finale must not stall */}
      <Confetti active={s.phase === 'over'} />
      <Podium
        active={s.phase === 'over' && s.winner !== null}
        players={s.players}
        winner={s.winner}
        teams={s.teams}
        at={A.discard}
        scale={portrait ? 0.8 : 1}
      />
    </>
  );
}

const finePointer = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

function CameraRig({ view, finale, focus }: { view: View; finale: boolean; focus: [number, number, number] }) {
  const { camera } = useThree();
  const { portrait, compact } = view;
  const cam0 = portrait ? CAMERA.portrait : CAMERA.landscape;
  const look = useMemo(() => new THREE.Vector3(), []);
  const tmpLook = useMemo(() => new THREE.Vector3(), []);
  const roll = useRef(0);
  useFrame((state, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    // finale: come down closer and look at the podium
    const base = finale ? (portrait ? [focus[0], 6.2, 11.8] : [focus[0], 4.6, 8.6]) : cam0.pos;
    const fov = cameraFov(view);
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
    const px = finePointer ? state.pointer.x * PARALLAX_X : 0;
    const py = finePointer ? state.pointer.y * 0.2 : 0;
    const tx = base[0] + px + Math.sin(orbit) * base[2] + sx;
    const tz = base[2] * Math.cos(orbit);
    cam.position.x += (tx - cam.position.x) * Math.min(1, dt * 3);
    cam.position.y += (base[1] + py + sy - cam.position.y) * Math.min(1, dt * 3);
    cam.position.z += (tz - cam.position.z) * Math.min(1, dt * 3);
    // on phones the results sheet takes the lower half, so aim low and lift the podium up the screen
    // lying on its side the results sit on the right, so the podium moves into the left half
    if (finale) look.lerp(tmpLook.set(focus[0] + (compact ? 2.1 : 0), portrait ? -1.2 : compact ? 0.9 : 0.75, focus[2]), Math.min(1, dt * 2.5));
    else look.lerp(tmpLook.set(cam0.look[0], cam0.look[1], cam0.look[2]), Math.min(1, dt * 4));
    cam.lookAt(look);
    // "upside down" event: roll the whole view over
    roll.current += ((now < fxState.upsideUntil ? Math.PI : 0) - roll.current) * Math.min(1, dt * 2.2);
    if (Math.abs(roll.current) > 0.001) cam.rotateZ(roll.current);
  });
  return null;
}

/** Two big glowing arrows sweeping around the pile in the direction of play. */
/**
 * One arrow of the direction ring, flat on the table: a band along the circle that ends in a broad,
 * sharp head. Built in the ring's own plane (XY), so the squash of the ring keeps it a clean shape.
 */
function ringArrowGeometry(R: number, arc: number, w = 0.15, headW = 0.4, headLenAbs = 0.62) {
  const headLen = headLenAbs / R; // in radians
  const s = new THREE.Shape();
  const steps = 40;
  const end = arc - headLen;
  const at = (r: number, a: number) => new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  // outer edge forward, head, inner edge back
  s.moveTo(at(R + w, 0).x, at(R + w, 0).y);
  for (let i = 1; i <= steps; i++) {
    const p = at(R + w, (end * i) / steps);
    s.lineTo(p.x, p.y);
  }
  const o = at(R + headW, end);
  const tip = at(R, arc);
  const inn = at(R - headW, end);
  s.lineTo(o.x, o.y);
  s.lineTo(tip.x, tip.y);
  s.lineTo(inn.x, inn.y);
  for (let i = steps; i >= 0; i--) {
    const p = at(R - w, (end * i) / steps);
    s.lineTo(p.x, p.y);
  }
  s.closePath();
  return new THREE.ShapeGeometry(s, 1);
}

const easeInOutCubic = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/**
 * The ring of arrows around the pile that shows which way the turn goes. It drifts slowly that way;
 * on a reverse the arrows fold over and come back pointing the other way, with a brief flash.
 */
function DirectionArrows({ dir, at }: { dir: 1 | -1; at: [number, number, number] }) {
  const spin = useRef<THREE.Group>(null!);
  const flipG = useRef<THREE.Group>(null!);
  const R = RING_R;
  const ARC = 1.9;
  const geo = useMemo(() => ringArrowGeometry(R, ARC), [R]);
  // a wider, faint copy under each arrow: a soft halo, so the arrows glow on the floor
  const haloGeo = useMemo(() => ringArrowGeometry(R, ARC + 0.04, 0.34, 0.64, 0.78), [R]);
  const mat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6, toneMapped: false, side: THREE.DoubleSide, depthWrite: false }),
    [],
  );
  const halo = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#fff3c4', transparent: true, opacity: 0.22, toneMapped: false, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }),
    [],
  );
  const speed = useRef(0);
  const flip = useRef<{ from: number; to: number; t0: number } | null>(null);
  const shown = useRef<number>(dir);
  useEffect(() => {
    if (dir === shown.current && !flip.current) return;
    flip.current = { from: flipG.current ? flipG.current.scale.y : shown.current, to: dir, t0: nowSec() };
    shown.current = dir;
  }, [dir]);
  useFrame((_, dt) => {
    const now = nowSec();
    const racing = now < fxState.carouselUntil;
    speed.current += (dir * (racing ? 7 : 0.7) - speed.current) * Math.min(1, dt * (racing ? 6 : 2));
    spin.current.rotation.y -= speed.current * dt;
    let pulse = 0;
    const f = flip.current;
    if (f) {
      const p = Math.min(1, (now - f.t0) / 0.55);
      flipG.current.scale.y = f.from + (f.to - f.from) * easeInOutCubic(p);
      pulse = Math.sin(Math.PI * p);
      if (p >= 1) flip.current = null;
    } else flipG.current.scale.y = dir;
    mat.opacity = 0.8 + pulse * 0.2;
    halo.opacity = 0.2 + pulse * 0.35;
  });
  return (
    <group position={[at[0], 0.035, at[2]]} scale={[1, 1, RING_Z]}>
      <group ref={spin}>
        {/* the shape lies in XY; +90° about X maps its angles onto the seat angles (x = cos a, z = sin a) */}
        <group ref={flipG} rotation-x={Math.PI / 2} scale={[1, dir, 1]}>
          {[0, 1].map(k => (
            <group key={k} rotation-z={k * Math.PI}>
              <mesh geometry={haloGeo} material={halo} position-z={0.004} />
              <mesh geometry={geo} material={mat} />
            </group>
          ))}
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
        <ringGeometry args={[0.92, 1.04, 48]} />
        <meshBasicMaterial ref={ring} color={pending ? '#ff6b5e' : '#ffffff'} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

/** Avatar plates above each opponent's fan: name ribbon, portrait, card counter. */
function PlayerPlates({ game, view, dealing }: { game: GameView; view: View; dealing: boolean }) {
  const t = useT();
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
            <div className={`oplate ${cur ? 'cur' : ''} ${i === s.winner ? 'win' : ''} ${p.offline ? 'off' : ''} ${p.out ? 'out' : ''} ${s.teams ? `team t${s.teams[i]}` : ''} ${view.portrait || view.compact ? 'small' : ''} ${(view.portrait && s.players.length > 3) || (view.compact && s.players.length > 5) ? 'tiny' : ''}`} title={p.name}>
              {s.teams && (
                <span className="oplate-team">{s.teams[i] === s.teams[game.seat()] ? t('plate.partner') : teamName(s.teams[i])}</span>
              )}
              <span className="ava-wrap swap-in" key={p.offline ? 'bot' : 'me'}>
                {/* someone dropped out: a bot sits in under its own name and face until they are back */}
                <AvatarImg id={p.offline ? sub.avatar : p.avatar} name={p.offline ? sub.name : p.name} bot={p.bot} size={view.portrait ? 40 : view.compact ? 34 : 54} className="oplate-ava" />
                {cur && !dealing && s.turnDeadline !== null && (
                  <TurnTimer key={s.turn} deadline={s.turnDeadline} total={s.turnTotal} offset={game.clockOffset} />
                )}
              </span>
              <span className="oplate-info">
                <span className="plate-name" key={p.offline ? 'bot' : 'me'}>{p.offline ? sub.name : p.name}</span>
                {p.out ? (
                  <span className="oplate-away">{t('plate.out')}</span>
                ) : p.offline ? (
                  <span className="oplate-away">{t('plate.away', { who: p.name })}</span>
                ) : (
                  <span className="oplate-count" aria-label={t('plate.cards', { n: p.hand.length })}><IconStack />{p.hand.length}</span>
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

/**
 * The ticking bomb over the table while a bomb countdown runs (`deadline`, server ms; null: no bomb).
 * Always mounted with its light, which only dims to 0: adding or removing a light makes three.js
 * recompile every lit material on screen, a visible stall.
 */
function Bomb({ deadline, offset }: { deadline: number | null; offset: number }) {
  const g = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const spark = useRef<THREE.Mesh>(null!);
  const light = useRef<THREE.PointLight>(null!);
  useFrame(st => {
    body.current.visible = deadline !== null;
    if (deadline === null) {
      light.current.intensity = 0;
      return;
    }
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
      <group ref={body} visible={false}>
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
      </group>
      <pointLight ref={light} position={[0.47, 0.63, 0.1]} color="#ff9a3c" distance={4} intensity={0} />
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

/** Confetti raining over the finale. Always mounted (hidden and idle until `active`), restarts each time it turns on. */
function Confetti({ active }: { active: boolean }) {
  const N = 320;
  const ref = useRef<THREE.InstancedMesh>(null!);
  const parts = useMemo(
    () =>
      Array.from({ length: N }, () => ({
        p: new THREE.Vector3(),
        v: 0,
        r: new THREE.Euler(),
        w: 0,
      })),
    [],
  );
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const wasActive = useRef(false);
  useLayoutEffect(() => {
    const cols = ['#e5413a', '#f2bf16', '#26a556', '#2c79dc', '#ffd04a', '#fffdf6'];
    const c = new THREE.Color();
    for (let i = 0; i < N; i++) ref.current.setColorAt(i, c.set(cols[i % cols.length]));
    ref.current.instanceColor!.needsUpdate = true;
  }, []);
  useFrame((_, dt) => {
    const mesh = ref.current;
    if (active && !wasActive.current) {
      // a fresh shower from above the table
      for (const q of parts) {
        q.p.set((Math.random() - 0.5) * 12, 6 + Math.random() * 8, (Math.random() - 0.5) * 8);
        q.v = 1.2 + Math.random() * 1.8;
        q.r.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
        q.w = (Math.random() - 0.5) * 8;
      }
    }
    wasActive.current = active;
    mesh.visible = active;
    if (!active) return;
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
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]} visible={false} frustumCulled={false}>
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
  const lastAt = useRef(0);
  const calm = useRef(0);
  useFrame(({ gl, scene, camera }) => {
    if (frames.current === 1) {
      // compile every shader now, under the loading curtain: effects that show up for the first time
      // mid-game (pile flash, meteor, lightning, the plane, the podium…) would otherwise freeze a frame or two.
      // Compiling alone is not enough: drivers finish linking a shader on its first draw, so everything
      // hidden is also drawn once here (nobody sees this frame, the curtain covers it).
      const hidden: THREE.Object3D[] = [];
      const culled: THREE.Object3D[] = [];
      scene.traverse(o => {
        if (!o.visible) {
          hidden.push(o);
          o.visible = true;
        }
        // things off camera right now (the meteor up in the sky, the plane far away) get drawn too
        if (o.frustumCulled) {
          culled.push(o);
          o.frustumCulled = false;
        }
      });
      gl.compile(scene, camera);
      gl.render(scene, camera);
      hidden.forEach(o => (o.visible = false));
      culled.forEach(o => (o.frustumCulled = true));
    }
    if (done.current) return;
    // ready once the first heavy frames (shader compiles, texture uploads) are behind us and frames come
    // at an even pace again, so the shuffle starts smoothly; a slow device still goes after about a second
    const n = ++frames.current;
    const dt = performance.now() - lastAt.current;
    lastAt.current = performance.now();
    calm.current = dt < 28 ? calm.current + 1 : 0;
    if (n < 4 || (calm.current < 4 && n < 60)) return;
    done.current = true;
    onReady?.();
  });
  return null;
}
