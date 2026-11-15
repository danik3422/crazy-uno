/**
 * GLSL for this table's floor (see TableTheme.floor).
 *
 * Winter: a frozen lake of clear ice in the colour of play, a frosted shore and moonlit snow beyond.
 * The middle stays calm and smooth (no pattern under the pile) so the cards read; the detail lives at the
 * shore and in the snow. The shore sits just outside the opponents, so every card lies on coloured ice and
 * the snow frames the screen.
 */
export const floor = /* glsl */ `
float n1 = noise(vPos.xz * 0.23 + 2.0);
float n2 = noise(vPos.xz * 0.71 + 9.0);
// the shoreline: a gently wandering ellipse round the pile (r is already squashed front to back)
float shore = 6.8 + (n1 - 0.5) * 1.2 + (n2 - 0.5) * 0.35;
float d = r - shore;
float onIce = 1.0 - smoothstep(-0.03, 0.03, d);

// ice: bright and clear round the pile, deepening toward the shore
vec3 ice = mix(cIn, cMid, smoothstep(0.6, 6.4, r) * 0.55);
// faint clouds deep under the ice, kept away from the pile
ice *= 1.0 + (noise(vPos.xz * 0.42 + 5.0) - 0.5) * 0.16 * smoothstep(2.6, 4.2, r);
// a slow pale sheen, like the moon on glass
float sheen = smoothstep(0.62, 1.0, sin(vPos.x * 0.28 - vPos.z * 0.5 + uTime * 0.04) * 0.5 + 0.5);
ice += vec3(0.7, 0.85, 1.0) * sheen * 0.055 * smoothstep(2.4, 4.2, r);
// skate tracks: a few long, faint, broken arcs out in the open ice
float sk = smoothstep(0.03, 0.0, abs(length((vPos.xz - vec2(2.2, 1.2)) * vec2(1.0, 1.6)) - 4.7))
         + smoothstep(0.025, 0.0, abs(length((vPos.xz - vec2(-2.6, -0.4)) * vec2(1.0, 1.45)) - 4.2))
         + smoothstep(0.025, 0.0, abs(length((vPos.xz - vec2(0.6, -2.2)) * vec2(1.3, 1.0)) - 5.4));
ice += vec3(0.85, 0.94, 1.0) * sk * 0.08 * smoothstep(3.4, 4.4, r) * smoothstep(0.35, 0.7, n2);
// rime creeping in from the shore: a frosted band in the lake's colour, a clear frame for the colour of play
float rime = smoothstep(-1.3, -0.15, d);
ice = mix(ice, mix(cIn, vec3(0.75, 0.86, 1.0), 0.42), rime * rime * 0.8);
// fine frost feathers in the rime
float fern = smoothstep(0.55, 0.9, noise(vec2(a * 40.0, r * 3.0)));
ice += vec3(0.9, 0.97, 1.0) * fern * rime * 0.1;
// a thin shadow where the snow bank overhangs the ice
ice *= 1.0 - 0.22 * smoothstep(-0.28, 0.0, d);

// snow: soft drifts lit from the upper left by the moon (shading from the slope of a noise field)
vec2 q = vPos.xz * 0.32;
float h0 = noise(q);
float hx = noise(q + vec2(0.15, 0.0));
float hz = noise(q + vec2(0.0, 0.15));
float lit = clamp(0.45 + (h0 - hx) * 7.0 + (h0 - hz) * 5.0 + (noise(vPos.xz * 0.09) - 0.5) * 0.5, 0.0, 1.0);
// (linear values: the output is converted to sRGB, so these read as a moonlit blue, not white)
vec3 snow = mix(vec3(0.04, 0.06, 0.14), vec3(0.2, 0.26, 0.42), lit);
snow = mix(snow, cIn, 0.04);
// the bank's lit lip right at the ice, then the snow sinks into the night far out
snow += vec3(0.2, 0.24, 0.32) * smoothstep(0.7, 0.05, d);
snow = mix(snow, cOut, smoothstep(13.0, 28.0, r));
// glints: tiny sharp crystals catching the moon, each twinkling on its own
vec2 gc = vPos.xz * 4.0;
float gh = hash(floor(gc));
float glint = smoothstep(0.11, 0.035, length(fract(gc) - 0.5)) * step(0.94, gh) * pow(0.5 + 0.5 * sin(uTime * 1.6 + gh * 60.0), 4.0);
snow += vec3(0.9, 0.96, 1.0) * glint * 0.8 * smoothstep(18.0, 9.0, r);

col = mix(snow, ice, onIce);
`;
