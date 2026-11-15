/**
 * Track radius of the marquee bulbs, in floor units around the pile (the floor squashes z by FLOOR_Z).
 * Decor.tsx seats its bulbs exactly in the floor's dark track at this radius.
 */
export const MARQUEE_R = 8.42;
/** the floor shader stretches world z by this much before measuring r (see Environment.tsx) */
export const FLOOR_Z = 1.45;

/**
 * GLSL for this table's floor (see TableTheme.floor).
 *
 * A game-show stage read in three layers, calm in the middle and richer toward the edge:
 *  1. the play area (r < 4.6): a clean satin gradient in the current colour, nothing but a slow breath of
 *     light, so the pile and the cards on it always pop; a hairline inlay frames it outside the arrow ring;
 *  2. the seat band (4.6 – 7.45): the full colour deepening toward the rim, plain under the opponents' fans;
 *  3. the stage rim: a polished gold bevel with a glint that circles slowly, a dark lacquered track where the
 *     marquee bulbs sit (Decor.tsx), a thin outer trim, and past it the dark stage floor with soft sunburst
 *     rays that two searchlights sweep round the back — never inside the rim, so never under cards.
 * Every edge is antialiased with fwidth so the rings stay crisp, not stair-stepped or smeared, at any angle.
 */
export const floor = /* glsl */ `
float aa = max(fwidth(r), 1e-4);
vec3 hi = mix(cIn, vec3(1.0), 0.45);

// 1. play area: satin gradient, light in the middle without going white (no glare under the pile)
col = mix(cIn, cMid, smoothstep(0.3, 5.4, r));
col = mix(col, cMid * 0.7, smoothstep(5.2, 7.5, r));
col += hi * (0.05 + 0.025 * sin(uTime * 1.1)) * smoothstep(3.8, 0.0, r);
// the hairline inlay round the play area, just outside the direction arrows
col = mix(col, hi, 0.4 * (1.0 - smoothstep(0.022 - aa, 0.022 + aa, abs(r - 4.6))));

// 2. seat band: a soft inner shadow builds toward the rim, as if the bevel stood up out of the floor
col *= 1.0 - 0.2 * smoothstep(6.6, 7.45, r);

// 3a. the gold bevel: a narrow rounded rail, dark at its feet and bright along the crest, lit from the back-left,
// with a glint running slowly round it
float bev = smoothstep(7.45 - aa, 7.45 + aa, r) * (1.0 - smoothstep(7.71 - aa, 7.71 + aa, r));
float bt = clamp((r - 7.45) / 0.26, 0.0, 1.0);
float shade = 0.3 + 0.7 * pow(sin(bt * 3.14159), 0.7);
float key = 0.8 + 0.2 * sin(a + 1.1);
float glint = pow(max(0.0, cos(a - uTime * 0.32)), 90.0) + pow(max(0.0, cos(a + 3.14159 - uTime * 0.32)), 90.0);
vec3 gold = vec3(1.0, 0.74, 0.3);
vec3 rail = gold * shade * key + vec3(1.0, 0.95, 0.8) * (0.35 * smoothstep(0.75, 1.0, shade) + 0.7 * glint) * shade;
col = mix(col, rail, bev);

// 3b. the marquee track: a dark lacquered channel (the bulbs in Decor.tsx sit on its centre line), with a
// faint wash of the colour under the bulbs, so the stage edge reads clearly against both floors around it
vec3 track = cOut * 0.9 + cMid * 0.08;
track += cMid * 0.16 * exp(-pow((r - ${MARQUEE_R.toFixed(2)}) / 0.28, 2.0));
float inTrack = smoothstep(7.71 - aa, 7.71 + aa, r) * (1.0 - smoothstep(9.1 - aa, 9.1 + aa, r));
col = mix(col, track, inTrack);

// 3c. a thin outer trim
float trim = smoothstep(9.1 - aa, 9.1 + aa, r) * (1.0 - smoothstep(9.2 - aa, 9.2 + aa, r));
col = mix(col, gold * 0.62 * key, trim);

// 3d. the stage floor beyond, a step lighter than the track: slow sunburst rays in the colour
// (all of it outside the rim, so never under a card)
float beyond = smoothstep(9.2 - aa, 9.2 + aa, r);
vec3 stage = mix(cMid * 0.42, cOut, smoothstep(9.4, 16.0, r));
float ang = (a + 3.14159) / 6.28318 * 24.0 + uTime * 0.012;
float aw = min(fwidth(ang), 0.08);
float ray = smoothstep(0.24 + aw, 0.24 - aw, abs(fract(ang) - 0.5));
stage *= 1.0 + 0.24 * ray * smoothstep(9.3, 10.3, r) * smoothstep(19.0, 12.0, r);
// two searchlights sweep the rays round the back: a ray lights up as a beam passes over it (no blobs of light)
float beam = 0.0;
for (int k = 0; k < 2; k++) {
  float pa = -1.5708 + sin(uTime * (0.21 + 0.06 * float(k)) + float(k) * 2.6) * 1.3;
  beam += pow(max(0.0, cos(a - pa)), 30.0);
}
stage += mix(cMid, hi, 0.25) * 0.32 * min(beam, 1.0) * (0.35 + 0.65 * ray) * smoothstep(9.4, 10.6, r) * smoothstep(20.0, 12.0, r);
col = mix(col, stage, beyond);
`;
