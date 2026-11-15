/**
 * GLSL for this table's floor (see TableTheme.floor).
 *
 * A synthwave night club, kept calm where the cards are:
 *  - a dark, flat pool in the current colour under the pile (cards read against it, nothing busy there)
 *  - a crisp double "track" ring round the pile that frames the direction arrows (they run at r ≈ 3.3),
 *    with two slow comets of light chasing along it, and a ring of floor LEDs outside it pulsing like an equalizer
 *  - a perspective grid only outside the track, dimmed under your hand, rolling slowly toward you and
 *    turning magenta toward the horizon; a soft pulse of light rides its lines outward now and then
 *  - a violet-to-magenta haze at the far end for depth
 * Every line is anti-aliased from its own screen-space width (fwidth), so it stays one or two pixels sharp
 * at any distance, and the grid fades to its average where cells get smaller than a pixel (no moiré).
 */
export const floor = /* glsl */ `
#define NEON_LINE(d, w, aa) (1.0 - smoothstep((w), (w) + (aa), abs(d)))

vec3 magenta = vec3(1.0, 0.05, 0.42);
vec3 violet = vec3(0.07, 0.02, 0.22);
float far = smoothstep(-3.0, -15.0, vPos.z);

// base: deep night with a flat pool of the current colour under the pile
col = mix(cOut, cMid, exp(-r * r / 14.0));
col += cIn * 0.035 * (1.0 - smoothstep(0.0, 2.8, r));
// depth: the far end glows violet, then magenta, like the sky over the horizon
col += mix(violet, magenta * 0.22 + cIn * 0.05, far) * far * 0.55;
// the sides sink into the dark, so the eye stays on the table
col *= 1.0 - smoothstep(8.0, 15.0, abs(vPos.x)) * 0.45;

// the grid (Ben Golus' "pristine grid": constant pixel width, fades to its average instead of shimmering)
vec2 guv = vec2(vPos.x, vPos.z + uTime * 0.4) / 1.2;
vec2 dd = max(fwidth(guv), vec2(1e-4));
vec2 lw = vec2(0.03);
vec2 dw = clamp(lw, dd, vec2(0.5));
vec2 gv = 1.0 - abs(fract(guv) * 2.0 - 1.0);
vec2 gl = smoothstep(dw + dd * 1.5, dw - dd * 1.5, gv) * clamp(lw / dw, 0.0, 1.0);
gl = mix(gl, lw, clamp(dd * 2.0 - 1.0, 0.0, 1.0));
float grid = mix(gl.x, 1.0, gl.y);
// only outside the track, and faint under your hand
float gridMask = smoothstep(5.0, 6.6, r) * (1.0 - 0.9 * smoothstep(0.5, 3.5, vPos.z));
vec3 gridCol = mix(cIn, magenta, far * 0.5);
col += gridCol * grid * gridMask * (0.22 + 0.33 * far);

// a pulse of light rides the grid lines outward every few seconds
float front = 4.0 + mod(uTime * 3.0, 21.0);
float pulse = exp(-(r - front) * (r - front) * 1.4) * (1.0 - smoothstep(14.0, 24.0, front));
col += cIn * grid * gridMask * pulse * 0.9;

// the track round the pile: two crisp tubes with a tight halo, the direction arrows run between them
float aa = fwidth(r) * 1.3;
float inner = NEON_LINE(r - 2.72, 0.018, aa);
float outer = NEON_LINE(r - 3.92, 0.026, aa);
col += cIn * 0.025 * smoothstep(2.7, 2.8, r) * (1.0 - smoothstep(3.85, 3.95, r));
col += cIn * inner * 0.55;
col += cIn * exp(-abs(r - 3.92) * 14.0) * 0.12;
// two comets of light chase along the outer tube, half a turn apart
float ch = fract(a / 3.14159265 - uTime * 0.11);
float comet = pow(ch, 6.0) * (1.0 - smoothstep(0.975, 1.0, ch));
col += mix(cIn, vec3(1.0), comet * 0.5) * outer * (0.7 + comet * 1.3);

// an LED equalizer ring just outside the track, flat in the floor: 64 bars of 4 segments that rise and
// fall with a smooth fake spectrum (noise over time, never twitchy) and breathe with a soft kick at 112 bpm
float vuR = (r - 4.12) / 0.19;
float tu = a * 64.0 / 6.2831853;
float id = floor(tu);
// widths come from r, which has no seam (the angle jumps at ±pi)
float across = NEON_LINE(fract(tu) - 0.5, 0.25, fwidth(r) / max(r, 0.5) * 64.0 / 6.2831853 * 1.3);
float along = NEON_LINE(fract(vuR) - 0.5, 0.34, fwidth(r) / 0.19 * 1.3);
float segId = floor(vuR);
float inBand = step(0.0, vuR) * step(vuR, 4.0);
float kick = exp(-fract(uTime * 1.8667) * 6.0);
float lvl = 0.4 + 2.8 * noise(vec2(id * 0.73, uTime * 1.1)) + kick * 0.7;
float on = clamp(lvl - segId, 0.0, 1.0);
vec3 vuCol = mix(cIn, mix(magenta, vec3(1.0), 0.35), segId / 3.0 * 0.55);
col += vuCol * across * along * inBand * (0.04 + on * 0.4);
`;
