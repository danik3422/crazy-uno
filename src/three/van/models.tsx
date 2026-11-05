import { Billboard, RoundedBox } from '@react-three/drei';
import type { RefObject } from 'react';
import * as THREE from 'three';

/* The cast of the knock-out scene: the olive van, the two big guys in uniform, and the player being taken. */

export const VAN_L = 2.7;
export const VAN_H = 1.2;
export const VAN_D = 1.15;
export const WHEEL_R = 0.24;
/** the side door's centre along the van (the front is at -x) and its width: wide enough for a big guy */
export const DOOR_X = 0.15;
export const DOOR_W = 0.98;

/** the print on the sides: under the windows, from behind the front wheel to the back */
const PRINT_X = 0.16;
const PRINT_W = 2.45;
const PRINT_Y = 0.43;
const PRINT_H = 0.42;
const PRINT_TEXT = 'NAVIйну';

export interface VanPrint {
  near: RefObject<THREE.MeshBasicMaterial>;
  far: RefObject<THREE.MeshBasicMaterial>;
  door: RefObject<THREE.MeshBasicMaterial>;
}

/**
 * The print's pictures: the whole side, and the door's piece of it; each also mirrored, for a van that is
 * flipped to drive the other way (the flip mirrors the picture back).
 */
export function makePrint() {
  const W = 1024;
  const H = Math.round((W * PRINT_H) / PRINT_W);
  const draw = (cv: HTMLCanvasElement, flip: boolean) => {
    const c = cv.getContext('2d')!;
    c.clearRect(0, 0, W, H);
    c.save();
    if (flip) {
      c.translate(W, 0);
      c.scale(-1, 1);
    }
    const size = H * 0.78;
    c.font = `900 ${size}px Unbounded, "Arial Black", Impact, sans-serif`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    // fit the width, leaning forward like a sticker made to look fast
    const w = c.measureText(PRINT_TEXT).width;
    const fit = Math.min(1, (W * 0.92) / w);
    c.translate(W / 2, H / 2 + H * 0.04);
    c.transform(fit, 0, -0.18, 1, 0, 0);
    c.lineJoin = 'round';
    c.lineWidth = size * 0.16;
    c.strokeStyle = '#151515';
    c.strokeText(PRINT_TEXT, 0, 0);
    const grad = c.createLinearGradient(0, -size / 2, 0, size / 2);
    grad.addColorStop(0, '#fff27a');
    grad.addColorStop(1, '#f5b800');
    c.fillStyle = grad;
    c.fillText(PRINT_TEXT, 0, 0);
    c.restore();
  };
  const make = (flip: boolean) => {
    const cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    draw(cv, flip);
    const full = new THREE.CanvasTexture(cv);
    full.colorSpace = THREE.SRGBColorSpace;
    full.anisotropy = 8;
    // the door's piece: the same picture, the part of it the door covers when shut
    const door = full.clone();
    door.repeat.set(DOOR_W / PRINT_W, 1);
    door.offset.set((DOOR_X - DOOR_W / 2 - (PRINT_X - PRINT_W / 2)) / PRINT_W, 0);
    door.needsUpdate = true;
    return { full, door, cv };
  };
  const normal = make(false);
  const flipped = make(true);
  // the display font may arrive later: paint again then
  if (typeof document !== 'undefined' && document.fonts) {
    void document.fonts.load('900 40px Unbounded').then(() => {
      for (const [p, f] of [[normal, false], [flipped, true]] as const) {
        draw(p.cv, f);
        p.full.needsUpdate = true;
        p.door.needsUpdate = true;
      }
    }).catch(() => {});
  }
  return { normal, flipped };
}

const OLIVE = '#5d6338';
const OLIVE_DARK = '#454a29';
const SKIN = '#eab48c';

