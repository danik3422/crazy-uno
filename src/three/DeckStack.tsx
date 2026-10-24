import { useMemo } from 'react';
import * as THREE from 'three';
import type { ThemeId } from '../game/types';
import { DECK_TOP, type Vec3 } from './layout';
import { cardTexture } from './textures';

const LAYERS = 22;

/** Side of the stack: a wall of card edges, cream with fine darker seams. */
function edgeTexture() {
  const cv = document.createElement('canvas');
  cv.width = 8;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#f3efe4';
  ctx.fillRect(0, 0, 8, 128);
  for (let y = 0; y < 128; y += 4) {
    ctx.fillStyle = y % 8 ? 'rgba(80,60,40,.18)' : 'rgba(80,60,40,.3)';
    ctx.fillRect(0, y, 8, 1);
  }
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * The draw pile, as in the console UNO games: a tall, slightly messy stack that never runs out.
 * It is pure decoration; the real top cards lie on it and fly off when drawn.
 */
export function DeckStack({ at, theme }: { at: Vec3; theme: ThemeId }) {
  const edge = useMemo(edgeTexture, []);
  const back = cardTexture(null, theme);
  // thin slabs, each turned a little: the uneven edges make it read as a pile of real cards
  const slabs = useMemo(
    () =>
      Array.from({ length: LAYERS }, (_, i) => ({
        y: (i + 0.5) * (DECK_TOP / LAYERS),
        rot: Math.sin(i * 12.9898) * 0.045,
        dx: Math.sin(i * 78.233) * 0.025,
        dz: Math.cos(i * 37.719) * 0.025,
      })),
    [],
  );
  const h = DECK_TOP / LAYERS;
  const sideMat = useMemo(() => new THREE.MeshStandardMaterial({ map: edge, roughness: 0.8 }), [edge]);
  const topMat = useMemo(() => new THREE.MeshStandardMaterial({ map: back, roughness: 0.4, alphaTest: 0.5 }), [back]);
  return (
    <group position={[at[0], 0, at[2]]} rotation-y={-0.35}>
      {slabs.map((s, i) => (
        <mesh key={i} position={[s.dx, s.y, s.dz]} rotation-y={s.rot} castShadow receiveShadow material={sideMat}>
          <boxGeometry args={[0.97, h, 1.47]} />
        </mesh>
      ))}
      {/* the back of the topmost hidden card, in case the real cards are mid-flight */}
      <mesh position={[slabs[LAYERS - 1].dx, DECK_TOP + 0.001, slabs[LAYERS - 1].dz]} rotation={[-Math.PI / 2, 0, slabs[LAYERS - 1].rot + Math.PI]} material={topMat}>
        <planeGeometry args={[1, 1.5]} />
      </mesh>
    </group>
  );
}
