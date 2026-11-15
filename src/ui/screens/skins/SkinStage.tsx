import { Canvas, useThree } from '@react-three/fiber';
import { useLayoutEffect } from 'react';
import type { MascotSkin, VanSkin } from '../../../game/skins';
import { useGlRecovery } from '../../../three/hooks/useGlRecovery';
import { Mascot } from '../../../three/mascot/Mascot';
import { VanShowcase } from '../../../three/van/VanShowcase';

/** points the camera at the van's middle (the Canvas camera prop only places it) */
function LookAt({ y }: { y: number }) {
  const camera = useThree(s => s.camera);
  useLayoutEffect(() => camera.lookAt(0, y, 0), [camera, y]);
  return null;
}

/** The skins tab's live preview: the mascot doing laps, or the van on a turntable. */
export default function SkinStage({ kind, skin }: { kind: 'mascot' | 'van'; skin: MascotSkin | VanSkin }) {
  const { glKey, onCreated } = useGlRecovery();
  return (
    <Canvas
      key={glKey}
      onCreated={onCreated}
      // a small decoration on a menu: 2× is plenty sharp
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, stencil: false }}
      camera={kind === 'mascot' ? { fov: 30, position: [0, 1.4, 8.5] } : { fov: 35, position: [0, 1.6, 6.2] }}
    >
      {kind === 'mascot' ? (
        <>
          <ambientLight intensity={0.95} />
          <directionalLight position={[3, 5, 6]} intensity={1.7} />
          <hemisphereLight args={['#fff4dc', '#3a1450', 0.5]} />
          <group position={[0, 0.2, 0]}>
            <Mascot mode="orbit" scale={0.8} orbit={[2.6, 1.6]} skin={skin as MascotSkin} />
          </group>
        </>
      ) : (
        <>
          <LookAt y={0.8} />
          <VanShowcase skin={skin as VanSkin} />
        </>
      )}
    </Canvas>
  );
}
