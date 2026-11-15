/**
 * GLSL for this table's floor (see TableTheme.floor).
 *
 * Space: a calm, dark station deck under the pile, rimmed with a crisp light in the current colour, floating
 * over a nebula of that colour with sharp point stars. The deck stays nearly flat so cards read cleanly; the
 * colour shows at a glance in the rim, the soft pool under the pile and the whole nebula around the table.
 *
 * Every line and star is antialiased with fwidth(), so it stays one crisp pixel wide at any distance and
 * fades out (rather than shimmering) where it would get thinner than a pixel. Sizes are in floor units of `r`
 * (the arrow ring sits at r = 3.3, the opponents at about r = 5.5–6.5).
 */
export const floor = /* glsl */ `
float fw = max(fwidth(r), 1e-4);
// an antialiased line at distance d (floor units) of half-width w; thinner than a pixel it dims instead of aliasing
#define AAL(d, w) ((1.0 - smoothstep(max(w, fw), max(w, fw) + fw, abs(d))) * min(1.0, (w) / fw))
const float RD = 4.55;   // the deck's edge
const float TAU = 6.2831853;
vec3 lit = mix(cIn, vec3(1.0), 0.3);

// ---------- deep space beyond the deck ----------
// a slow, warped nebula in the current colour: bright billows, dark dust lanes, a few hot cores.
// Low frequencies only, so it stays smooth and calm under the cards.
vec2 q = vPos.xz * 0.075;
vec2 w = vec2(noise(q * 1.6 + vec2(uTime * 0.008, 3.1)), noise(q * 1.6 + vec2(7.4, -uTime * 0.01)));
float neb = noise(q + w * 1.8) * 0.55 + noise(q * 2.3 + w * 1.1 - uTime * 0.005) * 0.3 + noise(q * 5.1 + w * 0.6) * 0.15;
float lanes = smoothstep(0.52, 0.8, noise(q * 3.0 + w * 2.4 + 11.0)) * smoothstep(0.3, 0.6, neb);
neb = smoothstep(0.12, 0.9, neb);
// never quite black: a dark veil of the colour everywhere, so a thin patch of nebula never reads as an edge
vec3 space = mix(mix(cOut, cMid, 0.32), cMid * 1.1, neb);
space = mix(space, cOut, lanes * 0.6);
space += mix(cIn, vec3(1.0), 0.25) * pow(neb, 4.0) * 0.35;
// it glows brighter close to the deck: the station lights up its surroundings in the current colour
space += cMid * 0.45 * exp(-max(r - RD, 0.0) * 0.35);

// crisp point stars: a fixed size in screen pixels wherever they are (the offset to the star is taken
// back through the screen-space derivatives, so they stay round dots even at a grazing angle)
#define STAR_PX(g, ofs) (inverse(mat2(dFdx(g), dFdy(g)) + mat2(1e-5)) * (fract(g) - (ofs)))
vec2 sg = vPos.xz * 1.15;
vec2 sc = floor(sg);
float sh = hash(sc);
vec2 sd = STAR_PX(sg, vec2(hash(sc + 3.7), hash(sc + 9.1)) * 0.6 + 0.2);
// cells smaller than a few pixels would alias into noise: those stars fade away with the distance
float sfade = smoothstep(0.35, 0.1, max(length(dFdx(sg)), length(dFdy(sg))));
float srad = 0.6 + fract(sh * 37.0) * 0.9;
float tw = 0.7 + 0.3 * sin(uTime * (0.6 + sh * 2.2) + sh * 50.0);
float star = step(0.86, sh) * smoothstep(srad + 0.8, srad - 0.3, length(sd)) * sfade * tw;
vec3 starCol = mix(vec3(0.75, 0.85, 1.0), vec3(1.0, 0.92, 0.8), fract(sh * 91.0));
// fewer, brighter ones on a coarser grid, each with a tiny glint in the current colour
vec2 bg = vPos.xz * 0.42 + 23.0;
vec2 bc = floor(bg);
float bh = hash(bc);
vec2 bd = STAR_PX(bg, vec2(hash(bc + 1.3), hash(bc + 5.9)) * 0.6 + 0.2);
float bfade = smoothstep(0.3, 0.08, max(length(dFdx(bg)), length(dFdy(bg))));
float btw = 0.75 + 0.25 * sin(uTime * (0.9 + bh * 1.7) + bh * 30.0);
float bl = length(bd);
float big = step(0.93, bh) * bfade * btw;
space += starCol * star * 0.95;
space += (vec3(1.0) * smoothstep(2.2, 0.8, bl) + lit * 0.35 * exp(-bl * 0.35)) * big;

// a faint orbit through the opponents' seats, with dashes drifting round it
float orbit = AAL(r - 6.3, 0.012) * (0.5 + 0.5 * step(0.5, fract(a * 18.0 / TAU + uTime * 0.02)));
space += lit * orbit * 0.22;

// ---------- the station deck ----------
// dark gunmetal, a touch of the current colour, and a soft pool of light under the pile
vec3 dk = vec3(0.009, 0.011, 0.02) + cIn * 0.03;
dk += cIn * 0.09 * exp(-r * r * 0.16);
// a very faint brushed grain in rings, so the surface reads as metal, not as a hole
dk *= 0.94 + 0.06 * noise(vec2(r * 9.0, 1.7));
// engraved rings: a fine one inside, a dashed one, and the groove the turn arrows ride in
dk += lit * AAL(r - 1.55, 0.008) * 0.16;
dk += lit * AAL(r - 2.45, 0.007) * 0.12 * step(0.35, fract(a * 36.0 / TAU));
float groove = smoothstep(0.24, 0.16, abs(r - 3.3));
dk *= 1.0 - groove * 0.35;
dk += lit * (AAL(r - 3.08, 0.006) + AAL(r - 3.52, 0.006)) * 0.14;
// the instrument band near the edge: fine ticks, every eighth one longer and brighter
float band = smoothstep(3.88, 3.92, r) * smoothstep(4.36, 4.32, r);
float tk = (fract(a * 96.0 / TAU + 0.5) - 0.5) * TAU / 96.0 * r;
float major = step(abs(fract(a * 12.0 / TAU + 0.5) - 0.5), 0.02);
float ticks = AAL(tk, 0.009) * band * (0.35 + 0.65 * major * smoothstep(3.88, 4.0, r));
ticks += AAL(tk, 0.009) * major * smoothstep(3.7, 3.74, r) * (1.0 - band) * smoothstep(3.92, 3.88, r);
dk += lit * ticks * 0.32;
// a slow scanner sweeping the band
float sweep = fract((a - uTime * 0.18) / TAU);
dk += cIn * pow(sweep, 10.0) * 0.16 * smoothstep(3.6, 3.95, r) * smoothstep(4.5, 4.3, r);
// the rim: a crisp line of light in the current colour, with lights running round it
float rim = AAL(r - (RD - 0.07), 0.026);
float run = pow(fract((a + uTime * 0.32) * 3.0 / TAU), 14.0);
dk += lit * rim * (1.15 + run * 1.6);
// (exp() of a clamped argument: past the deck it would overflow to Inf, and Inf * 0 is NaN, i.e. black)
dk += cIn * 0.35 * exp(-max(RD - 0.07 - r, 0.0) * 6.0) * step(r, RD - 0.07);

// ---------- the deck's outer lip, then space ----------
float lipIn = RD;
float lipOut = RD + 0.2;
vec3 lip = vec3(0.016, 0.019, 0.032) + lit * AAL(r - lipOut, 0.008) * 0.55;
float inDeck = 1.0 - smoothstep(lipIn - fw, lipIn + fw, r);
float inLip = 1.0 - smoothstep(lipOut - fw, lipOut + fw, r);
// the rim's glow spills onto the space around it
space += cIn * 0.5 * exp(-max(r - lipOut, 0.0) * 3.0) * step(lipOut, r);
col = mix(space, lip, inLip);
col = mix(col, dk, inDeck);
#undef AAL
#undef STAR_PX
`;
