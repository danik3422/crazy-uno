import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';

/**
 * Debug only (?debug): `window.__fit()` returns the on-screen rectangle (CSS pixels) of every visible card
 * and card effect, so a test can check that nothing leaves the screen.
 * Cards are tagged with userData.fit = 'card'; effect pools and badges with 'fx' / 'badge'.
 */
export interface FitRect {
  kind: string;
  id?: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** cards: the screen point of the card's centre and of the middle of its left edge */
  cx?: number;
  cy?: number;
  lx?: number;
  ly?: number;
}

const box = new THREE.Box3();
const v = new THREE.Vector3();
const c = new THREE.Vector3();

function shown(o: THREE.Object3D) {
  for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return false;
  return true;
}

export function FitProbe() {
  const { scene, camera, size } = useThree();
  useEffect(() => {
    const w = window as unknown as { __fit?: () => FitRect[] };
    w.__fit = () => {
      camera.updateMatrixWorld();
      const out: FitRect[] = [];
      const rect = (kind: string, pts: THREE.Vector3[], id?: number) => {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const p of pts) {
          p.project(camera);
          const x = ((p.x + 1) / 2) * size.width;
          const y = ((1 - p.y) / 2) * size.height;
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
        out.push({ kind, id, x0: Math.round(x0), y0: Math.round(y0), x1: Math.round(x1), y1: Math.round(y1) });
      };
      const corners = (b: THREE.Box3) => [0, 1, 2, 3, 4, 5, 6, 7].map(i => new THREE.Vector3(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z));
      scene.traverse(o => {
        const kind = o.userData.fit as string | undefined;
        if (!kind || !shown(o)) return;
        if (kind === 'card') {
          // the card itself (its body is the first child), not the wider glow behind it
          box.setFromObject(o.children[0] ?? o, true);
          rect('card', corners(box), o.userData.id);
          const at = (lx: number) => {
            const p = o.localToWorld(new THREE.Vector3(lx, 0, 0)).project(camera);
            return [Math.round(((p.x + 1) / 2) * size.width), Math.round(((1 - p.y) / 2) * size.height)];
          };
          const r = out[out.length - 1];
          [r.cx, r.cy] = at(0);
          [r.lx, r.ly] = at(-0.5);
        } else if (kind === 'badge') {
          // a sprite: a square facing the camera
          o.getWorldPosition(c).applyMatrix4(camera.matrixWorldInverse);
          const h = o.scale.x * 0.4; // the round badge fills about 80% of the sprite
          const pts = [[-h, -h], [h, -h], [-h, h], [h, h]].map(([dx, dy]) => v.set(c.x + dx, c.y + dy, c.z).clone().applyMatrix4(camera.matrixWorld));
          rect('badge', pts);
        } else if (kind === 'fx') {
          const g = (o as THREE.Mesh).geometry as THREE.InstancedBufferGeometry;
          const pos = g.getAttribute('aPos');
          const sz = g.getAttribute('aSize');
          for (let i = 0; i < g.instanceCount; i++) {
            const half = Math.max(Math.abs(sz.getX(i)), Math.abs(sz.getY(i))) * 0.3; // soft shapes: count the solid middle
            c.set(pos.getX(i), pos.getY(i), pos.getZ(i));
            if (sz.getW(i) > 0.5) {
              rect('fx', [[-half, -half], [half, -half], [-half, half], [half, half]].map(([dx, dz]) => new THREE.Vector3(c.x + dx, c.y, c.z + dz)));
            } else {
              c.applyMatrix4(camera.matrixWorldInverse);
              rect('fx', [[-half, -half], [half, -half], [-half, half], [half, half]].map(([dx, dy]) => new THREE.Vector3(c.x + dx, c.y + dy, c.z).applyMatrix4(camera.matrixWorld)));
            }
          }
        }
      });
      return out;
    };
    return () => { delete w.__fit; };
  }, [scene, camera, size]);
  return null;
}
