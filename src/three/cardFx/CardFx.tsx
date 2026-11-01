import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { HEX } from '../../game/content';
import type { Card, Color, ThemeId } from '../../game/types';
import type { GameView } from '../../game/view';
import { isPhone } from '../../ui/hooks/phone';
import { cardFaceGeometry } from '../cardShape';
import { symbolTexture } from '../emblems';
import { DEBUG, fxState, nowSec } from '../fxState';
import { arena, seatPos, spawn, type Vec3, type View } from '../layout';
import { landingTime } from '../PlayFx';
import { cardTexture } from '../textures';
import { detect, snap, type PlayTrigger, type ResolveTrigger, type Snap } from './detect';
import { CardPool, Kit, QuadPool, type Active, type Badge, type Spot } from './kit';
import { knockout } from './motifs/knockout';
import { penaltyHit } from './motifs/penalty';
import { HAS_BADGE, motifFor } from './registry';
import { raw } from './shapes';

/** longest an effect waits for a decision before it gives up */
const MAX_WAIT = 40;
const MAX_ACTIVE = 4;

const WILD_GOLD = '#ffd23a';

/** Where an effect aimed at player i happens: in front of their cards (for you: just above your hand). */
function anchor(game: GameView, i: number, view: View): Spot {
  if (i === game.seat()) {
    const A = arena(view);
    return { x: 0, y: 0.2, z: A.hand.z - (view.portrait ? 2.2 : 1.7) };
  }
  const [x, , z] = seatPos(game, i, view);
  // a little toward the middle, so it lands in front of their wall of cards
  return { x: x * 0.86, y: 0.2, z: z * 0.86 };
}

interface Props {
  game: GameView;
  version: number;
  view: View;
  theme: ThemeId;
  pile: Vec3;
}

/**
 * Each action card's own animation (see registry.ts): watches the game for cards played and decisions made,
 * and plays the matching effect from the moment the card touches the pile.
 */