/** A big guy in an olive uniform and cap. `paper`: holds a sheet (the summons) in one hand. */
export function BigGuy({ g, paper, moustache }: { g: RefObject<THREE.Group>; paper?: boolean; moustache?: boolean }) {
  return (
    <group ref={g}>
      {/* legs and boots */}
      {[-0.13, 0.13].map(x => (
        <group key={x} name={x < 0 ? 'legL' : 'legR'} position={[x, 0.36, 0]}>
          <mesh position-y={-0.17}>
            <cylinderGeometry args={[0.1, 0.09, 0.34, 10]} />
            <meshStandardMaterial color={OLIVE_DARK} roughness={0.9} />
          </mesh>
          <mesh position={[0, -0.33, 0.04]}>
            <boxGeometry args={[0.18, 0.08, 0.27]} />
            <meshStandardMaterial color="#1e1c1a" roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* the belly */}
      <mesh position-y={0.68} scale={[1.08, 1, 0.95]} castShadow>
        <sphereGeometry args={[0.4, 22, 16]} />
        <meshStandardMaterial color={OLIVE} roughness={0.85} />
      </mesh>
      {/* belt with a buckle */}
      <mesh position-y={0.5} scale={[1.02, 1, 0.9]}>
        <cylinderGeometry args={[0.39, 0.4, 0.07, 22]} />
        <meshStandardMaterial color="#3b2a1a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.5, 0.37]}>
        <boxGeometry args={[0.1, 0.07, 0.03]} />
        <meshStandardMaterial color="#c9a94a" metalness={0.6} roughness={0.35} />
      </mesh>
      {/* chest pocket flaps */}
      {[-0.15, 0.15].map(x => (
        <mesh key={x} position={[x, 0.86, 0.33]} rotation-x={-0.35}>
          <boxGeometry args={[0.14, 0.05, 0.02]} />
          <meshStandardMaterial color={OLIVE_DARK} roughness={0.9} />
        </mesh>
      ))}
      {/* arms */}
      {[-1, 1].map(s => (
        <group key={s} name={s < 0 ? 'armL' : 'armR'} position={[s * 0.4, 0.92, 0]}>
          <mesh position-y={-0.2} rotation-z={s * 0.25}>
            <capsuleGeometry args={[0.085, 0.28, 4, 10]} />
            <meshStandardMaterial color={OLIVE} roughness={0.85} />
          </mesh>
          <mesh position={[s * 0.09, -0.42, 0]}>
            <sphereGeometry args={[0.075, 10, 8]} />
            <meshStandardMaterial color={SKIN} roughness={0.7} />
          </mesh>
          {paper && s > 0 && (
            <mesh position={[0.12, -0.42, 0.1]} rotation={[-0.3, -0.3, 0.1]}>
              <planeGeometry args={[0.2, 0.27]} />
              <meshStandardMaterial color="#f6f2e6" roughness={0.9} side={THREE.DoubleSide} />
            </mesh>
          )}
        </group>
      ))}
      {/* head: round face, a double chin, small eyes, a frown */}
      <mesh position-y={1.17} castShadow>
        <sphereGeometry args={[0.2, 20, 16]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.04, 0.06]} scale={[1.1, 0.6, 0.9]}>
        <sphereGeometry args={[0.17, 16, 12]} />
        <meshStandardMaterial color={SKIN} roughness={0.7} />
      </mesh>
      {[-0.07, 0.07].map(x => (
        <mesh key={x} position={[x, 1.2, 0.18]}>
          <sphereGeometry args={[0.025, 8, 6]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      ))}
      {[-0.07, 0.07].map(x => (
        <mesh key={x} position={[x, 1.25, 0.18]} rotation-z={x > 0 ? 0.35 : -0.35}>
          <boxGeometry args={[0.07, 0.015, 0.01]} />
          <meshStandardMaterial color="#3a2a1c" />
        </mesh>
      ))}
      {moustache ? (
        <mesh position={[0, 1.11, 0.19]}>
          <boxGeometry args={[0.13, 0.035, 0.03]} />
          <meshStandardMaterial color="#3a2a1c" />
        </mesh>
      ) : (
        <mesh position={[0, 1.1, 0.185]}>
          <boxGeometry args={[0.08, 0.015, 0.01]} />
          <meshStandardMaterial color="#7a3a2a" />
        </mesh>
      )}
      {/* the cap */}
      <mesh position-y={1.33}>
        <cylinderGeometry args={[0.2, 0.21, 0.11, 18]} />
        <meshStandardMaterial color={OLIVE} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.29, 0.17]} rotation-x={0.25}>
        <boxGeometry args={[0.3, 0.025, 0.16]} />
        <meshStandardMaterial color={OLIVE_DARK} roughness={0.85} />
      </mesh>
    </group>
  );
}

