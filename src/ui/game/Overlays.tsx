import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { COLORS, teamName } from '../../game/content';
import type { Color } from '../../game/types';
import { render, useT } from '../../i18n';
import type { GameView } from '../../game/view';
import { IconCards, IconExit } from '../components/Icons';
import { AvatarImg } from '../components/AvatarImg';
import { EventIcon } from '../components/EventIcon';
import { EventLegend, Legend } from '../components/Legend';
import { FullscreenButton } from '../components/phone/FullscreenButton';
import { FullscreenIcon } from '../components/phone/phoneIcons';
import { GearMenu } from '../components/GearMenu';
import { canFullscreen, enterFullscreen, SMALL_SCREEN, useMedia, usePhone } from '../hooks/phone';
import { UiIcon } from '../components/UiIcon';
import { CoinFlip } from './CoinFlip';
import { ColorPick } from './ColorPick';
import { GamePanel, Key } from './GamePanel';
import { ChallengePick } from './ChallengePick';
import { RematchVote } from './RematchVote';
import { ReactionButton } from './Reactions';
import type { OnlineCtx } from './onlineCtx';
import './Overlays.css';

interface Props {
  game: GameView;
  version: number;
  score: Record<string, number>;
  onAgain: () => void;
  onMenu: () => void;
  online?: OnlineCtx;
  /** round start: no prompts until the cards are dealt */
  locked?: boolean;
  /** the round is over and its finale may play (see useFinale) */
  finale: boolean;
}

