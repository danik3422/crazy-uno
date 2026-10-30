/** GLSL for this table's floor (see TableTheme.floor). */
export const floor = /* glsl */ `
// winter: a frozen lake round the pile, soft snow drifts further out, an aurora shimmer on the ice, a ring of frost
float n1 = noise(vPos.xz * 0.35);
float n2 = noise(vPos.xz * 1.3 + 7.0);
// the lake: clear blue ice tinted by the colour of play; snow drifts whiten the ground beyond it
float lake = smoothstep(8.8, 6.6, r + (n1 - 0.5) * 2.4);
vec3 ice = mix(vec3(0.07, 0.15, 0.32), cMid, 0.45);
col = mix(col, ice, lake * smoothstep(3.6, 6.5, r) * 0.6);
float drift = smoothstep(0.3, 0.8, n1 * 0.7 + n2 * 0.3);
vec3 snow = mix(vec3(0.62, 0.72, 0.92), vec3(0.9, 0.94, 1.0), drift) * (0.62 + 0.3 * smoothstep(18.0, 7.0, r));
col = mix(col, snow, (1.0 - lake) * 0.62 * smoothstep(21.0, 7.5, r));
// ice: long cracks and a cool sheen
float crack = smoothstep(0.03, 0.0, abs(noise(vPos.xz * 0.55 + 3.0) - 0.5)) * smoothstep(0.3, 0.7, n2);
col += vec3(0.7, 0.88, 1.0) * crack * 0.2 * lake * smoothstep(3.2, 4.4, r);
float sheen = pow(max(0.0, sin(p.x * 0.16 - p.y * 0.1 + 0.6)), 6.0);
col += vec3(0.55, 0.78, 1.0) * sheen * 0.12 * lake;
// the aurora's reflection: a slow green-violet band drifting over the ice
float band = sin(vPos.x * 0.22 + uTime * 0.12 + n1 * 2.5) * 0.5 + 0.5;
float aur = smoothstep(0.5, 1.0, band) * smoothstep(9.0, 3.0, abs(vPos.z + 4.0)) * lake * smoothstep(3.4, 5.0, r);
col += mix(vec3(0.2, 1.0, 0.65), vec3(0.6, 0.42, 1.0), band) * aur * 0.14;
// a ring of frost round the pile, with round crystals twinkling in it
float ring = smoothstep(0.16, 0.0, abs(r - 3.15 - (n2 - 0.5) * 0.25));
col += mix(cIn, vec3(0.85, 0.95, 1.0), 0.55) * ring * 0.5;
vec2 gc = vPos.xz * 6.0;
vec2 gf = fract(gc) - 0.5;
float gh = hash(floor(gc));
float glint = smoothstep(0.2, 0.04, length(gf)) * step(0.9, gh) * (0.5 + 0.5 * sin(uTime * 2.2 + gh * 40.0));
col += vec3(0.9, 0.97, 1.0) * glint * (smoothstep(0.7, 0.0, abs(r - 3.3)) * 0.5 + (1.0 - lake) * 0.3 * smoothstep(16.0, 7.0, r));
`;
