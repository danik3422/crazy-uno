import { useFrame } from '@react-three/fiber';
import { useMemo, type RefObject } from 'react';
import * as THREE from 'three';

/** Makes a material's colour follow the theme accent smoothly. */
export function useAccent(mat: RefObject<THREE.MeshBasicMaterial>, accent: string) {
  const tmp = useMemo(() => new THREE.Color(), []);
  useFrame((_, dt) => {
    mat.current?.color.lerp(tmp.set(accent), Math.min(1, dt * 2));
  });
}

export interface DriftPart { a: number; r: number; y: number; s: number; spin: number; speed: number; rot: THREE.Euler }

/** Objects slowly drifting in a ring around the arena (shared by several themes). */
export function useDrift(count: number, portrait: boolean, yMin: number, yMax: number): DriftPart[] {
  return useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        a: (i / count) * Math.PI * 2 + Math.random() * 0.3,
        r: (portrait ? 6 : 9) + Math.random() * 9,
        y: yMin + Math.random() * (yMax - yMin),
        s: 0.4 + Math.random() * 1.4,
        spin: (Math.random() - 0.5) * 0.8,
        speed: 0.015 + Math.random() * 0.03,
        rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
      })),
    [count, portrait, yMin, yMax],
  );
}

export function stepDrift(parts: DriftPart[], mesh: THREE.InstancedMesh, dummy: THREE.Object3D, t: number, dt: number, scale = 1) {
  parts.forEach((p, i) => {
    p.a += p.speed * dt;
    p.rot.x += p.spin * dt;
    p.rot.y += p.spin * 0.7 * dt;
    // on the near side of the ring they climb out of the way, so nothing drifts into the camera
    const front = Math.max(0, Math.sin(p.a));
    dummy.position.set(Math.cos(p.a) * p.r, p.y + Math.sin(t * 0.5 + i) * 0.3 + front * 9, Math.sin(p.a) * p.r * 0.7 - 2);
    dummy.rotation.copy(p.rot);
    dummy.scale.setScalar(p.s * scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}


export function canvasTex(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d')!);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

