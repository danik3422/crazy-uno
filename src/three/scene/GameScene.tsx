import { useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo } from 'react';
import type { GameView } from '../../game/view';
import { Card3D, setPlayableGlow } from '../cards/Card3D';
import { DeckStack } from './DeckStack';
import { dealTiming } from '../../net/protocol';
import { Arena, PALETTES } from './Environment';
import { EventFx } from '../effects/eventFx/EventFx';
import { DEBUG, crashProbe } from '../../lib/debug';
import { FitProbe } from '../debug/FitProbe';
import { arena, computeTargets, deckCenter, deckSpot, type View } from '../layout';
import { KnockoutVan } from '../van/KnockoutVan';
import { Mascot } from '../mascot/Mascot';
import { PlayFx, StackFx } from '../effects/PlayFx';
import { CardFx } from '../effects/cardFx/CardFx';
import { Podium } from '../players/podium/Podium';
import { THEMES } from '../themes';
import { isPhone } from '../../ui/hooks/phone';
import { CameraRig } from './CameraRig';
import { DirectionArrows } from './DirectionArrows';
import { TurnMarker } from './TurnMarker';
import { DeckHit } from './DeckHit';
import { PlayerPlates } from '../players/PlayerPlates';
import { Bomb } from '../effects/Bomb';
import { Explosion } from '../effects/Explosion';
import { Confetti } from '../effects/Confetti';
import { DropZone } from './DropZone';
import { ReadySignal } from './ReadySignal';

interface Props {
  game: GameView;
  version: number;
  onCard: (id: number) => void;
  onDeck: () => void;
  canDraw: boolean;
  /** the table has been drawn a few times (textures uploaded, shaders compiled) */
  onReady?: () => void;
  /** the table is still loading or the cards are being dealt: no turn clock yet */
  dealing?: boolean;
}

export function GameScene({ game, version, onCard, onDeck, canDraw, onReady, dealing = false }: Props) {
  crashProbe('3d');
  const size = useThree(s => s.size);
  const portrait = size.width / size.height < 0.9;
  // a phone lying on its side: wide but very short, so the HUD and plates get compact
  const compact = !portrait && size.height < 520;
  // rounded, so resizing a window does not rebuild the layout on every pixel
  const aspect = Math.round((size.width / size.height) * 50) / 50;
  // the screen's height in CSS pixels (rounded): a short phone gets bigger cards
  const h = Math.round(size.height / 10) * 10;
  const view: View = useMemo(() => ({ portrait, compact, aspect, h }), [portrait, compact, aspect, h]);
  // the game changes in place: `version` is what says it did
  // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
  const targets = useMemo(() => computeTargets(game, view), [game, version, view]);
  const s = game.s;
  const A = arena(view);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version: the game changed in place
  const deck = useMemo(() => deckSpot(game, view), [game, version, view]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- version: the game changed in place
  const deckMid = useMemo(() => deckCenter(game, view), [game, version, view]);
  const cards = [...s.deck, ...s.discard, ...s.players.flatMap(p => p.hand)];
  const top = s.discard[s.discard.length - 1];
  const theme = s.theme ?? 'classic';
  const Landing = THEMES[theme].Landing;
  const lite = isPhone();
  useLayoutEffect(() => setPlayableGlow(THEMES[theme].glow), [theme]);

  return (
    <>
      <CameraRig view={view} finale={s.phase === 'over'} focus={A.discard} />
      <ReadySignal onReady={onReady} />
      {DEBUG && <FitProbe />}
      <ambientLight intensity={0.75} />
      <directionalLight
        position={[2, 11, 7]}
        intensity={1.9}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-9}
        shadow-camera-right={9}
        shadow-camera-top={9}
        shadow-camera-bottom={-9}
        shadow-bias={-0.0004}
      />
      <hemisphereLight args={['#fff4dc', PALETTES[theme][s.color].outer, 0.5]} />
      <Arena color={s.color} theme={theme} view={view} center={[A.discard[0], A.discard[2]]} />
      <DirectionArrows dir={s.dir} at={A.discard} />
      <TurnMarker game={game} view={view} version={version} />
      {cards.map(c => {
        const t = targets.get(c.id);
        return t ? <Card3D key={c.id} card={c} t={t} theme={theme} onPick={onCard} /> : null;
      })}
      <DeckStack at={deck} center={deckMid} theme={theme} portrait={portrait} slideAt={dealTiming(s.players.length, s.table?.handSize ?? 7).slideMs / 1000} />
      <DeckHit active={canDraw} onClick={onDeck} pending={s.pending} at={deck} />
      {/* during the finale the podium shows everyone, so the seat plates step aside */}
      {s.phase !== 'over' && <PlayerPlates game={game} view={view} dealing={dealing} />}
      {top && <PlayFx top={top} at={A.discard} />}
      {top && Landing && <Landing top={top} at={A.discard} lite={lite} />}
      <StackFx pending={s.pending} top={top} at={A.discard} />
      <CardFx game={game} version={version} view={view} theme={theme} pile={A.discard} />
      <DropZone at={A.discard} radius={portrait ? 2.2 : 2.6} />
      <Bomb deadline={s.timerKind === 'bomb' ? s.bombDeadline : null} offset={game.clockOffset} />
      <Explosion />
      <EventFx game={game} view={view} theme={theme} />
      <Mascot scale={portrait ? 0.6 : 0.72} portrait={portrait} />
      <KnockoutVan game={game} version={version} view={view} />
      {/* mounted all round (hidden) so their shaders are ready: the finale must not stall */}
      <Confetti active={s.phase === 'over'} />
      <Podium
        active={s.phase === 'over' && s.winner !== null}
        players={s.players}
        winner={s.winner}
        teams={s.teams}
        at={A.discard}
        scale={portrait ? 0.8 : 1}
      />
    </>
  );
}
