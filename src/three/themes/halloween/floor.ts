/** GLSL for this table's floor (see TableTheme.floor). */
export const floor = /* glsl */ `
// halloween: a spider web spun around the pile, a faint rune circle, coloured fog creeping over old flagstones
// web: wobbly spokes and sagging threads, fading out toward the edges
float spokes = smoothstep(0.07, 0.0, abs(sin(a * 6.0 + 0.3)) * r * 0.12);
float sag = r + 0.22 * abs(sin(a * 6.0 + 0.3));
float rings = smoothstep(0.46, 0.5, abs(fract(sag / 1.25) - 0.5));
float web = max(spokes, rings) * smoothstep(12.0, 3.6, r) * smoothstep(1.6, 2.6, r);
col += vec3(0.82, 0.78, 0.92) * web * 0.2;
// old stone tiles, barely there
vec2 tile = abs(fract(vPos.xz * 0.42) - 0.5);
col *= 1.0 - smoothstep(0.46, 0.5, max(tile.x, tile.y)) * 0.18 * smoothstep(3.5, 7.0, r);
// a slowly turning rune circle just outside the direction ring
float ra = a + uTime * 0.05;
float band = smoothstep(0.05, 0.0, abs(r - 5.3)) + smoothstep(0.05, 0.0, abs(r - 5.95));
float cell = floor(ra * 7.6394);
float rune = step(0.45, hash(vec2(cell, 3.0))) * step(abs(fract(ra * 7.6394) - 0.5), 0.18) * step(abs(r - 5.62), 0.17);
float flick = 0.75 + 0.25 * sin(uTime * 2.3 + cell);
col += mix(cIn, vec3(0.55, 1.0, 0.45), 0.35) * (band * 0.28 + rune * 0.32 * flick);
// ground fog creeping in from the dark, in the colour of play
float fog = noise(vPos.xz * 0.22 + vec2(uTime * 0.06, uTime * 0.025)) * noise(vPos.xz * 0.5 - vec2(uTime * 0.04, 0.0));
col += mix(cIn * 0.7, vec3(0.45, 0.4, 0.62), 0.5) * fog * 0.32 * smoothstep(4.0, 10.0, r);
// a glow under the pile and a thin coloured rim around it
col += cIn * smoothstep(0.12, 0.0, abs(r - 3.1)) * 0.4;
`;
