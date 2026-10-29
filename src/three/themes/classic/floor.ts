/** GLSL for this table's floor (see TableTheme.floor). */
export const floor = /* glsl */ `
// classic game-show stage: a polished disc with fine turned grooves, light rings pulsing out of the pile,
// a bright stage rim, a ring of chasing LED cells, and faint sunburst rays beyond it
vec3 hot = mix(cIn, vec3(1.0), 0.4);
float stage = smoothstep(7.3, 7.0, r);
// turned grooves catch the light only in the bright middle
col *= 1.0 - 0.05 * stage * smoothstep(0.3, 1.0, sin(r * 11.0)) * smoothstep(7.0, 2.0, r);
// a glossy hot spot under the pile
col += hot * 0.16 * smoothstep(3.2, 0.0, r);
// rings pulsing outward from the pile
float ring = pow(0.5 + 0.5 * sin(r * 1.25 - uTime * 2.2), 28.0);
col += hot * ring * 0.2 * smoothstep(8.0, 1.6, r);
// stage rim with a thin dark gap outside it
col += hot * smoothstep(0.13, 0.0, abs(r - 7.15)) * 0.5;
col *= 1.0 - 0.3 * smoothstep(0.12, 0.0, abs(r - 7.45));
// LED cells between r 7.7 and 8.5: 64 segments, a chase sweeping round
float seg = (a + 3.14159) / 6.28318 * 64.0;
float cellA = smoothstep(0.5, 0.36, abs(fract(seg) - 0.5));
float cellR = smoothstep(0.42, 0.3, abs(r - 8.1));
float chase = pow(0.5 + 0.5 * sin(floor(seg) * 0.785 - uTime * 5.0), 6.0);
col += mix(cIn, hot, chase) * cellA * cellR * (0.12 + 0.55 * chase);
// faint sunburst rays on the arena floor beyond the stage
float rays = step(0.5, fract((a + 3.14159) / 6.28318 * 18.0 + uTime * 0.01));
col *= 1.0 + 0.07 * rays * smoothstep(8.6, 10.0, r) * smoothstep(20.0, 12.0, r);
`;
