import * as THREE from 'three';
import type { CardType, Color } from '../../../game/types';
import { GRID, fxAtlas, type Cell } from './atlas';

/**
 * Pooled drawing for the card effects. Every frame the active effects write into these pools
 * (no allocations), then the pools hide whatever was not used. Idle, nothing draws at all.
 *
 * - glow: additive quads (sparks, rings, splashes, trails), one draw call
 * - solid: alpha-blended quads that keep their colour on a bright table (paint, rings, barriers), one draw call
 * - icons: alpha-blended quads drawn over everything (emoji, the colour wheel), one draw call
 * - cards: flying card backs, one draw call
 * - badges: up to two big emblem sprites (the card's own badge), one draw call each
 */

const QUAD_VERT = /* glsl */ `
attribute vec3 aPos;
attribute vec4 aSize; // width, height, rotation, mode (0 faces the camera, 1 lies flat on the table)
attribute vec4 aCol;  // rgb tint, alpha
attribute float aCell;
uniform float uGrid;
varying vec2 vUv;
varying vec4 vCol;
void main() {
  float c = cos(aSize.z);
  float s = sin(aSize.z);
  vec2 p = position.xy * aSize.xy;
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  float cx = mod(aCell, uGrid);
  float cy = floor(aCell / uGrid);
  vUv = (uv + vec2(cx, uGrid - 1.0 - cy)) / uGrid;
  vCol = aCol;
  if (aSize.w < 0.5) {
    vec4 mv = viewMatrix * vec4(aPos, 1.0);
    mv.xy += p;
    gl_Position = projectionMatrix * mv;
  } else {
    gl_Position = projectionMatrix * viewMatrix * vec4(aPos + vec3(p.x, 0.0, -p.y), 1.0);
  }
}`;

const QUAD_FRAG = /* glsl */ `
uniform sampler2D map;
varying vec2 vUv;
varying vec4 vCol;
void main() {
  vec4 t = texture2D(map, vUv);
  float a = t.a * vCol.a;
  if (a < 0.004) discard;
  gl_FragColor = vec4(t.rgb * vCol.rgb, a);
}`;

export class QuadPool {
  readonly mesh: THREE.Mesh;
  private readonly geo: THREE.InstancedBufferGeometry;
  private readonly pos: Float32Array;
  private readonly size: Float32Array;
  private readonly col: Float32Array;
  private readonly cell: Float32Array;
  readonly max: number;
  n = 0;

  constructor(max: number, additive: boolean, order: number, depthTest = additive) {
    this.max = max;
    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.getAttribute('position'));
    geo.setAttribute('uv', base.getAttribute('uv'));
    this.pos = new Float32Array(max * 3);
    this.size = new Float32Array(max * 4);
    this.col = new Float32Array(max * 4);
    this.cell = new Float32Array(max);
    const attr = (a: Float32Array, k: number) => new THREE.InstancedBufferAttribute(a, k).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aPos', attr(this.pos, 3));
    geo.setAttribute('aSize', attr(this.size, 4));
    geo.setAttribute('aCol', attr(this.col, 4));
    geo.setAttribute('aCell', attr(this.cell, 1));
    geo.instanceCount = 0;
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT,
      fragmentShader: QUAD_FRAG,
      uniforms: { map: { value: fxAtlas() }, uGrid: { value: GRID } },
      transparent: true,
      depthWrite: false,
      depthTest,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = order;
    this.mesh.visible = false;
  }

  /** One quad. flat: lies on the table (rotation turns it in the table plane), else it faces the camera. */
  add(cell: Cell, x: number, y: number, z: number, w: number, h: number, rot: number, flat: boolean, c: THREE.Color | null, a: number) {
    if (this.n >= this.max || a <= 0.003 || w <= 0 || h === 0) return;
    const i = this.n++;
    this.pos[i * 3] = x;
    this.pos[i * 3 + 1] = y;
    this.pos[i * 3 + 2] = z;
    this.size[i * 4] = w;
    this.size[i * 4 + 1] = h;
    this.size[i * 4 + 2] = rot;
    this.size[i * 4 + 3] = flat ? 1 : 0;
    this.col[i * 4] = c ? c.r : 1;
    this.col[i * 4 + 1] = c ? c.g : 1;
    this.col[i * 4 + 2] = c ? c.b : 1;
    this.col[i * 4 + 3] = Math.min(1, a);
    this.cell[i] = cell;
  }

  begin() {
    this.n = 0;
  }

  end() {
    this.geo.instanceCount = this.n;
    this.mesh.visible = this.n > 0;
    if (!this.n) return;
    for (const k of ['aPos', 'aSize', 'aCol', 'aCell']) {
      const at = this.geo.getAttribute(k) as THREE.InstancedBufferAttribute;
      at.clearUpdateRanges();
      at.addUpdateRange(0, this.n * at.itemSize);
      at.needsUpdate = true;
    }
  }
}

const E = new THREE.Euler(0, 0, 0, 'YXZ');
const Q = new THREE.Quaternion();
const P = new THREE.Vector3();
const S = new THREE.Vector3();
const M = new THREE.Matrix4();

