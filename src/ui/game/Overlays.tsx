import { type ReactNode, useEffect, useState } from 'react';
import { CNAME, COLORS, HEX, teamName } from '../../game/content';
import { render, useT } from '../../i18n';
import { LangSwitch } from '../components/LangSwitch';
import type { GameView } from '../../game/view';
import { IconCards, IconMenu } from '../components/Icons';
import { EventIcon } from '../components/EventIcon';
import { EventLegend, Legend } from '../components/Legend';
import { FullscreenButton } from '../components/RotateGate';
import { SoundMenu } from '../components/SoundMenu';
import { CoinFlip } from './CoinFlip';
import { RematchVote } from './RematchVote';
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
}

export function Overlays({ game, score, onAgain, onMenu, online, locked }: Props) {
  const t = useT();
  const s = game.s;
  const p = game.cp();
  // modals that belong to the current player only show on that player's screen
  const mine = game.viewer() !== null && game.viewer() === s.cur;
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  // let the confetti and revealed hands play for a moment before the results card
  useEffect(() => {
    if (s.phase !== 'over') { setShowEnd(false); return; }
    // give the podium time to rise and the players to land first
    const t = setTimeout(() => setShowEnd(true), 3600);
    return () => clearTimeout(t);
  }, [s.phase, game]);

  let modal: ReactNode = null;
  if (locked) {
    // nothing to decide while the table loads and the cards fly
  } else if (s.phase === 'handover') {
    modal = (
      <Modal opaque>
        <p className="muted">{t('ov.handover')}</p>
        <h2 className="huge">{p.name}</h2>
        {s.pending > 0 && <p dangerouslySetInnerHTML={{ __html: t('ov.penalty', { n: s.pending }) }} />}
        {s.bombNext && <p>{t('ov.bomb')}</p>}
        {s.dareNext && <p>{t('ov.dareNext')}</p>}
        <button className="btn big" autoFocus onClick={() => game.confirmHandover()}>{t('ov.itsMe')}</button>
      </Modal>
    );
  } else if (s.phase === 'dare' && mine) {
    modal = (
      <Modal band>
        <p className="muted">{t('ov.dareFor', { who: p.name })}</p>
        <p className="dare">{render(s.dare)}</p>
        <div className="row center">
          <button className="btn big blue" onClick={() => game.resolveDare(false)}>{t('ov.chicken')}</button>
          <button className="btn big red" autoFocus onClick={() => game.resolveDare(true)}>{t('ov.done')}</button>
        </div>
      </Modal>
    );
  } else if (s.phase === 'group') {
    modal = (
      <Modal band>
        <p className="muted ev-line"><EventIcon id="group" size={22} />{t('ov.group')}</p>
        <p className="dare">{render(s.dare)}</p>
        <button className="btn big" autoFocus onClick={() => game.doneGroup()}>{t('ov.groupDone')}</button>
        {!game.isLocal && <p className="muted small">{t('ov.groupNote')}</p>}
      </Modal>
    );
  } else if (s.phase === 'coin' && mine) {
    modal = (
      <Modal band>
        <CoinFlip
          key={s.turn}
          name={p.name}
          coin={s.coin}
          onGuess={g => game.guessCoin(g)}
          onDone={() => game.finishCoin()}
        />
      </Modal>
    );
  } else if (s.phase === 'play' && mine && s.challenge && s.challenge.target === s.cur && !s.drawn) {
    const by = s.players[s.challenge.by];
    modal = (
      <Modal band>
        <p className="muted">{t('ov.laid4', { who: by.name })}</p>
        <h2>{t('ov.challenge')}</h2>
        <p className="small muted">
          {t('ov.challengeHelp', { who: by.name })}
        </p>
        <div className="row center">
          <button className="btn big blue" onClick={() => game.declineChallenge()}>{t('ov.accept')}</button>
          <button className="btn big red" autoFocus onClick={() => game.challengeWild4()}>{t('ov.challengeBtn')}</button>
        </div>
      </Modal>
    );
  } else if (s.phase === 'choose' && mine && s.choice?.kind === 'color') {
    const counts = Object.fromEntries(COLORS.map(c => [c, p.hand.filter(x => x.color === c).length]));
    modal = (
      <Modal band>
        <h2>{render(s.choice.title)}</h2>
        <div className="colors">
          {COLORS.map(c => (
            <button key={c} style={{ background: HEX[c] }} onClick={() => game.resolveChoice(c)}>
              {CNAME[c]}
              <small>{t('ov.inHand', { n: counts[c] })}</small>
            </button>
          ))}
        </div>
      </Modal>
    );
  } else if (s.phase === 'choose' && mine && s.choice?.kind === 'player') {
    modal = (
      <Modal band>
        <h2>{render(s.choice.title)}</h2>
        <div className="plist">
          {s.players.map((o, i) =>
            i === s.cur || o.out ? null : (
              <button key={i} onClick={() => game.resolveChoice(i)}>
                <span>{o.bot ? '🤖 ' : ''}{o.name}</span>
                <span>{t('ov.cards', { n: o.hand.length })}</span>
              </button>
            ),
          )}
        </div>
        {s.choice.mode === 'swap' && <p className="muted small">{t('ov.youHave', { n: p.hand.length })}</p>}
      </Modal>
    );
  } else if (s.phase === 'over' && showEnd && s.winner !== null) {
    // online the score is kept by member id, locally by name
    const rows = s.players
      .map(x => [x.name, score[x.member ?? x.name] ?? 0] as const)
      .sort((a, b) => b[1] - a[1]);
    const loser = s.loser !== null ? s.players[s.loser] : null;
    modal = (
      <Modal sheet>
        <h2>
          🏆{' '}
          {s.winTeam !== null && s.teams
            ? t('ov.teamWins', { team: teamName(s.winTeam) })
            : t('ov.wins', { who: s.players[s.winner].name })}
        </h2>
        {s.winTeam !== null && s.teams && (
          <p className="muted">{t('ov.names', { names: s.players.filter((_, i) => s.teams![i] === s.winTeam).map(p => p.name) })}</p>
        )}
        {s.timeUp && <p className="muted small">{t('ov.timeUp')}</p>}
        {s.punishment && loser && (
          <>
            <p className="muted">{t('ov.loser', { who: loser.name, n: loser.hand.length })}</p>
            <p className="dare">{render(s.punishment)}</p>
          </>
        )}
        <div className="score">
          <small className="muted">{t('ov.score')}</small>
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
          <div className="row center">
            <button className="btn" onClick={onMenu}>{t('ov.toMenu')}</button>
            <button className="btn big" autoFocus onClick={onAgain}>{t('ov.again')}</button>
          </div>
        )}
      </Modal>
    );
  }

  return (
    <>
      <div className="corner-btns">
        <FullscreenButton />
        <SoundMenu />
        <button className="btn glass icon-btn labeled" onClick={() => setHelp(true)} title={t('ov.cardsTitle')}>
          <IconCards /><span>{t('ov.cardsBtn')}</span>
        </button>
        <button className="btn glass icon-btn labeled" onClick={() => setMenu(true)} title={t('ov.menu')}>
          <IconMenu /><span>{t('ov.menu')}</span>
        </button>
      </div>
      {modal}
      {help && (
        <Modal onClose={() => setHelp(false)}>
          <h2>{t('ov.cardsTitle')}</h2>
          <Legend rules={s.rules} theme={s.theme} />
          {s.rules.events && (
            <>
              <h3 className="legend-sub">{t('setup.events')}</h3>
              <EventLegend />
            </>
          )}
          <button className="btn big" onClick={() => setHelp(false)}>{t('ov.gotIt')}</button>
        </Modal>
      )}
      {menu && (
        <Modal onClose={() => setMenu(false)}>
          <h2>{online ? t('ov.leaveRoom') : t('ov.leaveGame')}</h2>
          <p>
            {online
              ? s.phase === 'over' || online.spectator
                ? t('ov.backByCode', { code: online.code })
                : t('ov.botTakes')
              : t('ov.roundLost')}
          </p>
          <LangSwitch className="menu-lang" />
          <div className="row center">
            <button className="btn" onClick={() => setMenu(false)}>{t('ov.stay')}</button>
            <button className="btn big" onClick={onMenu}>{online ? t('ov.leave') : t('ov.toMenu')}</button>
          </div>
        </Modal>
      )}
    </>
  );
}

/**
 * band: a translucent strip across the whole screen, the table stays visible above and below.
 * sheet: docked to the bottom, leaving the middle of the screen (the podium) in view.
 */
function Modal({ children, opaque, band, sheet, onClose }: { children: ReactNode; opaque?: boolean; band?: boolean; sheet?: boolean; onClose?: () => void }) {
  return (
    <div className={`ov ${opaque ? 'opaque' : ''} ${band ? 'band-ov' : ''} ${sheet ? 'sheet-ov' : ''}`} onClick={e => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className={`box ${band ? 'band' : ''} ${sheet ? 'sheet' : ''}`}>{children}</div>
    </div>
  );
}
