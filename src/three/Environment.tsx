import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { Color, ThemeId } from '../game/types';
import { DEBUG, fxState, nowSec } from './fxState';
import { landingTime } from './PlayFx';
import type { View } from './layout';
import { THEMES } from './themes';
import { setBrowserTint } from '../ui/hooks/pageTheme';
import { isPhone } from '../ui/hooks/phone';

/** Arena colours for every theme and current colour (each theme keeps its own in its folder). */
export const PALETTES = Object.fromEntries(Object.entries(THEMES).map(([id, t]) => [id, t.palette])) as Record<ThemeId, (typeof THEMES)[ThemeId]['palette']>;

const vert = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vec4 w = modelMatrix * vec4(position, 1.0);
    vPos = w.xyz;
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

// One floor shader, four looks: stage glow, synthwave grid, nebula with stars, spider web.
// A new colour does not fade in everywhere at once: it spreads from the pile as a wave (uWave = its front).
const fragFor = (floor: string) => /* glsl */ `
  uniform vec3 cIn;
  uniform vec3 cMid;
  uniform vec3 cOut;
  uniform vec3 oIn;
  uniform vec3 oMid;
  uniform vec3 oOut;
  uniform float uWave;
  uniform vec3 uRim;
  uniform float uTime;
  uniform vec2 uCenter;
  varying vec3 vPos;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  // the table's own floor for one palette (the parameters stand in for the uniforms of the same name)
  vec3 floorCol(vec3 cIn, vec3 cMid, vec3 cOut, vec2 p, float r, float a) {
    vec3 col = mix(cIn, cMid, smoothstep(0.0, 5.0, r));
    col = mix(col, cOut, smoothstep(4.5, 17.0, r));
    {
${floor}
    }
    return col;
  }

  void main() {
    vec2 p = vPos.xz - uCenter;
    p.y *= 1.45;
    float r = length(p);
    float a = atan(p.y, p.x);
    vec3 col = floorCol(cIn, cMid, cOut, p, r, a);
    if (uWave < 60.0) {
      // outside the front the old colour; a wobbly, glowing edge like spreading paint
      float edge = r - uWave + (noise(vec2(a * 3.0, uTime * 0.7)) - 0.5) * 0.9;
      vec3 old = floorCol(oIn, oMid, oOut, p, r, a);
      col = mix(col, old, smoothstep(-0.15, 0.35, edge));
      col += uRim * exp(-edge * edge * 5.0) * smoothstep(0.0, 1.5, uWave) * (1.0 - smoothstep(14.0, 22.0, uWave));
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

interface Props {
  color: Color;
  theme: ThemeId;
  view: View;
  center: [number, number];
}

/** the colour wave: seconds to sweep the table, and how far its front goes (floor units, past the screen edges) */
const WAVE_TIME = 0.8;
/** longest a new colour waits for its card to land */
const WAVE_WAIT = 0.5;
const WAVE_REACH = 24;

/** phones get the light version of every table */
const LITE = isPhone();

export function Arena({ color, theme, view, center }: Props) {
  const { scene } = useThree();
  const T = THEMES[theme];
  const pal = T.palette[color];
  const fragment = useMemo(() => fragFor(T.floor), [T]);
  const Decor = T.Decor;
  // created once; colours and mode follow the props inside useFrame
  const uniforms = useMemo(
    () => ({
      cIn: { value: new THREE.Color(pal.inner) },
      cMid: { value: new THREE.Color(pal.mid) },
      cOut: { value: new THREE.Color(pal.outer) },
      oIn: { value: new THREE.Color(pal.inner) },
      oMid: { value: new THREE.Color(pal.mid) },
      oOut: { value: new THREE.Color(pal.outer) },
      uWave: { value: 100 },
      uRim: { value: new THREE.Color() },
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector2(...center) },
    }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const tmp = useMemo(() => new THREE.Color(), []);
  /** when the current wave starts (perf seconds); Infinity while it waits for the card to land */
  const waveAt = useRef(-100);
  /** a new colour came at this moment and waits for the card to land (null: nothing waiting) */
  const armedAt = useRef<number | null>(null);
  const shownColor = useRef(color);
  const paintSeq = useRef(fxState.paint.seq);
  const palRef = useRef(pal);
  palRef.current = pal;
  if (DEBUG) (window as unknown as { __arena?: unknown }).__arena = { uniforms, scene, pal: () => palRef.current };

  /** starts a wave: the new colour (or the same one, as a pulse) spreads from the pile */
  const arm = () => {
    const p = palRef.current;
    // if the last wave had not even started, the floor still shows its old colour: keep that as "old"
    if (armedAt.current === null) {
      uniforms.oIn.value.copy(uniforms.cIn.value);
      uniforms.oMid.value.copy(uniforms.cMid.value);
      uniforms.oOut.value.copy(uniforms.cOut.value);
    }
    uniforms.cIn.value.set(p.inner);
    uniforms.cMid.value.set(p.mid);
    uniforms.cOut.value.set(p.outer);
    uniforms.uRim.value.set(p.inner).multiplyScalar(0.6);
    armedAt.current = nowSec();
    waveAt.current = Infinity;
  };

  useEffect(() => {
    if (shownColor.current === color) return;
    shownColor.current = color;
    arm();
  }, [color]); // eslint-disable-line react-hooks/exhaustive-deps

  // the browser bars on a phone take the arena's dark edge, and go back to the menu red when the game ends
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', pal.outer);
    document.documentElement.style.setProperty('--page-edge', pal.outer);
  }, [pal.outer]);
  useEffect(() => () => setBrowserTint('classic'), []);

  useLayoutEffect(() => {
    scene.background = new THREE.Color(pal.outer);
    scene.fog = new THREE.Fog(pal.outer, 18, 42);
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((st, dt) => {
    const now = nowSec();
    const p = palRef.current;
    // a colour was picked that the table already had: still a visible pulse, so the pick registers
    if (fxState.paint.seq !== paintSeq.current) {
      paintSeq.current = fxState.paint.seq;
      if (armedAt.current === null && shownColor.current === color) arm();
    }
    if (armedAt.current !== null) {
      // wait for the card to touch the pile, but never longer than WAVE_WAIT: the colour must always arrive
      const at = landingTime(armedAt.current, now) ?? (now - armedAt.current > WAVE_WAIT ? now : null);
      if (at !== null) {
        waveAt.current = Math.min(at, armedAt.current + WAVE_WAIT);
        armedAt.current = null;
      }
    }
    const wt = now - waveAt.current;
    const bg = scene.background as THREE.Color;
    if (wt > WAVE_TIME) {
      // done: exactly the palette, everywhere
      uniforms.uWave.value = 100;
      uniforms.cIn.value.set(p.inner);
      uniforms.cMid.value.set(p.mid);
      uniforms.cOut.value.set(p.outer);
      uniforms.oIn.value.copy(uniforms.cIn.value);
      uniforms.oMid.value.copy(uniforms.cMid.value);
      uniforms.oOut.value.copy(uniforms.cOut.value);
      bg.set(p.outer);
      scene.fog?.color.set(p.outer);
    } else {
      uniforms.uWave.value = wt < 0 ? -2 : WAVE_REACH * (1 - Math.pow(1 - wt / WAVE_TIME, 2.4));
      // the sky follows the wave
      if (wt >= 0) {
        const k = Math.min(1, dt * 4);
        bg.lerp(tmp.set(p.outer), k);
        scene.fog?.color.lerp(tmp, k);
      }
    }
    uniforms.uTime.value = st.clock.elapsedTime;
    uniforms.uCenter.value.set(center[0], center[1]);
  });

  return (
    <>
      {/* drawn first and without depth: the faint reflections of the opponents' cards show on it */}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} renderOrder={-100}>
        <planeGeometry args={[90, 90]} />
        <shaderMaterial key={theme} vertexShader={vert} fragmentShader={fragment} uniforms={uniforms} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <shadowMaterial opacity={T.shadowOpacity} />
      </mesh>
      <Decor accent={pal.accent} portrait={view.portrait} lite={LITE} />
    </>
  );
}