/** The olive van: rounded body, a short nose, dark windows, a sliding side door facing the camera. */
export function Van({ g, door, wheels, print }: { g: RefObject<THREE.Group>; door: RefObject<THREE.Group>; wheels: RefObject<THREE.Group>; print: VanPrint }) {
  const glass = <meshStandardMaterial color="#1b2228" roughness={0.2} metalness={0.4} />;
  const paint = <meshStandardMaterial color={OLIVE} roughness={0.75} metalness={0.05} />;
  return (
    <group ref={g}>
      {/* body: the box and the sloped nose */}
      <RoundedBox args={[VAN_L, VAN_H, VAN_D]} radius={0.16} smoothness={3} position={[0.12, WHEEL_R + VAN_H / 2, 0]} castShadow>
        {paint}
      </RoundedBox>
      <RoundedBox args={[0.6, 0.5, VAN_D * 0.98]} radius={0.12} smoothness={3} position={[-VAN_L / 2 - 0.12, WHEEL_R + 0.3, 0]} castShadow>
        {paint}
      </RoundedBox>
      {/* windscreen, leaning back */}
      <mesh position={[-VAN_L / 2 + 0.02, WHEEL_R + VAN_H * 0.72, 0]} rotation-z={-0.35}>
        <boxGeometry args={[0.05, 0.5, VAN_D * 0.88]} />
        {glass}
      </mesh>
      {/* side windows on the camera side and the far side */}
      {[1, -1].map(s => (
        <group key={s}>
          <mesh position={[-0.62, WHEEL_R + VAN_H * 0.73, s * (VAN_D / 2 + 0.005)]}>
            <boxGeometry args={[0.5, 0.36, 0.01]} />
            {glass}
          </mesh>
          <mesh position={[0.95, WHEEL_R + VAN_H * 0.73, s * (VAN_D / 2 + 0.005)]}>
            <boxGeometry args={[0.55, 0.36, 0.01]} />
            {glass}
          </mesh>
        </group>
      ))}
      {/* the print along both sides: on the body (behind the door, which carries its own piece of it) and on the far side */}
      <mesh position={[PRINT_X, WHEEL_R + PRINT_Y, VAN_D / 2 + 0.004]}>
        <planeGeometry args={[PRINT_W, PRINT_H]} />
        <meshBasicMaterial ref={print.near} transparent toneMapped={false} />
      </mesh>
      <mesh position={[PRINT_X, WHEEL_R + PRINT_Y, -VAN_D / 2 - 0.004]} rotation-y={Math.PI}>
        <planeGeometry args={[PRINT_W, PRINT_H]} />
        <meshBasicMaterial ref={print.far} transparent toneMapped={false} />
      </mesh>
      {/* the dark inside, seen through the open door */}
      <mesh position={[DOOR_X, WHEEL_R + VAN_H * 0.47, VAN_D / 2 + 0.006]}>
        <planeGeometry args={[DOOR_W - 0.04, VAN_H * 0.86]} />
        <meshBasicMaterial color="#0d0f0a" />
      </mesh>
      {/* the sliding door (slides toward the back) */}
      <group ref={door} position={[DOOR_X, WHEEL_R + VAN_H * 0.47, VAN_D / 2 + 0.02]}>
        <mesh>
          <boxGeometry args={[DOOR_W, VAN_H * 0.88, 0.03]} />
          {paint}
        </mesh>
        <mesh position={[0, VAN_H * 0.26, 0.017]}>
          <boxGeometry args={[DOOR_W * 0.8, 0.34, 0.01]} />
          {glass}
        </mesh>
        {/* the door's own piece of the print, lined up with the body's when shut */}
        <mesh position={[0, PRINT_Y - VAN_H * 0.47, 0.017]}>
          <planeGeometry args={[DOOR_W, PRINT_H]} />
          <meshBasicMaterial ref={print.door} transparent toneMapped={false} />
        </mesh>
        <mesh position={[-DOOR_W / 2 + 0.08, 0, 0.03]}>
          <boxGeometry args={[0.1, 0.03, 0.03]} />
          <meshStandardMaterial color="#222" metalness={0.5} />
        </mesh>
      </group>
      {/* bumpers, lights, a mirror */}
      <mesh position={[-VAN_L / 2 - 0.42, WHEEL_R + 0.08, 0]}>
        <boxGeometry args={[0.08, 0.14, VAN_D * 1.02]} />
        <meshStandardMaterial color="#2a2c22" roughness={0.6} />
      </mesh>
      <mesh position={[0.12 + VAN_L / 2 + 0.02, WHEEL_R + 0.08, 0]}>
        <boxGeometry args={[0.08, 0.14, VAN_D * 1.02]} />
        <meshStandardMaterial color="#2a2c22" roughness={0.6} />
      </mesh>
      {[0.36, -0.36].map(z => (
        <mesh key={z} position={[-VAN_L / 2 - 0.42, WHEEL_R + 0.33, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.08, 0.08, 0.03, 14]} />
          <meshStandardMaterial color="#fff6cf" emissive="#ffe9a0" emissiveIntensity={0.6} />
        </mesh>
      ))}
      <mesh position={[-VAN_L / 2 + 0.05, WHEEL_R + VAN_H * 0.62, VAN_D / 2 + 0.1]}>
        <boxGeometry args={[0.06, 0.14, 0.1]} />
        <meshStandardMaterial color="#2a2c22" />
      </mesh>
      {/* wheels */}
      <group ref={wheels}>
        {[-VAN_L / 2 + 0.18, VAN_L / 2 - 0.05].flatMap(x =>
          [1, -1].map(s => (
            <group key={`${x}${s}`} position={[x, WHEEL_R, s * (VAN_D / 2 - 0.02)]}>
              <mesh rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.18, 18]} />
                <meshStandardMaterial color="#161616" roughness={0.9} />
              </mesh>
              <mesh position-z={s * 0.092} rotation-x={Math.PI / 2}>
                <cylinderGeometry args={[0.11, 0.11, 0.01, 12]} />
                <meshStandardMaterial color="#7d8070" metalness={0.5} roughness={0.4} />
              </mesh>
            </group>
          )),
        )}
      </group>
    </group>
  );
}

