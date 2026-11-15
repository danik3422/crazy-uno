import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { VanSkin } from '../../game/skins';
import { debugValue } from '../../lib/debug';
import { VAN_LOOKS } from './looks';
import { BigGuy, DOOR_W, DOOR_X, Van, VAN_D, limbs, makePrint } from './models';

/*
 * The skins menu's preview: the chosen van parked on a slowly turning stand, its side door sliding open and shut,
 * the crew standing by the door. Brings its own soft lights (the menu has no table scene around it).
 * Framed for a camera at about [0, 1.6, 6.2] looking at [0, 0.8, 0], fov 35.
 */

const SCALE = 0.8;
/** one door cycle: shut, sliding open, open, sliding shut (seconds) */
const CYCLE = 5.5;
const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

export function VanShowcase({ skin }: { skin: VanSkin }) {
  const look = VAN_LOOKS[skin];
  const stand = useRef<THREE.Group>(null!);
  const van = useRef<THREE.Group>(null!);
  const door = useRef<THREE.Group>(null!);
  const wheels = useRef<THREE.Group>(null!);
  const a = useRef<THREE.Group>(null!);
  const b = useRef<THREE.Group>(null!);
  const near = useRef<THREE.MeshBasicMaterial>(null!);
  const far = useRef<THREE.MeshBasicMaterial>(null!);
  const doorPrint = useRef<THREE.MeshBasicMaterial>(null!);
  const print = useMemo(() => makePrint(look), [look]);
  useEffect(() => () => print.dispose(), [print]);
  useLayoutEffect(() => {
    near.current.map = print.normal.full;
    far.current.map = print.normal.full;
    doorPrint.current.map = print.normal.door;
    for (const m of [near.current, far.current, doorPrint.current]) m.needsUpdate = true;
  }, [print]);

  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    // a slow turn, easing a little while the door side faces the camera so the print can be read
    stand.current.rotation.y += dt * (0.32 - 0.18 * Math.max(0, Math.cos(stand.current.rotation.y + 0.5)));
    // debug: window.__showYaw pins the turntable, window.__showDoor the door's moment in its cycle (for stills)
    const yawPin = debugValue<number>('__showYaw');
    if (typeof yawPin === 'number') stand.current.rotation.y = yawPin;
    const doorPin = debugValue<number>('__showDoor');
    const c = typeof doorPin === 'number' ? doorPin : t % CYCLE;
    const open = smooth((c - 1.2) / 0.7) - smooth((c - 4.1) / 0.7);
    door.current.position.x = DOOR_X + open * DOOR_W * 0.96;
    door.current.position.z = VAN_D / 2 + 0.02 + Math.min(1, open * 5) * 0.05;
    // the van settles on its springs as the door slams
    const slam = c > 4.8 ? Math.exp(-(c - 4.8) * 6) * Math.sin((c - 4.8) * 20) * 0.012 : 0;
    van.current.rotation.x = slam;
    // the crew: breathing, shifting from foot to foot, one glancing at his summons
    [a.current, b.current].forEach((g, n) => {
      const br = 1 + Math.sin(t * 2.1 + n * 1.7) * 0.012;
      g.scale.set(1, br, 1);
      g.rotation.z = Math.sin(t * 0.9 + n * 2) * 0.03;
      limbs(g, 0, 0);
      for (const ch of g.children) {
        if (ch.name === 'armR' && n === 0) ch.rotation.x = -0.9 - 0.25 * smooth(Math.sin(t * 0.7) * 2);
        if (ch.name === 'armL' || (ch.name === 'armR' && n === 1)) ch.rotation.x = Math.sin(t * 1.3 + n) * 0.06;
      }
    });
    b.current.rotation.y = -0.45 + Math.sin(t * 0.5) * 0.25;
  });

  return (
    <group>
      <ambientLight intensity={0.75} />
      <directionalLight position={[3.5, 6, 5]} intensity={2.1} />
      <group ref={stand} scale={SCALE} position-y={0.05}>
        {/* the turntable: a low disc with a lighter rim, and a soft shadow under the van */}
        <mesh position-y={-0.05}>
          <cylinderGeometry args={[2.35, 2.45, 0.1, 64]} />
          <meshStandardMaterial color="#2c3140" roughness={0.6} metalness={0.15} />
        </mesh>
        <mesh position-y={0.003} rotation-x={-Math.PI / 2}>
          <ringGeometry args={[2.22, 2.32, 64]} />
          <meshBasicMaterial color="#f5c518" toneMapped={false} />
        </mesh>
        <mesh position={[0, 0.006, -0.1]} rotation-x={-Math.PI / 2} scale={[1.9, 0.8, 1]}>
          <circleGeometry args={[1, 32]} />
          <meshBasicMaterial color="#000" transparent opacity={0.28} depthWrite={false} />
        </mesh>
        <group position={[0.05, 0, -0.3]}>
          <Van g={van} door={door} wheels={wheels} print={{ near, far, door: doorPrint }} look={look} />
        </group>
        <group position={[-1.75, 0, 0.75]} rotation-y={0.5}>
          <BigGuy g={a} paper look={look} />
        </group>
        <group position={[1.95, 0, 0.6]}>
          <BigGuy g={b} moustache look={look} />
        </group>
      </group>
    </group>
  );
}
