import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';

/** Fires once after the first few frames: by then every card texture and shader is on the GPU. */
export function ReadySignal({ onReady }: { onReady?: () => void }) {
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
