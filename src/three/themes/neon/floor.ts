/** GLSL for this table's floor (see TableTheme.floor). */
export const floor = /* glsl */ `
// neon: a synthwave grid rolling toward the player, pulse waves rippling out from the pile,
// a magenta haze on the far horizon and a dark, calm pool under the cards
col = mix(cMid * 0.55, cOut, smoothstep(2.5, 15.0, r));

// the grid: crisp lines (fwidth keeps them thin at any distance), brighter far away
vec2 g = vec2(vPos.x, vPos.z + uTime * 0.7) / 1.25;
vec2 fw = max(fwidth(g), vec2(0.0005));
vec2 gd = abs(fract(g) - 0.5);
vec2 ln = smoothstep(vec2(0.5) - fw * 1.6, vec2(0.5), gd);
float line = max(ln.x, ln.y);
// the grid fades out where the pile and your hand are, so cards stay easy to read
float gridMask = smoothstep(2.6, 7.5, r) * smoothstep(30.0, 8.0, r);
vec3 magenta = vec3(1.0, 0.18, 0.66);
vec3 gridCol = mix(cIn, magenta, smoothstep(-2.0, -12.0, vPos.z) * 0.6);
col += gridCol * line * gridMask * 0.5;
// little hot dots where lines cross
float dots = ln.x * ln.y;
col += vec3(1.0) * dots * gridMask * 0.25;

// pulse waves from the pile: thin bright rings that ride the grid outward
float wave = fract(r * 0.11 - uTime * 0.32);
float pulse = smoothstep(0.0, 0.02, wave) * smoothstep(0.08, 0.02, wave);
col += cIn * pulse * line * 1.4 * smoothstep(3.0, 6.0, r) * smoothstep(22.0, 10.0, r);
col += cIn * pulse * 0.08 * smoothstep(3.0, 6.0, r) * smoothstep(18.0, 8.0, r);

// the tube ring round the pile, with a slow chase of light along it
float ring = smoothstep(0.1, 0.0, abs(r - 3.1));
float chase = 0.65 + 0.35 * sin(a * 3.0 - uTime * 2.2);
col += cIn * ring * chase * 1.1;
col += cIn * smoothstep(0.06, 0.0, abs(r - 3.42)) * 0.35;
col += cIn * 0.16 * smoothstep(3.2, 0.0, r);

// the far horizon glows magenta-to-accent, like a sunset behind the club
float far = smoothstep(-6.0, -20.0, vPos.z);
col += mix(magenta, cIn, 0.35) * far * 0.32 * (0.85 + 0.15 * sin(uTime * 0.8));
`;
