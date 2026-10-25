import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { CNAME, COLORS, HEX, TEAM_NAMES } from '../game/content';
import type { GameView } from '../game/view';
import { CoinFlip } from './CoinFlip';
import { Legend } from './Legend';
import { RematchVote } from './RematchVote';
import type { MemberInfo, Rematch } from '../net/protocol';
import { IconCards, IconMenu } from './Icons';
import { SoundMenu } from './SoundMenu';

/** Extra context when the game is an online room. */
export interface OnlineCtx {
  code: string;
  isHost: boolean;
  /** this player is only watching this round */
  spectator: boolean;
  /** host: back to the room lobby */
  onLobby: () => void;
  me: string;
  members: MemberInfo[];
  rematch: Rematch | null;
  roomAt: number;
  onVote: (ready: boolean) => void;
  onForce: () => void;
}

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
        <p className="muted">Передайте устройство</p>
        <h2 className="huge">{p.name}</h2>
        {s.pending > 0 && <p>Тебя ждёт штраф <b>+{s.pending}</b> 😬</p>}
        {s.bombNext && <p>💣 Под тобой бомба. Таймер стартует, как только откроешь карты.</p>}
        {s.dareNext && <p>🎭 И тебе достался фант.</p>}
        <button className="btn big" autoFocus onClick={() => game.confirmHandover()}>Это я, показать карты</button>
      </Modal>
    );
  } else if (s.phase === 'dare' && mine) {
    modal = (
      <Modal band>
        <p className="muted">🎭 Фант для {p.name}</p>
        <p className="dare">{s.dare}</p>
        <div className="row center">
          <button className="btn big blue" onClick={() => game.resolveDare(false)}>Слабо… (+2) 🐔</button>
          <button className="btn big red" autoFocus onClick={() => game.resolveDare(true)}>Выполнено!</button>
        </div>
      </Modal>
    );
  } else if (s.phase === 'group') {
    modal = (
      <Modal band>
        <p className="muted">🎤 Общий фант для всех</p>
        <p className="dare">{s.dare}</p>
        <button className="btn big" autoFocus onClick={() => game.doneGroup()}>Сделали!</button>
        {!game.isLocal && <p className="muted small">Нажать может любой. Через 25 секунд игра продолжится сама.</p>}
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
        <p className="muted">⚖️ {by.name} положил(а) +4</p>
        <h2>Оспорить?</h2>
        <p className="small muted">
          Если у {by.name} была карта того цвета, что лежал до +4, — {by.name} тянет 4 вместо тебя. Если всё было честно, ты тянешь 6.
        </p>
        <div className="row center">
          <button className="btn big blue" onClick={() => game.declineChallenge()}>Принять</button>
          <button className="btn big red" autoFocus onClick={() => game.challengeWild4()}>Оспорить!</button>
        </div>
      </Modal>
    );
  } else if (s.phase === 'choose' && mine && s.choice?.kind === 'color') {
    const counts = Object.fromEntries(COLORS.map(c => [c, p.hand.filter(x => x.color === c).length]));
    modal = (
      <Modal band>
        <h2>{s.choice.title}</h2>
        <div className="colors">
          {COLORS.map(c => (
            <button key={c} style={{ background: HEX[c] }} onClick={() => game.resolveChoice(c)}>
              {CNAME[c]}
              <small>{counts[c]} в руке</small>
            </button>
          ))}
        </div>
      </Modal>
    );
  } else if (s.phase === 'choose' && mine && s.choice?.kind === 'player') {
    modal = (
      <Modal band>
        <h2>{s.choice.title}</h2>
        <div className="plist">
          {s.players.map((o, i) =>
            i === s.cur ? null : (
              <button key={i} onClick={() => game.resolveChoice(i)}>
                <span>{o.bot ? '🤖 ' : ''}{o.name}</span>
                <span>{o.hand.length} карт</span>
              </button>
            ),
          )}
        </div>
        {s.choice.mode === 'swap' && <p className="muted small">У тебя сейчас {p.hand.length}</p>}
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
            ? `Команда «${TEAM_NAMES[s.winTeam]}» побеждает!`
            : `${s.players[s.winner].name} побеждает!`}
        </h2>
        {s.winTeam !== null && s.teams && (
          <p className="muted">{s.players.filter((_, i) => s.teams![i] === s.winTeam).map(p => p.name).join(' и ')}</p>
        )}
        {s.timeUp && <p className="muted small">⏱ Время раунда вышло: побеждает тот, у кого меньше всех карт</p>}
        {s.punishment && loser && (
          <>
            <p className="muted">Больше всех карт у {loser.name} ({loser.hand.length}). Наказание:</p>
            <p className="dare">{s.punishment}</p>
          </>
        )}
        <div className="score">
          <small className="muted">Победы за вечер</small>
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
            <button className="btn" onClick={onMenu}>В меню</button>
            <button className="btn big" autoFocus onClick={onAgain}>Ещё раунд</button>
          </div>
        )}
      </Modal>
    );
  }

  return (
    <>
      <div className="corner-btns">
        <SoundMenu />
        <button className="btn glass icon-btn labeled" onClick={() => setHelp(true)} title="Что за карты">
          <IconCards /><span>Карты</span>
        </button>
        <button className="btn glass icon-btn labeled" onClick={() => setMenu(true)} title="Меню">
          <IconMenu /><span>Меню</span>
        </button>
      </div>
      {modal}
      {help && (
        <Modal onClose={() => setHelp(false)}>
          <h2>Что за карты</h2>
          <Legend />
          <button className="btn big" onClick={() => setHelp(false)}>Понятно</button>
        </Modal>
      )}
      {menu && (
        <Modal onClose={() => setMenu(false)}>
          <h2>{online ? 'Выйти из комнаты?' : 'Выйти в меню?'}</h2>
          <p>
            {online
              ? s.phase === 'over' || online.spectator
                ? `Вернуться можно по коду ${online.code}.`
                : 'Твоё место до конца раунда займёт бот. Если просто пропадёт связь, место вернётся само.'
              : 'Текущий раунд пропадёт, счёт за вечер останется.'}
          </p>
          <div className="row center">
            <button className="btn" onClick={() => setMenu(false)}>Остаться</button>
            <button className="btn big" onClick={onMenu}>{online ? 'Выйти' : 'В меню'}</button>
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
