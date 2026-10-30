import { Component, type ErrorInfo, type ReactNode } from 'react';
import { t } from '../../i18n';
import './ErrorBoundary.css';

interface Props {
  children: ReactNode;
  /** leave this screen for the start (absent for the last-resort guard around the whole app) */
  onMenu?: () => void;
}

interface State {
  error: Error | null;
  /** remounts the screen on "Continue" */
  attempt: number;
  /** recent crashes: if "Continue" keeps failing, a reload is offered instead */
  crashes: number[];
}

/** crashes within this window count as "it keeps failing" */
const WINDOW_MS = 30_000;
const MAX_TRIES = 3;

/**
 * Catches an error anywhere inside (a menu, the 3D table, a dialog) and shows a calm card instead of a blank screen.
 * "Continue" draws the screen again: the game itself lives outside it, so a local round goes on where it was
 * and an online one stays connected. "Menu" leaves for the start.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, attempt: 0, crashes: [] };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const now = Date.now();
    this.setState(s => ({ crashes: [...s.crashes.filter(x => now - x < WINDOW_MS), now] }));
    console.error('[crazy-uno] screen crashed', error, info.componentStack);
  }

  private retry = () => this.setState(s => ({ error: null, attempt: s.attempt + 1 }));

  private menu = () => {
    this.setState({ error: null, crashes: [] });
    this.props.onMenu?.();
  };

  render() {
    const { error, attempt, crashes } = this.state;
    if (!error) return <ErrorScope key={attempt}>{this.props.children}</ErrorScope>;
    const stuck = crashes.length >= MAX_TRIES;
    return (
      <div className="crash" role="alertdialog" aria-labelledby="crash-title" aria-describedby="crash-text">
        <div className="crash-card">
          <div className="crash-cards" aria-hidden>
            <span className="cc cc1" />
            <span className="cc cc2" />
            <span className="cc cc3" />
          </div>
          <h2 id="crash-title">{t('crash.title')}</h2>
          <p id="crash-text">{stuck ? t('crash.stuck') : t('crash.text')}</p>
          <div className="crash-actions">
            {stuck ? (
              <button className="btn big" autoFocus onClick={() => location.reload()}>{t('crash.reload')}</button>
            ) : (
              <button className="btn big" autoFocus onClick={this.retry}>{t('crash.go')}</button>
            )}
            {this.props.onMenu && <button className="btn" onClick={this.menu}>{t('crash.menu')}</button>}
            {!this.props.onMenu && !stuck && <button className="btn" onClick={() => location.reload()}>{t('crash.reload')}</button>}
          </div>
          <details className="crash-details">
            <summary>{t('crash.details')}</summary>
            <code>{String(error.message || error).slice(0, 300)}</code>
          </details>
        </div>
      </div>
    );
  }
}

/** a plain wrapper whose key changes on "Continue", so the screen is built anew */
function ErrorScope({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
