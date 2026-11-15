import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { DISPLAY, Unmirror, useCanvasTexture } from './label';

/*
 * «Яйця по 17»: the tender van carries a giant golden egg rocking on a velvet cushion, a price tag hanging off
 * its ribbon, and a carton of six more golden eggs behind it.
 */

const ROOF = 1.44;
const EGG_H = 0.8;
const EGG_R = 0.28;

/** egg radius at height y (0 bottom .. EGG_H top): wider low down */
function eggR(theta: number) {
  return Math.sin(theta) * EGG_R * (1 + 0.13 * Math.cos(theta));
}

function makeEgg() {
  const pts: THREE.Vector2[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI;
    pts.push(new THREE.Vector2(Math.max(0.0001, eggR(th)), (1 - Math.cos(th)) * (EGG_H / 2)));
  }
  return new THREE.LatheGeometry(pts, 32);
}

function drawTag(c: CanvasRenderingContext2D, w: number, h: number) {
  // a cream tag with a cut corner end and a punched hole, the price in red
  c.fillStyle = '#fff8e2';
  c.beginPath();
  c.moveTo(h * 0.35, 4);
  c.lineTo(w - 6, 4);
  c.lineTo(w - 6, h - 4);
  c.lineTo(h * 0.35, h - 4);
  c.lineTo(4, h / 2);
  c.closePath();
  c.fill();
  c.lineWidth = 5;
  c.strokeStyle = '#b8862a';
  c.stroke();
  c.globalCompositeOperation = 'destination-out';
  c.beginPath();
  c.arc(h * 0.3, h / 2, h * 0.09, 0, Math.PI * 2);
  c.fill();
  c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#c4161c';
  c.font = `900 ${h * 0.56}px ${DISPLAY}`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('17 ₴', w * 0.58, h * 0.54);
}

export function EggsRoof() {
  const egg = useMemo(makeEgg, []);
  useEffect(() => () => egg.dispose(), [egg]);
  const tag = useCanvasTexture(256, 140, drawTag);
  const big = useRef<THREE.Group>(null!);
  const tagSwing = useRef<THREE.Group>(null!);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    big.current.rotation.z = Math.sin(t * 1.4) * 0.13;
    big.current.rotation.x = Math.sin(t * 0.9) * 0.05;
    tagSwing.current.rotation.x = 0.15 + Math.sin(t * 2.2 + 0.6) * 0.18;
    tagSwing.current.rotation.z = -Math.sin(t * 1.4 - 0.4) * 0.2;
  });
  const gold = <meshStandardMaterial color="#f0c030" metalness={0.75} roughness={0.22} emissive="#7a5200" emissiveIntensity={0.45} />;
  // the ribbon round the egg's waist
  const ribbonY = EGG_H * 0.36;
  const ribbonR = eggR(Math.acos(1 - (2 * ribbonY) / EGG_H)) + 0.008;
  return (
    <group>
      {/* the velvet cushion with gold tassels */}
      <RoundedBox args={[0.72, 0.13, 0.66]} radius={0.06} smoothness={3} position={[-0.38, ROOF + 0.065, 0]}>
        <meshStandardMaterial color="#9b1b30" roughness={0.95} />
      </RoundedBox>
      {[[-0.72, 0.31], [-0.72, -0.31], [-0.04, 0.31], [-0.04, -0.31]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, ROOF + 0.06, z]}>
          <sphereGeometry args={[0.035, 8, 6]} />
          {gold}
        </mesh>
      ))}
      {/* the giant egg, rocking on its bottom */}
      <group ref={big} position={[-0.38, ROOF + 0.115, 0]}>
        <mesh geometry={egg} castShadow>
          {gold}
        </mesh>
        <mesh position-y={ribbonY} rotation-x={Math.PI / 2}>
          <torusGeometry args={[ribbonR, 0.014, 6, 32]} />
          <meshStandardMaterial color="#c4161c" roughness={0.5} />
        </mesh>
        {/* the price tag on a string from the ribbon, hanging by its hole, facing out the door side */}
        <group ref={tagSwing} position={[0.04, ribbonY, ribbonR]}>
          <mesh position-y={-0.035}>
            <cylinderGeometry args={[0.004, 0.004, 0.07, 4]} />
            <meshStandardMaterial color="#e9e2cf" />
          </mesh>
          <Unmirror position={[0.12, -0.114, 0.01]} rotation-z={-0.35}>
            {[1, -1].map(s => (
              <mesh key={s} position-z={s * 0.002} rotation-y={s > 0 ? 0 : Math.PI}>
                <planeGeometry args={[0.38, 0.21]} />
                <meshStandardMaterial map={tag} transparent alphaTest={0.4} roughness={0.8} />
              </mesh>
            ))}
          </Unmirror>
        </group>
      </group>
      {/* a carton of six more */}
      <group position={[0.85, ROOF, 0]}>
        <mesh position-y={0.04}>
          <boxGeometry args={[0.66, 0.08, 0.46]} />
          <meshStandardMaterial color="#b9ad97" roughness={1} />
        </mesh>
        {[-0.22, 0, 0.22].flatMap(x =>
          [-0.11, 0.11].map(z => (
            <mesh key={`${x}${z}`} geometry={egg} position={[x, 0.05, z]} scale={0.24} castShadow>
              {gold}
            </mesh>
          )),
        )}
      </group>
    </group>
  );
}
