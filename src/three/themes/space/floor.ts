/** GLSL for this table's floor (see TableTheme.floor). */
export const floor = /* glsl */ `
// space: a glass observatory deck over a slowly turning galaxy, orbit lines round the pile, twinkling stars
float n = noise(vPos.xz * 0.16 + vec2(uTime * 0.015, 0.0)) * 0.65 + noise(vPos.xz * 0.42 - uTime * 0.02) * 0.35;
col = mix(cOut, cMid, smoothstep(0.3, 0.85, n) * 0.9);
// two spiral arms winding out from the pile, turning slowly
float arm = sin(2.0 * a - log(r + 0.35) * 4.2 + uTime * 0.12);
float arms = smoothstep(0.2, 1.0, arm) * smoothstep(10.0, 2.5, r) * smoothstep(0.5, 2.0, r);
col += mix(cMid, cIn, 0.55) * arms * (0.25 + 0.45 * n);
// the bright galactic core under the pile
col += cIn * 0.2 * smoothstep(3.4, 0.0, r);
// orbits: a solid inner one, a dashed outer one, each with a little planet riding round
float o1 = smoothstep(0.04, 0.0, abs(r - 3.1));
float o2 = smoothstep(0.035, 0.0, abs(r - 5.4)) * step(0.0, sin(a * 32.0 + uTime * 0.3));
col += cIn * (o1 * 0.45 + o2 * 0.3);
vec2 q1 = vec2(cos(uTime * 0.22), sin(uTime * 0.22)) * 3.1;
vec2 q2 = vec2(cos(-uTime * 0.11 + 2.0), sin(-uTime * 0.11 + 2.0)) * 5.4;
float d1 = length(p - q1);
float d2 = length(p - q2);
col += mix(cIn, vec3(1.0), 0.5) * (smoothstep(0.13, 0.05, d1) + smoothstep(0.6, 0.0, d1) * 0.25);
col += mix(cIn, vec3(1.0), 0.3) * (smoothstep(0.1, 0.03, d2) + smoothstep(0.45, 0.0, d2) * 0.2);
// stars at two scales, each twinkling at its own pace
vec2 g = vPos.xz * 2.6;
float h = hash(floor(g));
col += vec3(step(0.975, h) * smoothstep(0.15, 0.0, length(fract(g) - 0.5))) * (0.55 + 0.45 * sin(uTime * (1.2 + h * 3.0) + h * 60.0));
vec2 g2 = vPos.xz * 0.9 + 17.0;
float h2 = hash(floor(g2));
col += mix(cIn, vec3(1.0), 0.6) * step(0.985, h2) * smoothstep(0.08, 0.0, length(fract(g2) - 0.5)) * (0.7 + 0.3 * sin(uTime * 2.0 + h2 * 30.0));
`;
