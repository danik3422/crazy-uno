import * as THREE from 'three';

/*
 * The planet, its moon and its rings are drawn procedurally in their own shaders: no textures to blur when
 * they are seen small or at an angle, crisp at any screen size, one draw call each. They ignore the scene's
 * fog and lights on purpose (they are far beyond the table), and light themselves from one fixed sun, with
 * an atmosphere rim in the table's current colour.
 */

/** where the sun is (world space): high above and behind, so the planet's upper limb is lit and it sinks into night towards the table */
const SUN = new THREE.Vector3(-0.35, 0.75, -0.55).normalize();

const NOISE = /* glsl */ `
  float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float n3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(h3(i), h3(i + vec3(1, 0, 0)), f.x), mix(h3(i + vec3(0, 1, 0)), h3(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(h3(i + vec3(0, 0, 1)), h3(i + vec3(1, 0, 1)), f.x), mix(h3(i + vec3(0, 1, 1)), h3(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }
`;

const bodyVert = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vN;
  varying vec3 vView;
  void main() {
    vObj = normalize(position);
    vec4 w = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vView = normalize(cameraPosition - w.xyz);
    gl_Position = projectionMatrix * viewMatrix * w;
  }
`;

const bodyFrag = /* glsl */ `
  uniform vec3 uSun;
  uniform vec3 uAccent;
  uniform vec3 c0;
  uniform vec3 c1;
  uniform vec3 c2;
  uniform vec3 c3;
  uniform float uBands;
  uniform float uCraters;
  uniform float uGlow;
  varying vec3 vObj;
  varying vec3 vN;
  varying vec3 vView;
  ${NOISE}
  void main() {
    vec3 o = vObj;
    // gas bands: latitude, bent by a little turbulence so they swirl instead of looking ruled
    float turb = n3(o * 3.0) * 0.6 + n3(o * 7.0) * 0.4;
    float lat = o.y + (turb - 0.5) * 0.12;
    float b = sin(lat * uBands) * 0.5 + 0.5;
    float b2 = sin(lat * uBands * 2.3 + 1.7) * 0.5 + 0.5;
    vec3 col = mix(c0, c1, smoothstep(0.25, 0.75, b));
    col = mix(col, c2, smoothstep(0.55, 0.95, b2) * 0.7);
    // a storm, sitting on one band
    float storm = smoothstep(0.32, 0.12, length(o - normalize(vec3(0.6, -0.28, 0.75))));
    col = mix(col, c3, storm * step(1.0, uBands));
    // craters (the moon)
    float cr = n3(o * 9.0) * 0.6 + n3(o * 21.0) * 0.4;
    col *= 1.0 - uCraters * smoothstep(0.55, 0.75, cr) * 0.45;
    vec3 n = normalize(vN);
    float d = dot(n, uSun);
    float lit = smoothstep(-0.12, 0.65, d);
    float rim = pow(1.0 - max(dot(n, normalize(vView)), 0.0), 3.0);
    vec3 c = col * (0.035 + lit * 1.05);
    // the night side picks up a little of the table's colour; the atmosphere glows in it at the edge
    c += uAccent * 0.05 * (1.0 - lit);
    c += uAccent * rim * (0.25 + lit * 0.9) * uGlow;
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface BodyLook { c0: string; c1: string; c2: string; c3: string; bands: number; craters: number }

export const GIANT: BodyLook = { c0: '#e8c49a', c1: '#b8664a', c2: '#f6e2c4', c3: '#8a3438', bands: 22, craters: 0 };
export const MOON: BodyLook = { c0: '#a8acbc', c1: '#8a8ea0', c2: '#c4c8d4', c3: '#8a8ea0', bands: 0, craters: 1 };

export function bodyMaterial(look: BodyLook) {
  return new THREE.ShaderMaterial({
    vertexShader: bodyVert,
    fragmentShader: bodyFrag,
    uniforms: {
      uSun: { value: SUN },
      uAccent: { value: new THREE.Color() },
      c0: { value: new THREE.Color(look.c0) },
      c1: { value: new THREE.Color(look.c1) },
      c2: { value: new THREE.Color(look.c2) },
      c3: { value: new THREE.Color(look.c3) },
      uBands: { value: look.bands },
      uCraters: { value: look.craters },
      uGlow: { value: 1 },
    },
  });
}

const ringVert = /* glsl */ `
  varying vec2 vXY;
  void main() {
    vXY = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const ringFrag = /* glsl */ `
  uniform float uIn;
  uniform float uOut;
  uniform vec3 uTint;
  uniform float uFlash;
  uniform float uOpacity;
  varying vec2 vXY;
  float h1(float x) { return fract(sin(x * 91.17) * 43758.5453); }
  void main() {
    float r = length(vXY);
    float t = (r - uIn) / (uOut - uIn);
    // many thin ringlets of different density, a clear gap two thirds out, soft inner and outer edges
    float k = t * 46.0;
    float dens = mix(h1(floor(k)), h1(floor(k) + 1.0), smoothstep(0.2, 0.8, fract(k)));
    dens = 0.25 + 0.75 * dens;
    dens *= smoothstep(0.0, 0.06, t) * smoothstep(1.0, 0.9, t);
    dens *= 1.0 - smoothstep(0.012, 0.0, abs(t - 0.66) - 0.025) * 0.92;
    dens *= 0.8 + 0.2 * sin(t * 140.0);
    vec3 col = mix(vec3(0.92, 0.86, 0.78), uTint, 0.35 + 0.3 * t) * (0.75 + uFlash * 0.9);
    gl_FragColor = vec4(col, dens * uOpacity);
    #include <colorspace_fragment>
  }
`;

export function ringMaterial(inner: number, outer: number) {
  return new THREE.ShaderMaterial({
    vertexShader: ringVert,
    fragmentShader: ringFrag,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uIn: { value: inner },
      uOut: { value: outer },
      uTint: { value: new THREE.Color() },
      uFlash: { value: 0 },
      uOpacity: { value: 0.85 },
    },
  });
}
