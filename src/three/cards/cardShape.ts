import * as THREE from 'three';

/** Card size in table units, and the corner radius: the same 30/256 as the corners drawn on the card face. */
export const CARD_W = 1;
export const CARD_H = 1.5;
export const CARD_R = (30 / 256) * CARD_W;
/** points per rounded corner: enough that a card held up close still has smooth corners */
const CORNER_SEGMENTS = 10;

/** A rounded rectangle centred on the origin, with true circular corners. */
export function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape();
  const x = w / 2;
  const y = h / 2;
  s.moveTo(-x + r, -y);
  s.lineTo(x - r, -y);
  s.absarc(x - r, -y + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x, y - r);
  s.absarc(x - r, y - r, r, 0, Math.PI / 2, false);
  s.lineTo(-x + r, y);
  s.absarc(-x + r, y - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(-x, -y + r);
  s.absarc(-x + r, -y + r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/**
 * The flat face of a card, cut to the card's real outline. Its edge is geometry, so it is smooth and
 * antialiased at any size (no alpha-cutout staircase), and the texture spans it exactly (UVs 0…1).
 */
export function cardFaceGeometry(w = CARD_W, h = CARD_H, r = CARD_R) {
  const g = new THREE.ShapeGeometry(roundedRect(w, h, r), CORNER_SEGMENTS);
  const pos = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / w + 0.5, pos.getY(i) / h + 0.5);
  uv.needsUpdate = true;
  return g;
}

/** The card's body: a thin slab of the same outline, a hair smaller so the printed faces cover it. */
export function cardBodyGeometry(thick: number, w = CARD_W, h = CARD_H, r = CARD_R) {
  const inset = 0.003;
  const g = new THREE.ExtrudeGeometry(roundedRect(w - inset, h - inset, r - inset / 2), {
    depth: thick,
    bevelEnabled: false,
    curveSegments: CORNER_SEGMENTS,
  });
  g.translate(0, 0, -thick / 2);
  return g;
}
