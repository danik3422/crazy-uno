import { POINT_SIZE } from './bits';

/** what each point of the decor's point cloud is */
export const LIGHT = { flake: 0, burst: 1, fairy: 2, lantern: 3 } as const;

/**
 * Snow, bursts, fairy lights and lantern flames: one point cloud, all animated on the GPU.
 * Falling snow is drawn only where the screen is free — the top band and the outer edges (uMask, in NDC) —
 * and fades out smoothly as a flake drifts toward the play area, so nothing ever falls over the cards.
 * Flakes are small hard-edged discs (anti-aliased over one pixel, never smaller than ~1.5 px) so they stay crisp.
 */
export const snowVert = /* glsl */ `
  attribute float aKind;
  attribute float aSeed;
  attribute vec3 aDir;
  attribute vec3 aColor;
  uniform float uTime;
  uniform vec4 uBurst;
  uniform float uSpread;
  uniform float uLights;
  uniform vec3 uBox;
  uniform vec2 uMask;
  varying float vAlpha;
  varying float vKind;
  varying float vPx;
  varying vec3 vColor;
  ${POINT_SIZE}
  void main() {
    vec3 p = position;
    float size = 0.0;
    vAlpha = 1.0;
    vColor = vec3(0.94, 0.97, 1.0);
    if (aKind < 0.5) {
      // falling snow, drifting gently from side to side
      p.y = mod(position.y - uTime * (0.3 + aSeed * 0.32), uBox.y);
      float ph = aSeed * 40.0;
      p.x += sin(uTime * (0.32 + aSeed * 0.4) + ph) * 0.35;
      p.z += cos(uTime * (0.24 + aSeed * 0.2) + ph * 0.5) * 0.2;
      size = 0.032 + aSeed * aSeed * 0.05;
      vAlpha = 0.9 * smoothstep(0.0, 0.5, p.y) * smoothstep(uBox.y, uBox.y - 1.0, p.y);
    } else if (aKind < 1.5) {
      // a burst of flakes thrown out of a clicked thing, then settling down
      float t = uTime - uBurst.w;
      if (t > 0.0 && t < 1.6) {
        float k = t / 1.6;
        p = uBurst.xyz + aDir * (1.0 - pow(1.0 - min(1.0, t / 0.9), 3.0)) * uSpread;
        p.y = max(0.05, p.y - 0.5 * t * t);
        size = 0.06 + aSeed * 0.06;
        vAlpha = 1.0 - k * k;
      }
    } else if (aKind < 2.5) {
      // fairy lights: twinkling, flaring when the cabin lights come on
      float tw = 0.6 + 0.4 * sin(uTime * (1.5 + aSeed * 2.0) + aSeed * 30.0);
      size = 0.16 * (1.0 + uLights * 0.5);
      vAlpha = tw * (0.8 + uLights);
      vColor = aColor;
    } else {
      // a lantern's flame: a steady glow with a candle's small flicker
      float fl = 0.92 + 0.05 * sin(uTime * 7.3 + aSeed * 20.0) + 0.03 * sin(uTime * 13.7 + aSeed * 9.0);
      size = 0.75 * fl;
      vAlpha = fl;
      vColor = aColor;
    }
    vKind = aKind;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float px = size > 0.0 ? pointPx(mv, size) : 0.0;
    if (aKind < 0.5) {
      vec2 ndc = gl_Position.xy / gl_Position.w;
      vAlpha *= max(smoothstep(uMask.x, uMask.x + 0.16, ndc.y), smoothstep(uMask.y, uMask.y + 0.1, abs(ndc.x)));
      // below ~1.5 px a disc shimmers: draw it at 1.5 px and fainter instead
      vAlpha *= min(1.0, px / 1.5);
      px = vAlpha < 0.01 ? 0.0 : max(px, 1.5);
    }
    vPx = px;
    gl_PointSize = px;
  }
`;

export const snowFrag = /* glsl */ `
  varying float vAlpha;
  varying float vKind;
  varying float vPx;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5) * 2.0;
    float aa = 2.0 / max(vPx, 1.0);
    if (vKind < 1.5) {
      // a hard-edged disc with a slightly brighter heart (premultiplied: it covers what is behind)
      float a = (1.0 - smoothstep(1.0 - aa, 1.0, d)) * vAlpha;
      gl_FragColor = vec4(vColor * (0.9 + 0.1 * (1.0 - d)) * a, a);
    } else {
      // a light: a crisp hot core and a small halo, added on top (alpha 0)
      float core = 1.0 - smoothstep(0.3 - aa, 0.3, d);
      float halo = pow(max(0.0, 1.0 - d), 2.4) * 0.5;
      vec3 c = mix(vColor, vec3(1.0, 0.97, 0.9), core * 0.65) * (core + halo);
      gl_FragColor = vec4(c * vAlpha, 0.0);
    }
  }
`;