export function CardFx({ game, version, view, theme, pile }: Props) {
  const lite = useMemo(() => isPhone(), []);
  const kit = useMemo(() => {
    const glow = new QuadPool(lite ? 160 : 320, true, 12);
    const solid = new QuadPool(lite ? 80 : 140, false, 11, true);
    const icons = new QuadPool(lite ? 24 : 40, false, 13);
    const cards = new CardPool(cardFaceGeometry(), lite ? 12 : 22);
    const badges: Badge[] = [0, 1].map(() => {
      const mat = new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false });
      // the sprite always has a map, so swapping in an emblem never needs a new shader
      mat.map = symbolTexture({ id: 0, color: 'red', type: 'skip' });
      const sprite = new THREE.Sprite(mat);
      sprite.renderOrder = 14;
      sprite.visible = false;
      return { sprite, mat, used: false };
    });
    // seen by the debug fit check (FitProbe)
    for (const m of [glow.mesh, solid.mesh, icons.mesh]) m.userData.fit = 'fx';
    for (const b of badges) b.sprite.userData.fit = 'badge';
    const k = new Kit(glow, solid, icons, cards, badges);
    k.lite = lite;
    return k;
  }, [lite]);
  useEffect(() => kit.cards.setBack(cardTexture(null, theme)), [kit, theme]);

  const actives = useRef<Active[]>([]);
  const prev = useRef<Snap | null>(null);
  if (DEBUG) (window as unknown as { __cardFx?: Active[] }).__cardFx = actives.current;

  useEffect(() => {
    const s = game.s;
    const next = (from: number, steps?: number) => game.nextIdx(from, steps);
    const triggers = detect(prev.current, s, next);
    prev.current = snap(s);
    for (const tr of triggers) {
      if (tr.kind === 'play') startPlay(tr);
      else if (tr.kind === 'resolve') resolve(tr);
      else if (tr.kind === 'take') take(tr.target, tr.n);
      else knockOut(tr.target);
    }

    function spot(v: Vec3): Spot {
      return { x: v[0], y: v[1], z: v[2] };
    }
    function colorOf(c: Color | 'wild'): string {
      return c === 'wild' ? WILD_GOLD : HEX[c];
    }
    function badgeOf(card: Card, color: Color | null) {
      if (!HAS_BADGE.includes(card.type)) return null;
      return symbolTexture(card.color === 'wild' && color ? { ...card, color } : card);
    }
    function startPlay(tr: PlayTrigger) {
      const motif = motifFor(tr.card.type, tr.card.value);
      // a new card ends anything still waiting for a decision
      actives.current = actives.current.filter(a => !(a.motif.waits && a.resolved === null));
      if (!motif) return;
      const color = tr.color ?? (tr.card.color === 'wild' ? null : tr.card.color);
      const now = nowSec();
      const a: Active = {
        motif,
        type: tr.card.type,
        start: null,
        armed: now,
        resolved: motif.waits && !tr.waits ? 0 : null,
        pile: spot([pile[0], 0.1, pile[2]]),
        deck: spot(spawn.pos),
        from: anchor(game, tr.actor, view),
        to: tr.targets.map(i => anchor(game, i, view)),
        color: raw(colorOf(color ?? 'wild')),
        colorName: color,
        n: tr.n,
        dir: tr.dir,
        seed: (tr.card.id % 97) + 1,
        tex: badgeOf(tr.card, color),
        fired: 0,
        flag: tr.reflected,
      };
      if (actives.current.length >= MAX_ACTIVE) actives.current.shift();
      actives.current.push(a);
    }
    function knockOut(i: number) {
      const at = anchor(game, i, view);
      if (actives.current.length >= MAX_ACTIVE) actives.current.shift();
      actives.current.push({
        motif: knockout, type: 'num', start: nowSec(), armed: null, resolved: null,
        pile: spot([pile[0], 0.1, pile[2]]), deck: spot(spawn.pos), from: at, to: [at],
        color: raw('#9a94a8'), colorName: null, n: 0, dir: s.dir, seed: i + 7, tex: null, fired: 0, flag: false,
      });
    }
    /** a penalty was drawn: the hit waits for its cards to land (armed: see the frame loop) */
    function take(i: number, n: number) {
      if (actives.current.length >= MAX_ACTIVE) actives.current.shift();
      const at = anchor(game, i, view);
      const color = s.color;
      actives.current.push({
        motif: penaltyHit, type: 'draw2', start: null, armed: nowSec(), resolved: null,
        pile: spot([pile[0], 0.1, pile[2]]), deck: spot(spawn.pos), from: at, to: [at],
        color: raw(colorOf(color)), colorName: color, n, dir: s.dir, seed: i + 11, tex: null, fired: 0, flag: false,
      });
    }
    function resolve(tr: ResolveTrigger) {
      let a = actives.current.find(x => x.motif.waits && x.resolved === null);
      if (!a) {
        // nothing was waiting (the round opened with a wild, or we joined late): play it now
        const card = tr.card ?? s.discard[s.discard.length - 1];
        if (!card) return;
        startPlay({ kind: 'play', card, actor: tr.actor, targets: tr.targets, n: 0, waits: true, color: null, dir: s.dir, reflected: false });
        a = actives.current[actives.current.length - 1];
        if (!a || !a.motif.waits) return;
      }
      const now = nowSec();
      a.resolved = Math.max(now, fxState.landAt);
      // a colour was named: the floor shows it (a pulse if it did not change)
      if (a.type !== 'swap' && a.type !== 'gift' && a.type !== 'num') fxState.paint.seq++;
      a.colorName = tr.color;
      raw(colorOf(tr.color), a.color);
      a.to = tr.targets.map(i => anchor(game, i, view));
      if (a.type === 'dump' || a.type === 'num') a.n = tr.n || a.n;
      if (a.type === 'roulette') a.to = tr.targets.map(i => anchor(game, i, view));
      if (a.tex && a.type !== 'num') {
        const card = tr.card;
        if (card) a.tex = badgeOf(card, tr.color);
      }
    }
  }, [version]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const now = nowSec();
    const list = actives.current;
    kit.begin();
    for (let i = list.length - 1; i >= 0; i--) {
      const a = list[i];
      if (a.start === null && a.motif === penaltyHit) {
        // the cards leave the deck on the next frame: then their landing time is known
        if (now - (a.armed ?? now) < 0.05) continue;
        a.start = Math.max(now, fxState.drawLandAt);
        a.armed = null;
      }
      if (a.start === null) {
        const at = landingTime(a.armed ?? now, now);
        if (at === null) continue;
        a.start = at;
        a.armed = null;
        if (a.resolved === 0) a.resolved = at;
      }
      const t = now - a.start;
      if (t < 0) continue;
      // still waiting for a decision nobody is making any more (the moment slipped by between updates): stop now
      if (a.motif.waits && a.resolved === null && t > 0.6 && game.s.phase !== 'choose') a.resolved = now;
      const since = a.resolved === null || now < a.resolved ? -1 : now - a.resolved;
      const done = a.motif.waits ? (since >= 0 ? since > a.motif.life : t > MAX_WAIT) : t > a.motif.life;
      if (done) {
        // swap-remove: no new array
        list[i] = list[list.length - 1];
        list.pop();
        continue;
      }
      a.motif.frame(kit, a, t, since);
    }
    kit.end();
  });

  return (
    <>
      <primitive object={kit.cards.mesh} />
      <primitive object={kit.solid.mesh} />
      <primitive object={kit.glow.mesh} />
      <primitive object={kit.icons.mesh} />
      {kit.badges.map((b, i) => <primitive key={i} object={b.sprite} />)}
    </>
  );
}
