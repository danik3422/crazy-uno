import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { fxState, nowSec } from '../effects/fxState';
import { CAMERA, PARALLAX_X, cameraFov, type View } from '../layout';

const finePointer = typeof matchMedia !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;

export function CameraRig({ view, finale, focus }: { view: View; finale: boolean; focus: [number, number, number] }) {
  const { camera } = useThree();
  const { portrait, compact } = view;
  const cam0 = portrait ? CAMERA.portrait : CAMERA.landscape;
  const look = useMemo(() => new THREE.Vector3(), []);
  const tmpLook = useMemo(() => new THREE.Vector3(), []);
  const roll = useRef(0);
  useFrame((state, dt) => {
    const cam = camera as THREE.PerspectiveCamera;
    // finale: come down closer and look at the podium
    const base = finale ? (portrait ? [focus[0], 6.2, 11.8] : [focus[0], 4.6, 8.6]) : cam0.pos;
    const fov = cameraFov(view);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * 4);
      cam.updateProjectionMatrix();
    }
    const now = nowSec();
    let sx = 0;
    let sy = 0;
    if (now < fxState.shakeUntil) {
      const a = fxState.shakeAmp * ((fxState.shakeUntil - now) / 0.5);
      sx = (Math.random() - 0.5) * a;
      sy = (Math.random() - 0.5) * a;
    }
    // a gentle sway around the podium, otherwise a light parallax that follows the pointer
    const orbit = finale ? Math.sin((now - fxState.winAt) * 0.35) * 0.25 : 0;
    // parallax only with a mouse: on touch screens the pointer jumps to every tap and the whole table would twitch
    const px = finePointer ? state.pointer.x * PARALLAX_X : 0;
    const py = finePointer ? state.pointer.y * 0.2 : 0;
    const tx = base[0] + px + Math.sin(orbit) * base[2] + sx;
    const tz = base[2] * Math.cos(orbit);
    cam.position.x += (tx - cam.position.x) * Math.min(1, dt * 3);
    cam.position.y += (base[1] + py + sy - cam.position.y) * Math.min(1, dt * 3);
    cam.position.z += (tz - cam.position.z) * Math.min(1, dt * 3);
    // on phones the results sheet takes the lower half, so aim low and lift the podium up the screen
    // lying on its side the results sit on the right, so the podium moves into the left half
    if (finale) look.lerp(tmpLook.set(focus[0] + (compact ? 2.1 : 0), portrait ? -1.2 : compact ? 0.9 : 0.75, focus[2]), Math.min(1, dt * 2.5));
    else look.lerp(tmpLook.set(cam0.look[0], cam0.look[1], cam0.look[2]), Math.min(1, dt * 4));
    cam.lookAt(look);
    // "upside down" event: roll the whole view over
    roll.current += ((now < fxState.upsideUntil ? Math.PI : 0) - roll.current) * Math.min(1, dt * 2.2);
    if (Math.abs(roll.current) > 0.001) cam.rotateZ(roll.current);
  });
  return null;
}
