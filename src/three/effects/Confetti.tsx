import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';

/** Confetti raining over the finale. Always mounted (hidden and idle until `active`), restarts each time it turns on. */
export function Confetti({ active }: { active: boolean }) {
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
