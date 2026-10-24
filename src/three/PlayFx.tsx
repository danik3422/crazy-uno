import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HEX, SPECIAL } from '../game/content';
import type { Card, CardType } from '../game/types';
import { nowSec } from './fxState';
import type { Vec3 } from './layout';
import { drawEmoji } from './textures';

const DISPLAY = '"Unbounded", "Arial Black", system-ui, sans-serif';
const BIG: CardType[] = ['skip', 'rev', 'draw2', 'wild', 'wild4', 'swap', 'gift', 'bomb', 'dare', 'rain', 'mirror', 'chaos', 'dump'];

const symbolCache = new Map<string, THREE.CanvasTexture>();

/** A chunky glowing emblem for an action card, drawn once per type and colour. */
function symbolTexture(card: Card): THREE.CanvasTexture {
  const key = `${card.type}-${card.color}`;
  const hit = symbolCache.get(key);
  if (hit) return hit;
  const S = 512;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d')!;
  const col = card.color === 'wild' ? '#ffffff' : HEX[card.color];
  const glow = ctx.createRadialGradient(S / 2, S / 2, 20, S / 2, S / 2, S / 2);
  glow.addColorStop(0, 'rgba(255,255,255,.55)');
  glow.addColorStop(0.45, card.color === 'wild' ? 'rgba(255,220,120,.35)' : `${col}66`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, S, S);
  ctx.translate(S / 2, S / 2);

  const fill = () => {
    if (card.color !== 'wild') return col;
    const g = ctx.createLinearGradient(-150, -150, 150, 150);
    g.addColorStop(0, HEX.red); g.addColorStop(0.35, HEX.yellow); g.addColorStop(0.65, HEX.green); g.addColorStop(1, HEX.blue);
    return g;
  };
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (card.type === 'skip') {
    // the classic "no entry" ring, extruded look: dark outline, bright body, white highlight
    for (const [w, c] of [[78, '#00000055'], [64, '#1a1a1a'], [44, fill()], [10, '#ffffff99']] as const) {
      ctx.lineWidth = w;
      ctx.strokeStyle = c as string;
      ctx.beginPath(); ctx.arc(0, 0, 150, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-105, 105); ctx.lineTo(105, -105); ctx.stroke();
    }
  } else if (card.type === 'rev') {
    for (const [w, c] of [[58, '#1a1a1a'], [38, fill()], [8, '#ffffff99']] as const) {
      ctx.lineWidth = w;
      ctx.strokeStyle = c as string;
      ctx.beginPath(); ctx.arc(0, 0, 140, Math.PI * 1.1, Math.PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 140, Math.PI * 0.1, Math.PI * 0.85); ctx.stroke();
    }
    ctx.fillStyle = '#1a1a1a';
    const head = (x: number, y: number, r: number) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(r);
      ctx.beginPath(); ctx.moveTo(0, -60); ctx.lineTo(55, 20); ctx.lineTo(-55, 20); ctx.closePath();
      ctx.fill(); ctx.fillStyle = fill(); ctx.scale(0.62, 0.62); ctx.fill(); ctx.restore(); ctx.fillStyle = '#1a1a1a';
    };
    head(66, -125, 1.15);
    head(-66, 125, 1.15 + Math.PI);
  } else {
    const sym = card.type === 'num' ? String(card.value) : SPECIAL[card.type].sym;
    const emoji = /\p{Extended_Pictographic}/u.test(sym);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (emoji) {
      ctx.shadowColor = 'rgba(0,0,0,.45)';
      ctx.shadowBlur = 24;
      drawEmoji(ctx, sym, 0, 10, 230);
    } else {
      ctx.font = `900 ${sym.length > 1 ? 210 : 260}px ${DISPLAY}`;
      ctx.lineWidth = 34;
      ctx.strokeStyle = '#1a1a1a';
      ctx.strokeText(sym, 6, 18);
      ctx.strokeText(sym, 0, 10);
      ctx.fillStyle = fill();
      ctx.fillText(sym, 0, 10);
      ctx.lineWidth = 6;
      ctx.strokeStyle = '#ffffff88';
      ctx.strokeText(sym, -3, 4);
    }
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  symbolCache.set(key, t);
  return t;
}

interface Props {
  top: Card;
  at: Vec3;
}

/**
 * Reacts to a new card on the pile: a shock ring in the card's colour,
 * and for action cards a giant emblem that pops up over the table.
 */
export function PlayFx({ top, at }: Props) {
  const sprite = useRef<THREE.Sprite>(null!);
  const spriteMat = useRef<THREE.SpriteMaterial>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const ringMat = useRef<THREE.MeshBasicMaterial>(null!);
  const start = useRef(-10);
  const first = useRef(true);
  const shown = useRef<Card | null>(null);
  const col = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    start.current = nowSec() + 0.35; // roughly when the flying card lands
    shown.current = top;
    col.set(top.color === 'wild' ? '#ffffff' : HEX[top.color]);
    ringMat.current.color.copy(col);
    if (BIG.includes(top.type)) spriteMat.current.map = symbolTexture(top);
    spriteMat.current.needsUpdate = true;
  }, [top.id]); // only when a new card lands on the pile

  useFrame(() => {
    const t = nowSec() - start.current;
    // shock ring
    const rOn = t >= 0 && t < 0.7;
    ring.current.visible = rOn;
    if (rOn) {
      ring.current.scale.setScalar(0.6 + t * 6);
      ringMat.current.opacity = 0.9 * (1 - t / 0.7);
    }
    // emblem: pop with overshoot, hover, then fade up and away
    const big = !!shown.current && BIG.includes(shown.current.type);
    const sOn = big && t >= 0 && t < 1.6;
    sprite.current.visible = sOn;
    if (sOn) {
      const pop = t < 0.35 ? easeOutBack(t / 0.35) : 1;
      sprite.current.scale.setScalar(3.1 * pop);
      sprite.current.position.set(at[0], 1.6 + t * 0.5, at[2]);
      spriteMat.current.rotation = Math.sin(t * 6) * 0.08 * (1 - t / 1.6);
      spriteMat.current.opacity = t > 1.1 ? 1 - (t - 1.1) / 0.5 : 1;
    }
  });

  return (
    <>
      {/* under the cards, so it never cuts through the pile */}
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[at[0], 0.006, at[2]]}>
        <ringGeometry args={[0.8, 1.0, 48]} />
        <meshBasicMaterial ref={ringMat} transparent toneMapped={false} depthWrite={false} />
      </mesh>
      <sprite ref={sprite} renderOrder={10}>
        <spriteMaterial ref={spriteMat} transparent depthTest={false} toneMapped={false} />
      </sprite>
    </>
  );
}

function easeOutBack(x: number) {
  const c1 = 1.9;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