export function Overlays({ game, score, onAgain, onMenu, online, locked, finale }: Props) {
  const t = useT();
  const s = game.s;
  const p = game.cp();
  // modals that belong to the current player only show on that player's screen
  const mine = game.viewer() !== null && game.viewer() === s.cur;
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  // phones: all the corner buttons fold into one gear
  const small = useMedia(SMALL_SCREEN);
  const phone = usePhone();
  const [showEnd, setShowEnd] = useState(false);
  const pickColor = useCallback((c: Color) => game.resolveChoice(c), [game]);
  const declineChallenge = useCallback(() => game.declineChallenge(), [game]);
  const challengeWild4 = useCallback(() => game.challengeWild4(), [game]);
  const closeHelp = useCallback(() => setHelp(false), []);
  const closeMenu = useCallback(() => setMenu(false), []);

  // let the confetti and revealed hands play for a moment before the results card. Keyed by the round, not the
  // game object: online a reconnect brings a new one for the same round, and the results must not vanish then
  const shownFor = useRef(-1);
  useEffect(() => {
    if (!finale) { setShowEnd(false); return; }
    if (shownFor.current === s.round) { setShowEnd(true); return; }
    // give the podium time to rise and the players to land first
    const t = setTimeout(() => { shownFor.current = s.round; setShowEnd(true); }, 3600);
    return () => clearTimeout(t);
  }, [finale, s.round]);

  let modal: ReactNode = null;
  if (locked) {
    // nothing to decide while the table loads and the cards fly
  } else if (s.phase === 'handover') {
    // the curtain stays opaque: the last player's hand must not show while the device changes hands
    modal = (
      <GamePanel
        opaque
        className="handover"
        pill={<span>{t('ov.handover')}</span>}
        onEnter={() => game.confirmHandover()}
      >
        <AvatarImg id={p.avatar} name={p.name} bot={p.bot} size={72} className="handover-ava" />
        <h2 className="gp-title handover-name">{p.name}</h2>
        {(s.pending > 0 || s.bombNext || s.dareNext) && (
          <ul className="handover-notes">
            {s.pending > 0 && <li dangerouslySetInnerHTML={{ __html: t('ov.penalty', { n: s.pending }) }} />}
            {s.bombNext && <li>{t('ov.bomb')}</li>}
            {s.dareNext && <li>{t('ov.dareNext')}</li>}
          </ul>
        )}
        <div className="gp-actions one">
          <button type="button" className="btn big" onClick={() => game.confirmHandover()}>{t('ov.itsMe')}</button>
        </div>
      </GamePanel>
    );
  } else if (s.phase === 'dare' && mine) {
    modal = (
      <GamePanel
        className="dare-panel"
        pill={<><AvatarImg id={p.avatar} name={p.name} bot={p.bot} size={26} /><span>{t('ov.dareFor', { who: p.name })}</span></>}
        keys={{ 1: () => game.resolveDare(false), 2: () => game.resolveDare(true) }}
        onEnter={() => game.resolveDare(true)}
      >
        <p className="gp-card">{render(s.dare)}</p>
        <div className="gp-actions">
          <button type="button" className="btn big blue" onClick={() => game.resolveDare(false)}>{t('ov.chicken')}<Key k={1} /></button>
          <button type="button" className="btn big red" onClick={() => game.resolveDare(true)}>{t('ov.done')}<Key k={2} /></button>
        </div>
      </GamePanel>
    );
  } else if (s.phase === 'group') {
    modal = (
      <GamePanel pill={<><EventIcon id="group" size={22} /><span>{t('ov.group')}</span></>} onEnter={() => game.doneGroup()}>
        <p className="gp-card">{render(s.dare)}</p>
        <div className="gp-actions one">
          <button type="button" className="btn big" onClick={() => game.doneGroup()}>{t('ov.groupDone')}</button>
        </div>
        {!game.isLocal && <p className="gp-note">{t('ov.groupNote')}</p>}
      </GamePanel>
    );
  } else if (s.phase === 'coin' && mine) {
    modal = (
      <CoinFlip
        key={s.turn}
        name={p.name}
        coin={s.coin}
        onGuess={g => game.guessCoin(g)}
        onDone={() => game.finishCoin()}
      />
    );
  } else if (s.phase === 'play' && mine && s.challenge && s.challenge.target === s.cur && !s.drawn) {
    const by = s.players[s.challenge.by];
    modal = (
      <ChallengePick
        by={by}
        pending={s.pending}
        canAnswer={game.cp().hand.some(c => game.playable(c))}
        onAccept={declineChallenge}
        onChallenge={challengeWild4}
      />
    );
  } else if (s.phase === 'choose' && mine && s.choice?.kind === 'color') {
    const counts = Object.fromEntries(COLORS.map(c => [c, p.hand.filter(x => x.color === c).length])) as Record<Color, number>;
    modal = <ColorPick title={render(s.choice.title)} counts={counts} onPick={pickColor} />;
  } else if (s.phase === 'choose' && mine && s.choice?.kind === 'player') {
    const others = s.players.map((o, i) => [o, i] as const).filter(([o, i]) => i !== s.cur && !o.out);
    modal = (
      <GamePanel
        className="pick-player"
        pill={<span>{t(s.choice.mode === 'swap' ? 'card.swap' : 'card.gift')}</span>}
        title={render(s.choice.title)}
        keys={Object.fromEntries(others.slice(0, 9).map(([, i], n) => [String(n + 1), () => game.resolveChoice(i)]))}
      >
        <div className={`plist${others.length > 3 ? ' many' : ''}${others.length > 6 ? ' lots' : ''}`}>
          {others.map(([o, i], n) => (
            <button type="button" key={i} onClick={() => game.resolveChoice(i)}>
              <AvatarImg id={o.avatar} name={o.name} bot={o.bot} size={34} className="plist-ava" />
              <span className="plist-name">{o.name}</span>
              {o.bot && <UiIcon name="robot" size={16} className="plist-bot" />}
              <span className="plist-n">{t('ov.cards', { n: o.hand.length })}</span>
              {n < 9 && <kbd className="plist-key" aria-hidden>{n + 1}</kbd>}
            </button>
          ))}
        </div>
        {s.choice.mode === 'swap' && <p className="gp-note">{t('ov.youHave', { n: p.hand.length })}</p>}
      </GamePanel>
    );
  } else if (s.phase === 'over' && showEnd && s.winner !== null) {
    // online the score is kept by member id, locally by name
    const rows = s.players
      .map(x => [x.name, score[x.member ?? x.name] ?? 0] as const)
      .sort((a, b) => b[1] - a[1]);
    const loser = s.loser !== null ? s.players[s.loser] : null;
    const winner = s.players[s.winner];
    const team = s.winTeam !== null && s.teams;
    const ready = online ? (online.rematch?.ready ?? []).includes(online.me) : false;
    modal = (
      <GamePanel
        dock
        className="results"
        pill={<><UiIcon name="trophy" size={22} /><span>{t('ov.roundOver')}</span></>}
        title={team ? t('ov.teamWins', { team: teamName(s.winTeam!) }) : t('ov.wins', { who: winner.name })}
        keys={online ? undefined : { 1: onMenu, 2: onAgain }}
        onEnter={online ? (ready ? undefined : () => online.onVote(true)) : onAgain}
      >
        {team && (
          <p className="gp-note">{t('ov.names', { names: s.players.filter((_, i) => s.teams![i] === s.winTeam).map(p => p.name) })}</p>
        )}
        {s.timeUp && <p className="gp-note">{t('ov.timeUp')}</p>}
        {s.punishment && loser && (
          <div className="results-forfeit">
            <p className="gp-note">{t('ov.loser', { who: loser.name, n: loser.hand.length })}</p>
            <p className="gp-card">{render(s.punishment)}</p>
          </div>
        )}
        <div className="score" aria-label={t('ov.score')} role="group">
          <small>{t('ov.score')}</small>
          {rows.map(([n, v]) => (
            <div key={n}><span>{n}</span><b>{v}</b></div>
          ))}
        </div>
        {online ? (
          <RematchVote
            me={online.me}
            members={online.members}
            rematch={online.rematch}
            receivedAt={online.roomAt}
            isHost={online.isHost}
            onVote={online.onVote}
            onForce={online.onForce}
            onLobby={online.onLobby}
            onLeave={onMenu}
          />
        ) : (
          <div className="gp-actions">
            <button type="button" className="btn big blue" onClick={onMenu}>{t('ov.toMenu')}<Key k={1} /></button>
            <button type="button" className="btn big" onClick={onAgain}>{t('ov.again')}<Key k={2} /></button>
          </div>
        )}
      </GamePanel>
    );
  }

  return (
    <>
      <div className="corner-btns">
        {/* quick reactions: whoever plays at this screen (not a spectator), once the cards are dealt */}
        {!locked && game.viewer() !== null && !online?.spectator && <ReactionButton game={game} seat={game.viewer()!} />}
        {!small && <FullscreenButton />}
        {/* sound settings and the way out, together: a gold gear on a phone, the "Menu" button on a computer */}
        <GearMenu labeled={!small} items={[
          ...(small && phone.phone && !phone.portrait && !phone.fullscreen && canFullscreen() ? [{ icon: <FullscreenIcon />, label: t('fs.btn'), onClick: () => void enterFullscreen() }] : []),
          { icon: <IconCards />, label: t('ov.cardsTitle'), onClick: () => setHelp(true) },
          { icon: <IconExit />, label: online ? t('ov.leave') : t('ov.toMenu'), onClick: () => setMenu(true), danger: true },
        ]} />
      </div>
      {modal}
      {help && (
        <GamePanel className="help" title={t('ov.cardsTitle')} onClose={closeHelp} onEnter={closeHelp}>
          <Legend rules={s.rules} theme={s.theme} />
          {s.rules.events && (
            <>
              <h3 className="legend-sub">{t('setup.events')}</h3>
              <EventLegend />
            </>
          )}
          <div className="gp-actions one help-ok">
            <button type="button" className="btn big" onClick={closeHelp}>{t('ov.gotIt')}</button>
          </div>
        </GamePanel>
      )}
      {menu && (
        <GamePanel
          className="leave"
          title={online ? t('ov.leaveRoom') : t('ov.leaveGame')}
          onClose={closeMenu}
          keys={{ 1: closeMenu, 2: onMenu }}
        >
          <p className="gp-note leave-text">
            {online
              ? s.phase === 'over' || online.spectator
                ? t('ov.backByCode', { code: online.code })
                : t('ov.botTakes')
              : t('ov.roundLost')}
          </p>
          <div className="gp-actions">
            <button type="button" className="btn big blue" onClick={closeMenu}>{t('ov.stay')}<Key k={1} /></button>
            <button type="button" className="btn big red" onClick={onMenu}>{online ? t('ov.leave') : t('ov.toMenu')}<Key k={2} /></button>
          </div>
        </GamePanel>
      )}
    </>
  );
}
