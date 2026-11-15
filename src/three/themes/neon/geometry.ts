import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const UP = new THREE.Vector3(0, 1, 0);

/** the edges of a polyhedron as thin tubes, merged into one mesh: crisp neon lines with no line-width limits */
function tubeEdges(src: THREE.BufferGeometry, radius: number) {
  const edges = new THREE.EdgesGeometry(src);
  const pos = edges.getAttribute('position');
  const parts: THREE.BufferGeometry[] = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const q = new THREE.Quaternion();
  for (let i = 0; i < pos.count; i += 2) {
    a.fromBufferAttribute(pos, i);
    b.fromBufferAttribute(pos, i + 1);
    const c = new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 6, 1, true);
    q.setFromUnitVectors(UP, dir.subVectors(b, a).normalize());
    c.applyQuaternion(q);
    c.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    parts.push(c);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  edges.dispose();
  src.dispose();
  return merged;
}

let geos: { ico: THREE.BufferGeometry; gyro: THREE.BufferGeometry; pad: THREE.BufferGeometry; hit: THREE.BufferGeometry } | null = null;

/** The holograms' shared geometry, built once on first use. */
export function holoGeos() {
  if (geos) return geos;
  // a gyroscope: three tube rings at right angles
  const r1 = new THREE.TorusGeometry(0.5, 0.022, 6, 48);
  const r2 = r1.clone().rotateX(Math.PI / 2);
  const r3 = r1.clone().rotateY(Math.PI / 2).scale(0.78, 0.78, 0.78);
  const gyro = mergeGeometries([r1, r2, r3])!;
  [r1, r2, r3].forEach((g) => g.dispose());
  // the projector pad under each: two thin concentric rings flat on the floor
  const p1 = new THREE.RingGeometry(0.5, 0.53, 48);
  const p2 = new THREE.RingGeometry(0.66, 0.675, 48);
  const pad = mergeGeometries([p1, p2])!.rotateX(-Math.PI / 2);
  [p1, p2].forEach((g) => g.dispose());
  geos = {
    ico: tubeEdges(new THREE.IcosahedronGeometry(0.52, 0), 0.022),
    gyro,
    pad,
    hit: new THREE.SphereGeometry(0.85, 8, 6),
  };
  return geos;
}
