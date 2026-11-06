import { Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import type { GameView } from '../../game/view';
import { standIn } from '../../game/avatars';
import { teamName } from '../../game/content';
import { useT } from '../../i18n';
import { AvatarImg } from '../../ui/components/AvatarImg';
import { IconStack } from '../../ui/components/Icons';
import { ReactionBubble } from '../../ui/game/Reactions';
import { peek } from '../../ui/game/peek';
import { UiIcon } from '../../ui/components/UiIcon';
import { TurnTimer } from '../../ui/game/TurnTimer';
import { PARALLAX_X, arena, oppWall, visibleHalfWidth, type View } from '../layout';
import '../../ui/game/Plates.css';

const tmpV = new THREE.Vector3();

/** Avatar plates above each opponent's fan: name ribbon, portrait, card counter. */
export function PlayerPlates({ game, view, dealing }: { game: GameView; view: View; dealing: boolean }) {
  const t = useT();
  const s = game.s;
  const seat = game.seat();
  // the plate has a fixed size in pixels: on a short screen it needs more room above the fan
  const { width, height } = useThree(st => st.size);
  const camera = useThree(st => st.camera);
  const lift = view.portrait ? 0.45 : Math.min(1, Math.max(0.6, (0.6 * 800) / height)) + (view.compact ? 0.1 : 0);
  // a crowded table on a not-so-tall screen: smaller plates, so they stay off the neighbours' fans
  const small = view.portrait || view.compact || (s.players.length >= 7 && height < 900);
  const tiny = (view.portrait && s.players.length > 3) || (view.compact && s.players.length > 5);
  // the HUD's corner widgets, measured on the screen (the colour pill, the menu buttons)
  const corners = typeof document === 'undefined' ? [] : [...document.querySelectorAll('.hud-top .status, .corner-btns')].map(e => e.getBoundingClientRect());
  // who went out while this table was open: their plate steps aside while the van takes them (KnockoutVan)
  const outs = useRef<{ game: GameView | null; was: boolean[]; taken: Set<number> }>({ game: null, was: [], taken: new Set() });
  if (outs.current.game !== game) outs.current = { game, was: s.players.map(p => !!p.out), taken: new Set() };
  s.players.forEach((p, i) => {
    if (p.out && !outs.current.was[i]) outs.current.taken.add(i);
    outs.current.was[i] = !!p.out;
  });
  return (
    <>
      {s.players.map((p, i) => {
        if (i === seat) return null;
        // right above the top of their fan
        const w = oppWall(game, i, view);
        const h = w.top / w.up[1];
        const pos: [number, number, number] = [w.pos[0] + w.up[0] * h, w.top + lift, w.pos[2] + w.up[2] * h];
        const halfPx = tiny ? 48 : small ? 78 : 100;
        // a crowded table: the two end seats sit just under the next fan in, so their plate goes below their own fan
        const rel = (i - seat + s.players.length) % s.players.length;
        const end = s.players.length >= 7 && (rel === 1 || rel === s.players.length - 1);
        if (end) {
          const px = (2 * visibleHalfWidth(view, 0, w.pos[2])) / width;
          // the camera looks down at about 40°: moving toward it lowers the plate on screen
          const down = ((tiny ? 20 : small ? 24 : 32) + 10) * px / 0.63;
          pos[0] = w.pos[0];
          pos[1] = 0;
          pos[2] = w.pos[2] + down;
        }
        // seats at the sides: the plate leans outward, over its own fan rather than the next one in,
        // but never past the edge of the screen (about half a plate's width in, plus the mouse parallax)
        const vhw = visibleHalfWidth(view, pos[1], pos[2]);
        const perPx = (2 * vhw) / width;
        const out = Math.max(0, Math.min(1, (Math.abs(w.pos[0]) / (arena(view).rx * 0.8) - 0.55) / 0.45));
        const maxX = Math.max(0, vhw - PARALLAX_X - (halfPx + 6) * perPx);
        pos[0] = Math.max(-maxX, Math.min(maxX, pos[0] + Math.sign(pos[0]) * out * halfPx * 0.6 * perPx));
        // and never at the top edge of the screen: a gap that grows with the screen (rounded corners and the
        // browser's bar on a phone). On a phone the far seats already sit lower (see oppWall), so this rarely bites.
        const halfH = tiny ? 20 : small ? 24 : 32;
        const margin = Math.round(Math.max(8, height * 0.03));
        const ndc = tmpV.set(...pos).project(camera);
        const topPx = ((1 - ndc.y) / 2) * height - halfH - margin;
        if (topPx < 0) pos[1] = Math.max(0, pos[1] + (topPx * (2 * visibleHalfWidth(view, pos[1], pos[2]))) / width);
        // nor under the screen's own corner widgets (the colour pill top-left, the buttons top-right):
        // a plate that would sit under one slides down below it
        const cx = ((ndc.x + 1) / 2) * width;
        const plateTop = Math.max(margin, ((1 - ndc.y) / 2) * height - halfH);
        for (const r of corners) {
          if (cx + halfPx < r.left - 4 || cx - halfPx > r.right + 4 || plateTop > r.bottom + 4) continue;
          const down = r.bottom + 8 - plateTop;
          if (down > 0) pos[1] = Math.max(0, pos[1] - (down * (2 * visibleHalfWidth(view, pos[1], pos[2]))) / width);
        }
        const cur = i === s.cur && s.phase !== 'over';
        const sub = standIn(p.name);
        // a partner's hand is open to you (2 on 2 and up): tap their plate to see it big
        const canPeek = !!s.teams && seat >= 0 && s.teams[i] === s.teams[seat] && s.phase !== 'over' && p.hand.length > 0 && p.hand.every(c => !c.hidden);
        return (
          <Html key={i} position={pos} center zIndexRange={[20, 0]} pointerEvents="none">
            <div
              className={`oplate ${cur ? 'cur' : ''} ${i === s.winner ? 'win' : ''} ${p.offline ? 'off' : ''} ${p.out ? 'out' : ''} ${p.out && outs.current.taken.has(i) ? 'taken' : ''} ${s.teams ? `team t${s.teams[i]}` : ''} ${small ? 'small' : ''} ${tiny ? 'tiny' : ''} ${canPeek ? 'peekable' : ''}`}
              title={canPeek ? t('peek.hint', { who: p.name }) : p.name}
              onClick={canPeek ? () => peek.open(i) : undefined}
            >
              {canPeek && <span className="oplate-eye" aria-hidden><svg viewBox="0 0 24 24" width="15" height="15"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" /><circle cx="12" cy="12" r="3" fill="currentColor" /></svg></span>}
              <ReactionBubble seat={i} below />
              {s.teams && (
                <span className={`oplate-team ${s.teams[i] === s.teams[game.seat()] ? 'partner' : ''}`}>
                  {s.teams[i] === s.teams[game.seat()] && <UiIcon name="players" size={12} />}
                  {s.teams[i] === s.teams[game.seat()] ? t('plate.partner') : teamName(s.teams[i])}
                </span>
              )}
              <span className="ava-wrap swap-in" key={p.offline ? 'bot' : 'me'}>
                {/* someone dropped out: a bot sits in under its own name and face until they are back */}
                <AvatarImg id={p.offline ? sub.avatar : p.avatar} name={p.offline ? sub.name : p.name} bot={p.bot} size={view.compact ? 34 : small ? 40 : 54} className="oplate-ava" />
                {cur && !dealing && s.turnDeadline !== null && (
                  <TurnTimer key={s.turn} deadline={s.turnDeadline} total={s.turnTotal} offset={game.clockOffset} />
                )}
              </span>
              <span className="oplate-info">
                <span className="plate-name" key={p.offline ? 'bot' : 'me'}>{p.offline ? sub.name : p.name}</span>
                {p.out ? (
                  <span className="oplate-away">{t('plate.out')}</span>
                ) : p.offline ? (
                  <span className="oplate-away">{t('plate.away', { who: p.name })}</span>
                ) : (
                  <span className="oplate-count" aria-label={t('plate.cards', { n: p.hand.length })}><IconStack />{p.hand.length}</span>
                )}
              </span>
              {p.hand.length === 1 && s.phase !== 'over' && <span className="plate-uno">UNO!</span>}
              {/* whose turn: a gold tag hanging from the plate, pointing down at their cards */}
              {cur && !dealing && <span className="oplate-turn">{t('plate.turn')}</span>}
            </div>
          </Html>
        );
      })}
    </>
  );
}