/** The player being taken: a little figure in their colour with their portrait for a face. */
export function Victim({ g, face, body }: { g: RefObject<THREE.Group>; face: RefObject<THREE.MeshBasicMaterial>; body: RefObject<THREE.MeshStandardMaterial> }) {
  return (
    <group ref={g}>
      {[-0.08, 0.08].map(x => (
        <group key={x} name={x < 0 ? 'legL' : 'legR'} position={[x, 0.3, 0]}>
          <mesh position-y={-0.14}>
            <capsuleGeometry args={[0.055, 0.2, 4, 8]} />
            <meshStandardMaterial color="#2d3550" roughness={0.8} />
          </mesh>
        </group>
      ))}
      <mesh position-y={0.48} castShadow>
        <capsuleGeometry args={[0.16, 0.22, 6, 14]} />
        <meshStandardMaterial ref={body} color="#e5413a" roughness={0.7} />
      </mesh>
      {[-1, 1].map(s => (
        <group key={s} name={s < 0 ? 'armL' : 'armR'} position={[s * 0.19, 0.6, 0]}>
          <mesh position-y={-0.1} rotation-z={s * 0.3}>
            <capsuleGeometry args={[0.045, 0.18, 4, 8]} />
            <meshStandardMaterial color={SKIN} roughness={0.7} />
          </mesh>
        </group>
      ))}
      {/* the portrait always faces the camera, with a white rim */}
      <Billboard position-y={0.95}>
        <mesh position-z={-0.002}>
          <circleGeometry args={[0.3, 32]} />
          <meshBasicMaterial color="#fffdf6" />
        </mesh>
        <mesh>
          <circleGeometry args={[0.27, 32]} />
          <meshBasicMaterial ref={face} color="#ffffff" toneMapped={false} />
        </mesh>
      </Billboard>
    </group>
  );
}

/** Swings a figure's named limbs: a waddle while walking, a struggle while carried. */
export function limbs(g: THREE.Group, phase: number, amp: number) {
  for (const c of g.children) {
    if (c.name === 'legL') c.rotation.x = Math.sin(phase) * amp;
    else if (c.name === 'legR') c.rotation.x = -Math.sin(phase) * amp;
    else if (c.name === 'armL') c.rotation.x = -Math.sin(phase) * amp * 0.8;
    else if (c.name === 'armR') c.rotation.x = Math.sin(phase) * amp * 0.8;
  }
}
