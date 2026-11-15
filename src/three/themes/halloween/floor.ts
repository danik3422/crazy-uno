/** GLSL for this table's floor (see TableTheme.floor). */
export const floor = /* glsl */ `
// halloween: a calm pool of witch-light in the colour of play under the cards, its rim dripping like slime;
// around it dark old flagstones, a slowly turning rune circle on the far side, mist creeping in from the edge
// and a cobweb only far out in the dark. Nothing busy under the cards: the middle is smooth on purpose.
const float R = 4.85;
vec3 hot = mix(cIn, vec3(1.0), 0.28);

// the edge of the pool drips inward: wobbly, slowly breathing drops of slime
float k = a * 12.0 + sin(a * 5.0) * 0.9;
float drop = pow(0.5 + 0.5 * sin(k), 14.0) * (0.55 + 0.45 * hash(vec2(floor(k / 6.2832 + 0.25), 4.0)));
float edge = R - 0.42 * drop * (0.85 + 0.15 * sin(uTime * 0.9 + floor(k / 6.2832) * 2.1)) - 0.05 * sin(a * 3.0 + uTime * 0.2);
float inPool = smoothstep(edge + 0.04, edge - 0.04, r);

// inside: bright under the pile, deep toward the rim, with a faint velvet mottling so it is not flat plastic
float vel = noise(vPos.xz * 0.32 + vec2(uTime * 0.025, -uTime * 0.018));
vec3 pool = mix(cIn * 0.95, mix(cIn, cMid, 0.35) * 0.7, smoothstep(0.3, R, r)) * (0.95 + 0.09 * vel);
pool += hot * 0.1 * smoothstep(2.4, 0.0, r);

// outside: dark night stone, darkening into the distance
// (a fixed touch of night purple underneath, so every colour keeps the Halloween mood out here)
vec3 stone = mix(cMid * 0.42 + vec3(0.016, 0.009, 0.03), cOut, smoothstep(R + 0.5, 14.0, r));
// old flagstones in staggered rows; each slab its own shade, thin dark joints (barely there near the cards)
vec2 st = vPos.xz * vec2(0.5, 0.62);
st.x += step(1.0, mod(floor(st.y), 2.0)) * 0.5;
vec2 id = floor(st);
vec2 g = abs(fract(st) - 0.5);
float joint = smoothstep(0.455, 0.49, max(g.x, g.y));
float far = smoothstep(R + 0.6, R + 2.5, r);
stone *= (0.88 + 0.24 * hash(id)) * (1.0 - joint * 0.45 * far);

col = mix(stone, pool, inPool);

// the rim: a bright line of the current colour right at the edge, and a soft glow spilling onto the stones
float d = r - edge;
col += hot * smoothstep(0.075, 0.0, abs(d)) * 0.85;
col += cIn * exp(-max(d, 0.0) * 2.6) * 0.16 * (1.0 - inPool);
// a dark groove just inside, so the line reads as a raised lip
col *= 1.0 - 0.25 * smoothstep(0.22, 0.0, abs(d + 0.17));

// a rune circle far out on the far side only (clear of the hand and the fans): glyphs between two thin lines,
// turning very slowly
float rr = 9.6;
float lines = smoothstep(0.045, 0.0, abs(r - rr + 0.42)) + smoothstep(0.045, 0.0, abs(r - rr - 0.42));
float ra = a + uTime * 0.02;
float cellW = 0.7 / rr;
float cell = floor(ra / cellW);
float u = fract(ra / cellW) - 0.5;
float v = (r - rr) / 0.62;
float h = hash(vec2(cell, 7.0));
float stem = smoothstep(0.07, 0.03, abs(u)) * step(abs(v), 0.36);
float arm = smoothstep(0.07, 0.03, abs(u - v * (h > 0.5 ? 0.9 : -0.9) - (h - 0.5) * 0.3)) * step(abs(v), 0.3) * step(abs(u), 0.32);
float dotc = smoothstep(0.1, 0.06, length(vec2(u - 0.2, v + 0.22))) * step(0.7, h);
float glyph = max(max(stem * step(0.12, h), arm), dotc) * step(0.18, hash(vec2(cell, 1.0)));
float flick = 0.65 + 0.35 * sin(uTime * 1.7 + cell * 1.3);
col += mix(cIn, vec3(0.75, 1.0, 0.6), 0.25) * (lines * 0.16 + glyph * 0.3 * flick) * smoothstep(-1.0, -4.0, p.y);

// a cobweb in the far dark only
float sp = abs(sin(a * 5.0 + 0.6));
float spokes = smoothstep(0.06, 0.0, sp * r * 0.1);
float sag = r + 0.35 * sp;
float rings = smoothstep(0.47, 0.5, abs(fract(sag / 1.4) - 0.5));
col += vec3(0.7, 0.66, 0.85) * max(spokes, rings) * 0.07 * smoothstep(11.0, 13.5, r);

// mist creeping in from the edge: two layers of soft noise drifting different ways, lavender with a hint of the colour
// (thresholded into separate banks with clear dark between them, so the stones are not washed grey)
// and it thins out again in the far distance, where the night should stay dark
float m = noise(vPos.xz * 0.34 + vec2(uTime * 0.07, uTime * 0.03)) * noise(vPos.xz * 0.7 - vec2(uTime * 0.05, -uTime * 0.015));
m = smoothstep(0.2, 0.62, m);
col += mix(vec3(0.3, 0.27, 0.42), cIn, 0.2) * m * 0.11 * smoothstep(6.5, 10.0, r) * smoothstep(17.0, 11.0, r);
`;
