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
import { arena, computeTargets, deckCenter, deckSpot, dockSize, handRoom, makeView, type View } from '../layout';
import { readSafeArea } from '../layout/safeArea';
import { KnockoutVan } from '../van/KnockoutVan';
import { Mascot } from '../mascot/Mascot';
import { PlayFx, StackFx } from '../effects/PlayFx';
import { CardFx } from '../effects/cardFx/CardFx';
import { Podium } from '../players/podium/Podium';
import { THEMES } from '../themes';
import { SCENES } from '../themes/scenes';
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
  /** the round's finale plays: podium, confetti, the camera's lap (held back while a knock-out van is on screen) */
  finale?: boolean;
}

export function GameScene({ game, version, onCard, onDeck, canDraw, onReady, dealing = false, finale = false }: Props) {
  crashProbe('3d');
  const size = useThree(s => s.size);
  // the notch and the rounded corners of a phone: the layout keeps the cards out of them (re-read on resize/rotation)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the insets change with the screen's size and orientation
  const safe = useMemo(() => readSafeArea(), [size.width, size.height]);
  // a phone lying on its side (compact): wide but very short, so the HUD and plates get compact
  const base = makeView(size.width, size.height, safe);
  const { portrait, compact, aspect, h } = base;
  const { t: it, r: ir, b: ib, l: il } = safe;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- rebuilt only when a rounded value changes
  const view: View = useMemo(() => base, [portrait, compact, aspect, h, it, ir, ib, il]);
  // the HUD's corner panels get exactly the width the layout keeps free for them beside your hand (see dockSize);
  // with the hand above them, they may take up to half the screen
  useLayoutEffect(() => {
    const side = handRoom(view).beside ? dockSize(view).side : Math.min(300, Math.round(size.width * 0.45));
    document.documentElement.style.setProperty('--dock-side', `${side}px`);
  }, [view, size.width]);
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
  const Landing = SCENES[theme].Landing;
  const lite = isPhone();
  useLayoutEffect(() => setPlayableGlow(THEMES[theme].glow), [theme]);

  return (
    <>
      <CameraRig view={view} finale={finale} focus={A.discard} />
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
      {!finale && <PlayerPlates game={game} view={view} dealing={dealing} />}
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
      <Confetti active={finale} />
      <Podium
        active={finale && s.winner !== null}
        players={s.players}
        winner={s.winner}
        teams={s.teams}
        at={A.discard}
        scale={portrait ? 0.8 : 1}
      />
    </>
  );
}