export class CardPool {
  readonly mesh: THREE.InstancedMesh;
  n = 0;
  constructor(geo: THREE.BufferGeometry, max: number) {
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false, side: THREE.DoubleSide });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.renderOrder = 9;
  }
  setBack(tex: THREE.Texture) {
    const m = this.mesh.material as THREE.MeshBasicMaterial;
    if (m.map !== tex) {
      m.map = tex;
      m.needsUpdate = true;
    }
  }
  /** A card back at (x, y, z), turned by YXZ Euler angles. */
  add(x: number, y: number, z: number, rx: number, ry: number, rz: number, s: number) {
    if (this.n >= this.mesh.instanceMatrix.count || s <= 0) return;
    E.set(rx, ry, rz);
    Q.setFromEuler(E);
    M.compose(P.set(x, y, z), Q, S.set(s, s, s));
    this.mesh.setMatrixAt(this.n++, M);
  }
  begin() {
    this.n = 0;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.visible = this.n > 0;
    if (this.n) this.mesh.instanceMatrix.needsUpdate = true;
  }
}

export interface Badge {
  sprite: THREE.Sprite;
  mat: THREE.SpriteMaterial;
  used: boolean;
}

/** What one effect draws with this frame. */
export class Kit {
  lite = false;
  badgeIdx = 0;
  constructor(readonly glow: QuadPool, readonly solid: QuadPool, readonly icons: QuadPool, readonly cards: CardPool, readonly badges: Badge[]) {}

  begin() {
    this.glow.begin();
    this.solid.begin();
    this.icons.begin();
    this.cards.begin();
    this.badgeIdx = 0;
  }
  end() {
    this.glow.end();
    this.solid.end();
    this.icons.end();
    this.cards.end();
    for (let i = 0; i < this.badges.length; i++) this.badges[i].sprite.visible = i < this.badgeIdx;
  }
  /** additive light: sparks, rings, splashes */
  g(cell: Cell, x: number, y: number, z: number, w: number, rot: number, flat: boolean, c: THREE.Color | null, a: number, h = w) {
    this.glow.add(cell, x, y, z, w, h, rot, flat, c, a);
  }
  /** solid paint: hidden behind cards like any object on the table */
  s(cell: Cell, x: number, y: number, z: number, w: number, rot: number, flat: boolean, c: THREE.Color | null, a: number, h = w) {
    this.solid.add(cell, x, y, z, w, h, rot, flat, c, a);
  }
  /** emoji and badges-like shapes, drawn over everything */
  i(cell: Cell, x: number, y: number, z: number, w: number, rot: number, flat: boolean, c: THREE.Color | null, a: number, h = w) {
    this.icons.add(cell, x, y, z, w, h, rot, flat, c, a);
  }
  card(x: number, y: number, z: number, rx: number, ry: number, rz: number, s: number) {
    this.cards.add(x, y, z, rx, ry, rz, s);
  }
  /** the big emblem of the card (a sprite facing the camera) */
  badge(tex: THREE.Texture | null, x: number, y: number, z: number, size: number, rot: number, a: number) {
    if (!tex || this.badgeIdx >= this.badges.length || a <= 0.003 || size <= 0) return;
    const b = this.badges[this.badgeIdx++];
    if (b.mat.map !== tex) b.mat.map = tex;
    b.sprite.position.set(x, y, z);
    b.sprite.scale.setScalar(size);
    b.mat.rotation = rot;
    b.mat.opacity = Math.min(1, a);
  }
}

/* ---------- what an effect knows ---------- */

export interface Spot {
  x: number;
  y: number;
  z: number;
}

/** One running effect. Built when it is triggered (allocations are fine there), then only read per frame. */
export interface Active {
  motif: Motif;
  type: CardType;
  /** when the effect starts (the card touched the pile); null while waiting for that */
  start: number | null;
  /** a card is still flying to the pile since this moment */
  armed: number | null;
  /** effects that wait for a decision (a colour, a target): when it came; null while waiting */
  resolved: number | null;
  /** the pile */
  pile: Spot;
  /** the deck */
  deck: Spot;
  /** who played the card */
  from: Spot;
  /** who it hits (the next player, everyone else, the swap partner…) */
  to: Spot[];
  /** the card's colour (or the picked colour once resolved) */
  color: THREE.Color;
  colorName: Color | null;
  /** cards involved: penalty size, cards dumped… */
  n: number;
  /** direction of play after the card (1 clockwise on screen) */
  dir: 1 | -1;
  seed: number;
  tex: THREE.Texture | null;
  /** one-off things already done (see once) */
  fired: number;
  /** extra flag: mirror bounced a penalty, roulette etc. */
  flag: boolean;
}

export interface Motif {
  /** seconds the effect runs (after `resolved` for effects that wait) */
  life: number;
  /** the effect waits for a decision before its main part */
  waits?: boolean;
  frame(k: Kit, a: Active, t: number, since: number): void;
}
