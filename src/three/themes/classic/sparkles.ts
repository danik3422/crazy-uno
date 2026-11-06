import * as THREE from 'three';

let starTex: THREE.Texture | null = null;
/** A small four-point star with a soft glow (64 px, made once). */
function starTexture() {
  if (starTex) return starTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.18, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  c.fillStyle = '#fff';
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 4 : 31;
    c.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r);
  }
  c.closePath();
  c.fill();
  starTex = new THREE.CanvasTexture(cv);
  return starTex;
}

let glowTex: THREE.Texture | null = null;
/** A plain soft round glow (64 px, made once). */
export function softGlow() {
  if (glowTex) return glowTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(cv);
  return glowTex;
}

let spotTex: THREE.Texture | null = null;
/**
 * A stage spotlight's pool, for normal blending: a bright disc with a soft edge and a faint dark rim just
 * outside it. The rim is what makes the pool read on a bright floor, where adding light alone shows nothing.
 */
export function spotDisc() {
  if (spotTex) return spotTex;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const c = cv.getContext('2d')!;
  const g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,.42)');
  g.addColorStop(0.66, 'rgba(255,255,255,.12)');
  g.addColorStop(0.74, 'rgba(0,0,0,.2)');
  g.addColorStop(0.88, 'rgba(0,0,0,.08)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g;
  c.fillRect(0, 0, 128, 128);
  spotTex = new THREE.CanvasTexture(cv);
  spotTex.colorSpace = THREE.SRGBColorSpace;
  return spotTex;
}

const vert = /* glsl */ `
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uScale;
  varying vec3 vColor;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */ `
  uniform sampler2D uMap;
  varying vec3 vColor;
  void main() {
    gl_FragColor = vec4(vColor, 1.0) * texture2D(uMap, gl_PointCoord);
    #include <colorspace_fragment>
  }
`;

/**
 * A pool of star sparkles in one draw call. `burst()` throws some out from a point; `update()` moves them
 * (gravity, drag, a twinkling shrink). Nothing is allocated after construction.
 */
export class Sparkles {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private vel: Float32Array;
  private size: Float32Array;
  private base: Float32Array;
  private col: Float32Array;
  private age: Float32Array;
  private life: Float32Array;
  private next = 0;
  private alive = 0;
  private mat: THREE.ShaderMaterial;

  constructor(readonly n: number, private gravity = -5) {
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.size = new Float32Array(n);
    this.base = new Float32Array(n);
    this.col = new Float32Array(n * 3);
    this.age = new Float32Array(n).fill(1);
    this.life = new Float32Array(n).fill(1);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      uniforms: { uMap: { value: starTexture() }, uScale: { value: 600 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }

  /** pixels per world unit at distance 1 (screen height / (2 tan(fov/2))) */
  setScale(px: number) {
    this.mat.uniforms.uScale.value = px;
  }

  /** `count` sparkles from (x, y, z), flying out at about `speed`; colours picked from `colors` in turn. */
  burst(x: number, y: number, z: number, count: number, colors: readonly THREE.Color[], speed = 3, size = 0.35, up = 1.5) {
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.n;
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.3) * 1.3;
      const s = speed * (0.45 + Math.random() * 0.75);
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.vel[i * 3] = Math.cos(a) * Math.cos(e) * s;
      this.vel[i * 3 + 1] = Math.sin(e) * s + up;
      this.vel[i * 3 + 2] = Math.sin(a) * Math.cos(e) * s;
      const c = colors[k % colors.length];
      this.col[i * 3] = c.r;
      this.col[i * 3 + 1] = c.g;
      this.col[i * 3 + 2] = c.b;
      this.base[i] = size * (0.6 + Math.random() * 0.8);
      this.age[i] = 0;
      this.life[i] = 0.55 + Math.random() * 0.45;
    }
    this.alive = this.n;
    this.points.visible = true;
  }

  update(dt: number) {
    if (!this.alive) return;
    let live = 0;
    const drag = Math.exp(-dt * 2.2);
    for (let i = 0; i < this.n; i++) {
      if (this.age[i] >= this.life[i]) {
        this.size[i] = 0;
        continue;
      }
      live++;
      this.age[i] += dt;
      const j = i * 3;
      this.vel[j] *= drag;
      this.vel[j + 1] = this.vel[j + 1] * drag + this.gravity * dt;
      this.vel[j + 2] *= drag;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      const k = this.age[i] / this.life[i];
      // pop in, twinkle, shrink away
      this.size[i] = this.base[i] * Math.min(1, k * 8) * (1 - k * k) * (0.75 + 0.25 * Math.sin(this.age[i] * 40 + i));
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aColor.needsUpdate = true;
    if (!live) {
      this.alive = 0;
      this.points.visible = false;
    }
  }

  dispose() {
    this.points.geometry.dispose();
    this.mat.dispose();
  }
}
