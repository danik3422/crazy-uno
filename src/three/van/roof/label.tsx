import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';

/* Small helpers for the roof props: pictures drawn on a canvas, and words that stay readable on a mirrored van. */

export const DISPLAY = 'Unbounded, "Arial Black", Impact, sans-serif';

/**
 * A canvas texture drawn by `draw` (a module-level function, so it stays the same), drawn again once the
 * display font has arrived, and disposed with the component. `rx`, `ry`: tiled that many times.
 */
export function useCanvasTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D, w: number, h: number) => void, rx = 0, ry = 0) {
  const tex = useMemo(() => {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    if (rx) {
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
    }
    const paint = () => {
      const c = cv.getContext('2d')!;
      c.clearRect(0, 0, w, h);
      draw(c, w, h);
      t.needsUpdate = true;
    };
    paint();
    document.fonts?.load(`900 40px ${DISPLAY}`).then(paint).catch(() => {});
    return t;
  }, [w, h, draw, rx, ry]);
  useEffect(() => () => tex.dispose(), [tex]);
  return tex;
}

/**
 * The knock-out scene mirrors the whole van to drive it the other way; this undoes the mirror for what is
 * inside (words on a sign), around its own origin.
 */
export function Unmirror({ children, ...props }: { children: ReactNode } & JSX.IntrinsicElements['group']) {
  const g = useRef<THREE.Group>(null!);
  useFrame(() => {
    const p = g.current.parent;
    if (p) g.current.scale.x = p.matrixWorld.determinant() < 0 ? -1 : 1;
  });
  return (
    <group {...props}>
      <group ref={g}>{children}</group>
    </group>
  );
}
